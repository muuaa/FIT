package io.github.muuaa.bettertogether;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/** Shows reminders, nudges and partner updates as the app's own notifications (no website link). */
public class MessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(@NonNull String token) {
        Push.saveToken(this, token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> d = message.getData();
        String title = d.containsKey("title") ? d.get("title") : getString(R.string.appName);
        String body = d.containsKey("body") ? d.get("body") : "";
        String url = d.get("url");
        String tag = d.containsKey("tag") ? d.get("tag") : "better-together";

        Push.ensureChannel(this);
        Intent open = new Intent(this, LauncherActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (url != null && url.startsWith("https://muuaa.github.io/")) open.setData(Uri.parse(url));
        PendingIntent pi = PendingIntent.getActivity(this, tag.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder n = new NotificationCompat.Builder(this, Push.CHANNEL)
                .setSmallIcon(R.drawable.ic_notification_icon)
                .setColor(0xFFA89BFF)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi);
        try {
            NotificationManagerCompat.from(this).notify(tag, 1, n.build());
        } catch (SecurityException ignored) {
            // Notifications are switched off for the app.
        }
    }
}
