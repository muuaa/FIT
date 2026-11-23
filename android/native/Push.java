package io.github.muuaa.bettertogether;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

/** Shared helpers for native notifications. */
final class Push {
    static final String PREFS = "push";
    static final String TOKEN = "fcm_token";
    static final String CHANNEL = "reminders";

    private Push() {}

    static String token(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(TOKEN, null);
    }

    static void saveToken(Context c, String token) {
        if (token == null || token.isEmpty()) return;
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(TOKEN, token).apply();
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, c.getString(R.string.pushChannelName), NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(c.getString(R.string.pushChannelDescription));
        nm.createNotificationChannel(ch);
    }
}
