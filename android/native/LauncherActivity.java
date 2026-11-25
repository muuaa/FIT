package io.github.muuaa.bettertogether;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;

import com.google.firebase.messaging.FirebaseMessaging;

import java.io.File;

/**
 * The whole app in its own window (no hand-over to Chrome, so opening is one smooth step):
 * Android's animated launch logo stays until the app has drawn, then the app appears.
 */
public class LauncherActivity extends Activity {
    private static final String HOST = "muuaa.github.io";
    private static final String HOME = "https://" + HOST + "/FIT/";
    private static final int PICK_FILE = 41;
    private static final int ASK_NOTIFICATIONS = 42;
    private static final long SPLASH_MIN_MS = 850; // the ring and spark finish drawing
    private static final long SPLASH_MAX_MS = 7000; // never keep the logo longer than this

    private final Handler main = new Handler(Looper.getMainLooper());
    private final long startedAt = SystemClock.uptimeMillis();
    private WebView web;
    private boolean showApp;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Push.ensureChannel(this);
        if (Push.token(this) == null) {
            try {
                FirebaseMessaging.getInstance().getToken().addOnSuccessListener(t -> Push.saveToken(this, t));
            } catch (RuntimeException ignored) {
                // no Firebase on this phone
            }
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#07080D"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " BetterTogetherApp/" + BuildConfig.VERSION_CODE);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.addJavascriptInterface(new Bridge(), "BTNative");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        // The web view ignores its own padding, so it sits inside a frame that keeps it clear of the bars.
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.parseColor("#07080D"));
        frame.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(frame);
        fitBelowSystemBars(frame);

        // Keep Android's animated launch logo until the app has drawn (or a safety limit).
        if (Build.VERSION.SDK_INT >= 31) {
            final View content = findViewById(android.R.id.content);
            content.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
                @Override
                public boolean onPreDraw() {
                    if (!showApp) return false;
                    content.getViewTreeObserver().removeOnPreDrawListener(this);
                    return true;
                }
            });
        }
        main.postDelayed(this::revealApp, SPLASH_MAX_MS);

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(startUrl(getIntent()));
    }

    /** Show the app: after the logo has finished drawing and the app says it's ready. */
    private void revealApp() {
        if (showApp) return;
        long wait = SPLASH_MIN_MS - (SystemClock.uptimeMillis() - startedAt);
        if (wait > 0) {
            main.postDelayed(this::revealApp, wait);
            return;
        }
        showApp = true;
        View content = findViewById(android.R.id.content);
        if (content != null) content.invalidate();
    }

    /** On newer Android apps draw behind the status and navigation bars: keep the app clear of them. */
    private void fitBelowSystemBars(View v) {
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#07080D"));
        if (Build.VERSION.SDK_INT < 30) return;
        v.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsets.CONSUMED;
        });
    }

    /** Where to open: a notification's page, a link into the app, or Home. */
    private String startUrl(Intent intent) {
        String url = HOME;
        Uri data = intent != null ? intent.getData() : null;
        if (data != null) {
            if ("https".equals(data.getScheme()) && HOST.equals(data.getHost())) {
                url = data.toString();
            } else if ("bettertogether".equals(data.getScheme()) && "open".equals(data.getHost())) {
                // bettertogether://open/FIT/plan?google=connected (back from Google sign-in)
                String path = data.getEncodedPath() != null ? data.getEncodedPath() : "/FIT/";
                url = "https://" + HOST + path + (data.getEncodedQuery() != null ? "?" + data.getEncodedQuery() : "");
            }
        }
        Uri.Builder b = Uri.parse(url).buildUpon().appendQueryParameter("app", String.valueOf(BuildConfig.VERSION_CODE));
        String token = Push.token(this);
        if (token != null) b.appendQueryParameter("fcm", token);
        return b.build().toString();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getData() != null) web.loadUrl(startUrl(intent));
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        // Back from the phone's settings or another app: let the page re-check things.
        web.evaluateJavascript("window.dispatchEvent(new Event('btresume'))", null);
    }

    @Override
    protected void onPause() {
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    /** Links outside the app open in a browser tab (Google sign-in, Google Calendar, …). */
    private void openOutside(Uri uri) {
        try {
            if ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) {
                CustomTabsIntent tab = new CustomTabsIntent.Builder()
                        .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(Color.parseColor("#07080D")).build())
                        .setShowTitle(true)
                        .build();
                tab.launchUrl(this, uri);
            } else {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            }
        } catch (ActivityNotFoundException ignored) {
            // nothing can open it
        }
    }

    private class Client extends WebViewClient {
        // Shown once the page has loaded, even if it never says it's ready (older website version).
        @Override
        public void onPageFinished(WebView view, String url) {
            main.postDelayed(LauncherActivity.this::revealApp, 700);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/FIT")) return false;
            openOutside(u);
            return true;
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent pick = params.createIntent();
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            Intent chooser = Intent.createChooser(pick, null);
            // Offer the camera too when a photo is wanted.
            boolean images = false;
            for (String a : params.getAcceptTypes()) if (a != null && a.startsWith("image")) images = true;
            cameraUri = null;
            if (images) {
                try {
                    File dir = new File(getCacheDir(), "camera");
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, "photo-" + System.currentTimeMillis() + ".jpg");
                    cameraUri = FileProvider.getUriForFile(LauncherActivity.this, getPackageName() + ".fileprovider", f);
                    Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                            .putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
                            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] {cam});
                } catch (RuntimeException e) {
                    cameraUri = null;
                }
            }
            try {
                startActivityForResult(chooser, PICK_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                result = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < result.length; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                result = new Uri[] {data.getData()};
            } else if (cameraUri != null) {
                result = new Uri[] {cameraUri};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == ASK_NOTIFICATIONS) tellNotificationState();
    }

    private void tellNotificationState() {
        web.evaluateJavascript("window.__btNotif && window.__btNotif('" + notificationState() + "')", null);
    }

    /** 'granted', 'denied' (switched off), or 'default' (not asked yet). */
    private String notificationState() {
        if (NotificationManagerCompat.from(this).areNotificationsEnabled()) return "granted";
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !getSharedPreferences(Push.PREFS, MODE_PRIVATE).getBoolean("asked_notifications", false)) return "default";
        return "denied";
    }

    /** What the app's page can ask the phone (window.BTNative). */
    private class Bridge {
        @JavascriptInterface
        public void ready() {
            main.post(LauncherActivity.this::revealApp);
        }

        @JavascriptInterface
        public String fcmToken() {
            String t = Push.token(LauncherActivity.this);
            return t == null ? "" : t;
        }

        @JavascriptInterface
        public int appVersion() {
            return BuildConfig.VERSION_CODE;
        }

        @JavascriptInterface
        public String notificationStatus() {
            return notificationState();
        }

        @JavascriptInterface
        public void requestNotifications() {
            main.post(() -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    getSharedPreferences(Push.PREFS, MODE_PRIVATE).edit().putBoolean("asked_notifications", true).apply();
                    requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, ASK_NOTIFICATIONS);
                } else {
                    tellNotificationState();
                }
            });
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            main.post(() -> {
                Intent i = Build.VERSION.SDK_INT >= 26
                        ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                        : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null));
                try {
                    startActivity(i);
                } catch (ActivityNotFoundException ignored) {
                    // nothing to open
                }
            });
        }

        @JavascriptInterface
        public void openExternal(String url) {
            main.post(() -> openOutside(Uri.parse(url)));
        }
    }
}
