# Better Together for Android (APK)

A Trusted Web Activity wrapper around https://muuaa.github.io/FIT/ built with Bubblewrap.
The app inside updates automatically with the website; rebuild only to change the icon, name or splash.

- `twa-manifest.json`: wrapper settings (package `io.github.muuaa.bettertogether`).
- `assetlinks.json`: must be served at `https://muuaa.github.io/.well-known/assetlinks.json`
  (repo `muuaa/muuaa.github.io`) so Android trusts the app: no address bar, and
  notifications come from the app.
- The signing key is **not** in this repo. Keep `better-together.keystore` and its password
  private; future APKs must be signed with the same key to install as updates.
