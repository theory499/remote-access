# Remote Desktop over Firebase

A fully functional remote desktop suite that lets an Android phone view and
control a desktop computer over the internet. All transport and signalling
goes through Firebase end-to-end; the media path uses WebRTC negotiated
through the Firebase Realtime Database.

## Repository layout

```
remote-access/
├── desktop/              Electron application (host) - Windows, macOS, Linux
├── mobile/               Android native client (Kotlin)
├── firebase/             Firebase Realtime Database security rules
└── docs/                 Architecture, protocol, and setup documentation
```

The desktop application captures its own screen and forwards mouse and
keyboard input received from the phone to the underlying operating system.
The Android application renders the desktop's video stream and sends touch
and keyboard events back over a WebRTC data channel.

## Quick start

1. Create a Firebase project (see `docs/FIREBASE_SETUP.md`).
2. Drop the generated config into `desktop/src/shared/firebase-config.js`
   and `mobile/app/google-services.json`.
3. Install and run the desktop host:
   ```
   cd desktop
   npm install
   npm start
   ```
   The desktop app shows a six-character pairing code.
4. Build and install the Android client:
   ```
   cd mobile
   # First time only: generate the Gradle wrapper.
   gradle wrapper
   ./gradlew installDebug
   ```
   Launch the app, sign in, type the pairing code, and start controlling.

## Documentation

- `docs/ARCHITECTURE.md` - end-to-end design, components, threading model.
- `docs/PROTOCOL.md` - input event protocol over the WebRTC data channel.
- `docs/FIREBASE_SETUP.md` - step-by-step Firebase project setup.
- `docs/TESTING.md` - running unit, integration, and end-to-end tests.

## Testing

```
# Desktop unit + integration tests
cd desktop && npm test

# Android JVM-safe verification (no Android SDK required)
cd mobile/verify && gradle test

# Android full unit tests (requires Android SDK)
cd mobile && ./gradlew test

# Android instrumented tests (requires connected device/emulator)
cd mobile && ./gradlew connectedAndroidTest

# Or run everything that can run in your environment:
./scripts/test-all.sh
```

The current verified counts on a clean checkout are:

- Desktop: 68 unit + integration tests
- Android (JVM verification): 26 unit tests covering input encoding, surface
  mapping, pairing code validation, and signalling payload serialisation
- Android (full): adds Firebase signalling, WebRTC, and instrumented Activity
  tests once the Android SDK is available
