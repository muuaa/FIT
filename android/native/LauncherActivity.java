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
    private static final long SPLASH_MIN_MS = 1550; // the launch animation finishes
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

        // Keep Android's animated launch logo on top while the app draws underneath it (the app
        // must keep drawing, or it can't get ready), then fade the logo away straight into the app.
        if (Build.VERSION.SDK_INT >= 31) {
            getSplashScreen().setOnExitAnimationListener(view -> {
                splashView = view;
                if (showApp) fadeOutSplash();
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
        fadeOutSplash();
    }

    /** Lift the logo only once the web view has really put the app's current frame on screen. */
    private void revealWhenDrawn() {
        if (showApp || web == null) return;
        if (Build.VERSION.SDK_INT < 23) { revealApp(); return; }
        main.postDelayed(this::revealApp, 1200); // in case the web view never reports back
        web.postVisualStateCallback(1, new WebView.VisualStateCallback() {
            @Override
            public void onComplete(long requestId) {
                // That frame is drawn on the next pass: give it one more frame, then fade.
                web.postOnAnimation(() -> web.postOnAnimation(LauncherActivity.this::revealApp));
            }
        });
    }

    private android.window.SplashScreenView splashView;

    private void fadeOutSplash() {
        if (Build.VERSION.SDK_INT < 31 || splashView == null) return;
        final android.window.SplashScreenView v = splashView;
        splashView = null;
        View icon = v.getIconView();
        android.view.ViewGroup decor = (android.view.ViewGroup) getWindow().getDecorView();
        if (icon == null || icon.getWidth() == 0) {
            v.animate().alpha(0f).setDuration(260).withEndAction(v::remove).start();
            return;
        }
        // The star grows to fill the screen and becomes a window onto the app.
        int[] at = new int[2];
        int[] decorAt = new int[2];
        icon.getLocationInWindow(at);
        decor.getLocationInWindow(decorAt);
        final StarReveal reveal = new StarReveal(this, at[0] - decorAt[0], at[1] - decorAt[1], icon.getWidth() / 288f);
        decor.addView(reveal, new android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT));
        v.remove();
        android.animation.ValueAnimator anim = android.animation.ValueAnimator.ofFloat(0f, 1f);
        anim.setDuration(640);
        anim.setInterpolator(new android.view.animation.PathInterpolator(0.55f, 0f, 0.35f, 1f));
        anim.addUpdateListener(x -> reveal.setProgress((float) x.getAnimatedValue()));
        anim.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(android.animation.Animator animation) {
                decor.removeView(reveal);
            }
        });
        anim.start();
    }

    /** The launch logo's last moment, drawn by the app: the star opens up into the app behind it. */
    private static final class StarReveal extends View {
        private final float ox, oy, u;
        private float p;
        private final android.graphics.Path star = new android.graphics.Path();
        private final android.graphics.Path unit = new android.graphics.Path();
        private final android.graphics.Paint bg = new android.graphics.Paint();
        private final android.graphics.Paint tile = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.Paint glowPaint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.Paint track = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.Paint ring = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.Paint fill = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.Paint edge = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        private final android.graphics.Matrix m = new android.graphics.Matrix();

        StarReveal(android.content.Context c, float ox, float oy, float u) {
            super(c);
            this.ox = ox;
            this.oy = oy;
            this.u = u;
            // The spark, centred on 0,0 in the logo's own units.
            unit.moveTo(0, -20);
            unit.rCubicTo(2, 12.5f, 7.5f, 18, 20, 20);
            unit.rCubicTo(-12.5f, 2, -18, 7.5f, -20, 20);
            unit.rCubicTo(-2, -12.5f, -7.5f, -18, -20, -20);
            unit.rCubicTo(12.5f, -2, 18, -7.5f, 20, -20);
            unit.close();
            bg.setColor(Color.parseColor("#07080D"));
            fill.setColor(Color.WHITE);
            track.setStyle(android.graphics.Paint.Style.STROKE);
            track.setColor(Color.argb(20, 255, 255, 255));
            ring.setStyle(android.graphics.Paint.Style.STROKE);
            edge.setStyle(android.graphics.Paint.Style.STROKE);
            edge.setStrokeJoin(android.graphics.Paint.Join.ROUND);
        }

        void setProgress(float p) {
            this.p = p;
            invalidate();
        }

        @Override
        protected void onDraw(android.graphics.Canvas canvas) {
            float cx = ox + 144 * u, cy = oy + 153 * u;
            float w = getWidth(), h = getHeight();
            // Big enough that even the star's narrow waist clears the furthest corner.
            float far = (float) Math.max(Math.hypot(cx, cy), Math.max(Math.hypot(w - cx, cy), Math.max(Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy))));
            float end = far / (8.4f * u) * 1.08f;
            float k = 1 + (end - 1) * p;
            m.reset();
            m.postRotate(55 * p);
            m.postScale(k * u, k * u);
            m.postTranslate(cx, cy + 0.5f * u);
            unit.transform(m, star);

            canvas.save();
            canvas.clipOutPath(star);
            canvas.drawRect(0, 0, w, h, bg);
            // Tile and ring rush outward and dissolve.
            float logo = Math.max(0f, 1f - p * 2.4f);
            if (logo > 0) {
                float z = 1 + p * 1.6f;
                float half = 64 * u * z, r = 29 * u * z;
                tile.setShader(new android.graphics.LinearGradient(cx - half, cy - half, cx - half + 51.2f * u * z, cy + half,
                        Color.parseColor("#1D1936"), Color.parseColor("#07070D"), android.graphics.Shader.TileMode.CLAMP));
                tile.setAlpha((int) (255 * logo));
                canvas.drawRoundRect(cx - half, cy - half, cx + half, cy + half, r, r, tile);
                glowPaint.setShader(new android.graphics.RadialGradient(cx, cy - 6.4f * u * z, 70.4f * u * z,
                        Color.argb(73, 168, 155, 255), Color.argb(0, 168, 155, 255), android.graphics.Shader.TileMode.CLAMP));
                glowPaint.setAlpha((int) (255 * logo));
                canvas.drawRoundRect(cx - half, cy - half, cx + half, cy + half, r, r, glowPaint);
                float rr = 37.5f * u * z;
                track.setStrokeWidth(11 * u * z);
                track.setAlpha((int) (20 * logo));
                canvas.drawCircle(cx, cy, rr, track);
                ring.setStrokeWidth(11 * u * z);
                ring.setShader(new android.graphics.LinearGradient(cx, cy - rr, cx, cy + rr,
                        new int[] {Color.parseColor("#D9CEFF"), Color.parseColor("#A89BFF"), Color.parseColor("#FF9EB5")},
                        new float[] {0f, 0.55f, 1f}, android.graphics.Shader.TileMode.CLAMP));
                ring.setAlpha((int) (255 * logo));
                canvas.drawCircle(cx, cy, rr, ring);
            }
            canvas.restore();

            // The star itself: white at first, then clear, with a glowing edge as it opens.
            float white = Math.max(0f, 1f - p * 4f);
            if (white > 0) {
                fill.setAlpha((int) (255 * white));
                canvas.drawPath(star, fill);
            }
            float glow = Math.max(0f, 1f - p * 1.25f);
            if (glow > 0) {
                edge.setStrokeWidth((3 + 5 * p) * u);
                edge.setShader(new android.graphics.LinearGradient(cx - 20 * k * u, cy - 20 * k * u, cx + 20 * k * u, cy + 20 * k * u,
                        Color.parseColor("#D9CEFF"), Color.parseColor("#FF9EB5"), android.graphics.Shader.TileMode.CLAMP));
                edge.setAlpha((int) (255 * glow));
                canvas.drawPath(star, edge);
            }
        }
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
            main.postDelayed(LauncherActivity.this::revealWhenDrawn, 3000);
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
            main.post(LauncherActivity.this::revealWhenDrawn);
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
