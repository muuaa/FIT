/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.github.muuaa.bettertogether;

import android.Manifest;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewTreeObserver;

import android.app.ActivityOptions;
import android.content.ComponentName;
import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;

import com.google.androidbrowserhelper.trusted.SessionStore;
import com.google.androidbrowserhelper.trusted.SharedPreferencesTokenStore;
import com.google.androidbrowserhelper.trusted.TwaLauncher;
import com.google.androidbrowserhelper.trusted.TwaProviderPicker;
import com.google.androidbrowserhelper.trusted.splashscreens.SplashScreenStrategy;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import com.google.firebase.messaging.FirebaseMessaging;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    

    

    /** When the launch screen started, and whether it may go away yet (Android 12+). */
    private final long startedAt = SystemClock.uptimeMillis();
    private boolean releaseSplash;
    private View contentView;

    /** Let the launch screen go (it stays until Chrome has started, so nothing shows in between). */
    private void letSplashGo() {
        releaseSplash = true;
        if (contentView != null) contentView.invalidate();
    }
    private static final long SPLASH_MIN_MS = 850; // the ring and spark finish drawing

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Keep Android's animated launch screen up until the app is ready to hand over to Chrome,
        // so the logo never disappears and pops back in between the steps of opening.
        if (Build.VERSION.SDK_INT >= 31) {
            final View content = findViewById(android.R.id.content);
            contentView = content;
            content.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
                @Override
                public boolean onPreDraw() {
                    if (!releaseSplash) return false;
                    content.getViewTreeObserver().removeOnPreDrawListener(this);
                    return true;
                }
            });
        }
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    private static final int ASK_NOTIFICATIONS = 7;
    private static final Uri ORIGIN = Uri.parse("https://muuaa.github.io");

    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean launched;
    private boolean preparing;
    private CustomTabsServiceConnection connection;

    /**
     * Opening runs in steps behind the dark launch screen, then shows the app in one go:
     * 1. Android 13+: ask once for permission to show notifications.
     * 2. Get this phone's Firebase token (if it isn't saved yet), for native notifications.
     * 3. Have Chrome confirm the app and the site belong together *before* opening it. Otherwise
     *    Chrome opens first and shows a grey screen with the site's address bar until it's sure.
     */
    @Override
    protected boolean shouldLaunchImmediately() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !getSharedPreferences(Push.PREFS, MODE_PRIVATE).getBoolean("asked_notifications", false)) {
            getSharedPreferences(Push.PREFS, MODE_PRIVATE).edit().putBoolean("asked_notifications", true).apply();
            letSplashGo(); // let the permission question show
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, ASK_NOTIFICATIONS);
            return false;
        }
        fetchToken();
        return false;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == ASK_NOTIFICATIONS) fetchToken();
    }

    private void fetchToken() {
        if (Push.token(this) != null) {
            verifyThenOpen();
            return;
        }
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (task.isSuccessful()) Push.saveToken(this, task.getResult());
                main.post(this::verifyThenOpen);
            });
        } catch (RuntimeException e) {
            main.post(this::verifyThenOpen);
            return;
        }
        main.postDelayed(this::verifyThenOpen, 3000);
    }

    private void verifyThenOpen() {
        if (preparing || launched) return;
        preparing = true;
        main.postDelayed(this::open, 1500); // never wait longer than this
        String chrome = TwaProviderPicker.pickProvider(getPackageManager()).provider;
        if (chrome == null) {
            open();
            return;
        }
        connection = new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(@NonNull ComponentName name, @NonNull CustomTabsClient client) {
                client.warmup(0);
                CustomTabsSession session = client.newSession(new CustomTabsCallback() {
                    @Override
                    public void onRelationshipValidationResult(int relation, @NonNull Uri origin, boolean result, @Nullable Bundle extras) {
                        main.post(LauncherActivity.this::open);
                    }
                });
                if (session == null || !session.validateRelationship(CustomTabsService.RELATION_HANDLE_ALL_URLS, ORIGIN, null)) {
                    main.post(LauncherActivity.this::open);
                }
            }

            @Override
            public void onServiceDisconnected(ComponentName name) {}
        };
        try {
            if (!CustomTabsClient.bindCustomTabsService(this, chrome, connection)) open();
        } catch (RuntimeException e) {
            open();
        }
    }

    /**
     * Phones animate opening a new screen with a sideways slide; when the app hands over to Chrome
     * that looked like the app sliding away. Both screens look the same (dark, same tile), so a
     * quick cross-fade makes the hand-over invisible.
     */
    @Override
    protected TwaLauncher createTwaLauncher() {
        return new TwaLauncher(this, null, SessionStore.makeSessionId(getTaskId()), new SharedPreferencesTokenStore(this)) {
            @Override
            public void launch(TrustedWebActivityIntentBuilder builder, CustomTabsCallback callback, @Nullable SplashScreenStrategy splash,
                    @Nullable Runnable done, TwaLauncher.FallbackStrategy fallback) {
                super.launch(builder, callback, splash, () -> {
                    overridePendingTransition(R.anim.bt_fade_in, R.anim.bt_hold);
                    // Keep Android's launch screen (the logo) until Chrome has faded in on top of it.
                    main.postDelayed(LauncherActivity.this::letSplashGo, 1200);
                    if (done != null) done.run();
                }, fallback);
            }
        };
    }

    /**
     * The app hands over to Chrome with startActivity. Attach a cross-fade to that launch itself, so
     * Android can't swap in its own sideways slide (newer Android ignores a fade set afterwards).
     */
    @Override
    public void startActivity(Intent intent, @Nullable Bundle options) {
        if (options == null && intent != null && !isFinishing()) {
            options = ActivityOptions.makeCustomAnimation(this, R.anim.bt_fade_in, R.anim.bt_hold).toBundle();
            Bundle exit = ActivityOptions.makeCustomAnimation(this, R.anim.bt_fade_in, R.anim.bt_hold).toBundle();
            intent.putExtra("android.support.customtabs.extra.EXIT_ANIMATION_BUNDLE", exit);
        }
        super.startActivity(intent, options);
    }

    private void open() {
        if (launched || isFinishing()) return;
        long wait = SPLASH_MIN_MS - (SystemClock.uptimeMillis() - startedAt);
        if (Build.VERSION.SDK_INT >= 31 && wait > 0) {
            main.postDelayed(this::open, wait); // let the logo finish drawing first
            return;
        }
        launched = true;
        main.postDelayed(this::letSplashGo, 4000); // safety: never keep the launch screen forever
        launchTwa();
    }

    @Override
    protected void onStop() {
        super.onStop();
        letSplashGo(); // hidden behind the app now
    }

    @Override
    protected void onDestroy() {
        if (connection != null) {
            try {
                unbindService(connection);
            } catch (RuntimeException ignored) {
                // already gone
            }
            connection = null;
        }
        super.onDestroy();
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Tell the site it is running in the app, and hand it the token for native notifications.
        Uri.Builder b = super.getLaunchingUrl().buildUpon().appendQueryParameter("app", String.valueOf(BuildConfig.VERSION_CODE));
        String token = Push.token(this);
        if (token != null) b.appendQueryParameter("fcm", token);
        return b.build();
    }
}
