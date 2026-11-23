# Better Together for Android (APK)

A Trusted Web Activity wrapper around https://muuaa.github.io/FIT/ built with Bubblewrap.
The app inside updates automatically with the website; rebuild only to change the icon, name or splash.

- `twa-manifest.json`: wrapper settings (package `io.github.muuaa.bettertogether`).
- `assetlinks.json`: must be served at `https://muuaa.github.io/.well-known/assetlinks.json`
  (repo `muuaa/muuaa.github.io`) so Android trusts the app: no address bar, and
  notifications come from the app.
- The signing key is **not** in this repo. Keep `better-together.keystore` and its password
  private; future APKs must be signed with the same key to install as updates.

## Native notifications (Firebase)

`native/` holds the Java files that replace the Bubblewrap-generated ones in
`app/src/main/java/io/github/muuaa/bettertogether/`. They show notifications as the app's own
(no website link). To build: add `classpath 'com.google.gms:google-services:4.4.2'` and
`mavenCentral()` to the top-level `build.gradle`, apply `com.google.gms.google-services` and add
`firebase-bom` + `firebase-messaging` in `app/build.gradle`, register `.MessagingService` (action
`com.google.firebase.MESSAGING_EVENT`) in the manifest, and put `google-services.json` in `app/`
(not committed). The server sends through Firebase when the `FCM_SERVICE_ACCOUNT` secret is set.
