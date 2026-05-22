# Remote Desktop over Firebase

A fully functional remote desktop suite that lets an Android phone or
an iPhone view and control a desktop computer over the internet. All
transport and signalling go through Firebase end-to-end; the media
path uses WebRTC negotiated through the Firebase Realtime Database.

## Repository layout

```
remote-access/
├── desktop/            Electron application (host) - Windows, macOS, Linux
├── mobile/
│   ├── android/        Android native client (Kotlin)
│   └── ios/            iOS native client (Swift / SwiftUI)
├── firebase/           Realtime Database security rules
└── docs/               Architecture, protocol, setup, testing
```

The desktop application captures its own screen and forwards mouse and
keyboard input received from the phone to the underlying operating
system. Each mobile client renders the desktop's video stream and
sends touch and keyboard events back over a WebRTC data channel.

## How configuration works

Neither the desktop nor the mobile apps ship with any baked-in Firebase
credentials. On first launch:

1. The desktop opens a **first-run setup wizard** that asks you to
   paste your Firebase web / Android / iOS configuration, validates it
   against your live Firebase project by signing in and writing a
   probe record, and generates a **QR code** containing the mobile
   credentials.
2. The mobile apps open a **QR scanner** that reads the QR code,
   stores the platform-specific Firebase credentials locally, and
   initialises Firebase at runtime via `FirebaseOptions` —
   no `google-services.json` or `GoogleService-Info.plist` files in
   the source tree.

You can re-run the wizard at any time via "Change backend configuration"
on either side. The wizard is documented in
[`docs/SETUP_WIZARD.md`](docs/SETUP_WIZARD.md).

## Quick start

1. Create a Firebase project, enable **Anonymous Authentication**, and
   create a **Realtime Database** (see [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md)).
2. Run the desktop host. The first-run wizard guides you through
   pasting credentials and generates a pairing QR code.
   ```
   cd desktop && npm install && npm start
   ```
3. Build and install one of the mobile clients, then scan the QR code:
   ```
   # Android
   cd mobile/android
   gradle wrapper --gradle-version 8.14.3
   ./gradlew installDebug
   ```
   ```
   # iOS
   cd mobile/ios
   xcodegen generate && pod install
   open RemoteDesktop.xcworkspace
   ```
4. Once paired, the desktop shows a six-character session code. Type
   it into the mobile app and start controlling.

## Documentation

The complete documentation hub is in [`docs/README.md`](docs/README.md).

| You want to | Read |
| --- | --- |
| Get an overview of the product | [`docs/OVERVIEW.md`](docs/OVERVIEW.md) |
| Set up Firebase | [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) |
| Understand the setup wizard | [`docs/SETUP_WIZARD.md`](docs/SETUP_WIZARD.md) |
| Understand how the desktop and phone connect | [`docs/CONNECTION_FLOW.md`](docs/CONNECTION_FLOW.md) |
| Understand how you see the desktop on the phone | [`docs/SCREEN_SHARING.md`](docs/SCREEN_SHARING.md) |
| Understand how taps and keystrokes reach the desktop | [`docs/INPUT_HANDLING.md`](docs/INPUT_HANDLING.md) |
| See the wire protocol | [`docs/PROTOCOL.md`](docs/PROTOCOL.md) |
| Find a specific component | [`docs/COMPONENTS.md`](docs/COMPONENTS.md), [`docs/DESKTOP.md`](docs/DESKTOP.md), [`docs/ANDROID.md`](docs/ANDROID.md), [`docs/IOS.md`](docs/IOS.md) |
| Develop and contribute | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md), [`docs/TESTING.md`](docs/TESTING.md) |
| Diagnose a problem | [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) |
| Review the security model | [`docs/SECURITY.md`](docs/SECURITY.md) |
| Look up a term | [`docs/GLOSSARY.md`](docs/GLOSSARY.md) |

## Testing

```
# Desktop unit + integration tests
cd desktop && npm test

# Android JVM-safe verification (no Android SDK required)
cd mobile/android/verify && gradle test

# Android full unit tests (Android SDK required)
cd mobile/android && ./gradlew test

# iOS tests (Xcode required)
cd mobile/ios && xcodebuild -scheme RemoteDesktop -destination 'platform=iOS Simulator,name=iPhone 15' test

# Or run everything that can run in your environment:
./scripts/test-all.sh
```

Current counts on a clean checkout:

- Desktop: **109** unit + integration tests.
- Android JVM verification: **36** tests covering input encoding, surface
  mapping, pairing code, signalling payloads, and Firebase config
  parsing.
- iOS: parser, pairing code, and encoder unit tests (run inside Xcode).
- Android (full): adds Firebase signalling, WebRTC, and instrumented
  Activity tests when the Android SDK is available.
