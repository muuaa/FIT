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

import com.google.firebase.messaging.FirebaseMessaging;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    

    

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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

    private boolean launched;

    private static final int ASK_NOTIFICATIONS = 7;

    /**
     * Before opening: on Android 13+ ask once for permission to show notifications (an install
     * starts with them off), then wait briefly for this phone's Firebase token.
     */
    @Override
    protected boolean shouldLaunchImmediately() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !getSharedPreferences(Push.PREFS, MODE_PRIVATE).getBoolean("asked_notifications", false)) {
            getSharedPreferences(Push.PREFS, MODE_PRIVATE).edit().putBoolean("asked_notifications", true).apply();
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, ASK_NOTIFICATIONS);
            return false;
        }
        return afterPermission();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == ASK_NOTIFICATIONS && afterPermission() && !launched) {
            launched = true;
            launchTwa();
        }
    }

    /** Wait (briefly) for this phone's Firebase token so the site can register it. */
    private boolean afterPermission() {
        if (Push.token(this) != null) return true;
        Handler main = new Handler(Looper.getMainLooper());
        Runnable go = () -> {
            if (launched || isFinishing()) return;
            launched = true;
            launchTwa();
        };
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (task.isSuccessful()) Push.saveToken(this, task.getResult());
                main.post(go);
            });
        } catch (RuntimeException e) {
            main.post(go);
            return false;
        }
        main.postDelayed(go, 3000);
        return false;
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
