# Suttru Android APK

Packages the existing Angular application into a Capacitor 8 Android app. The APK contains the web build (including the offline reader) rather than loading the public website as its app shell. It uses the existing backend APIs and does not contain provider keys or backend secrets. The full Figma mobile redesign is a separate unfinished task.

## Build on GitHub

The **Android APK** workflow builds pull requests and pushes to `development`. After a successful run, download the **Suttru-Android-debug** artifact and unzip **Suttru-debug.apk**. This is a debug-signed testing app, with application ID `in.suttru.app.debug`, separate from a future release app. Enable installation from your chosen file manager when installing on an Android device.

No APK is checked into source control. The workflow must actually pass before claiming an APK exists. Native dependencies are locked to the package-lock.json captured from the successful first Android build; both local and CI builds use npm ci. A copy of the lockfile is retained with each successful APK build.

## Local build

Install Node 22+, Java 21, Android SDK platform 36/build tools 36.0.0 and Android Studio Otter (2025.2.1) or newer. Then, from the repository root:

```sh
npm ci --prefix web
npm ci --prefix mobile
npm run build --prefix web
cd mobile
MOBILE_API_BASE=https://tripmate-api-thiru-murugan3.onrender.com npm run prepare:web
npm run android:sync
npm run android:apk
```

The generated file is `mobile/dist/Suttru-debug.apk`. On Windows, set `MOBILE_API_BASE` in the environment before running `npm run prepare:web`. The generated `mobile/android` project can be opened in Android Studio for device testing. Android source and bundled web files are generated and ignored; the checked-in config and scripts recreate them.

`MOBILE_API_BASE` must be a public HTTPS backend origin, optionally ending in `/api/v1`. The packaging step sets the API URL only in the APK copy; the website's `public/config.js` is unchanged. GitHub uses the repository variable `SUTTRU_MOBILE_API_BASE`, with the existing Render backend as its default.

## Backend activation

The bundled origin is **https://localhost**. Capacitor's built-in **CapacitorHttp** transport is enabled for native `fetch`/`XMLHttpRequest` calls, so Angular requests use the native HTTPS client with the existing authorization headers. Website CORS settings are unchanged. If native HTTP is disabled later, the backend must explicitly allow `https://localhost` in addition to its existing web origins. Never add `*` or put provider keys into the APK.

Device verification must include login/token refresh, multipart document uploads and binary downloads; native HTTP transports can behave differently from the browser, particularly for large files. No authenticated device session has been tested yet.

## Native integration

- Android Back follows app history before exiting.
- External HTTPS provider links open through the native browser plugin.
- Documents and calendar exports use the Android share sheet with the actual fetched bytes; the website keeps its existing browser behavior.
- Temporary shared files stay in private cache, are scheduled for deletion, and are cleared on the next launch and sign-out. A receiver chosen by the user may retain its own copy.
- Saved offline trips and chosen documents use the existing account-scoped IndexedDB store. Native builds skip browser service-worker setup because the reader is bundled. Save packs online before travelling; offline edits and background flight push alerts are not added.
- No storage-wide or camera permissions are requested by this code. Native backup and cleartext network traffic are disabled during generation.
- The existing Suttru SVG is converted into Android launcher icons; no generated tourist images are introduced.

## Verification and release

Run `npm test --prefix mobile` for packaging checks, the web `test:native` suite for optional native file handling, and the Android workflow for compilation, lint and APK generation. Test login/logout, upload and sharing of a PDF, calendar export, source links, Back navigation, cold start in airplane mode, saved-trip access and the phone keyboard before distribution.

A release requires your persistent signing keystore and device validation; a debug APK is not a Play Store release. Fresh CI debug signing keys can require uninstalling a previous testing build, which removes that app's local offline packs. Keep signing material outside source control.
