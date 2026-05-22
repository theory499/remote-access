# Component index

A flat lookup of every named component on both sides. Use this to jump
straight from a name in code or a stack trace to the file and the
documentation section that explains it.

## Desktop (Electron)

| Name | File | Documented in |
| --- | --- | --- |
| `InputController` | `desktop/src/main/input-controller.js` | [DESKTOP.md](DESKTOP.md#srcmaininput-controllerjs), [INPUT_HANDLING.md](INPUT_HANDLING.md) |
| `FirebaseSignaling` | `desktop/src/main/firebase-signaling.js` | [DESKTOP.md](DESKTOP.md#srcmainfirebase-signalingjs), [CONNECTION_FLOW.md](CONNECTION_FLOW.md) |
| `SessionController` | `desktop/src/main/session-controller.js` | [DESKTOP.md](DESKTOP.md#srcmainsession-controllerjs), [CONNECTION_FLOW.md](CONNECTION_FLOW.md) |
| `ConfigStore` | `desktop/src/main/config-store.js` | [SETUP_WIZARD.md](SETUP_WIZARD.md) |
| `probeFirebaseWebConfig` | `desktop/src/main/config-validator.js` | [SETUP_WIZARD.md](SETUP_WIZARD.md) |
| `generateMobileQr` | `desktop/src/main/qr-generator.js` | [SETUP_WIZARD.md](SETUP_WIZARD.md) |
| `listScreenSources`, `selectPrimaryScreen` | `desktop/src/main/screen-capture.js` | [DESKTOP.md](DESKTOP.md#srcmainscreen-capturejs), [SCREEN_SHARING.md](SCREEN_SHARING.md) |
| `validate`, `parse`, `encode` | `desktop/src/shared/protocol.js` | [DESKTOP.md](DESKTOP.md#srcsharedprotocoljs), [PROTOCOL.md](PROTOCOL.md) |
| `validateFirebaseWebConfig` and friends | `desktop/src/shared/backend-config.js` | [SETUP_WIZARD.md](SETUP_WIZARD.md) |
| `generate`, `isValid` | `desktop/src/shared/session-id.js` | [DESKTOP.md](DESKTOP.md#srcsharedsession-idjs) |
| `window.api.*` | `desktop/src/preload/preload.js` | [DESKTOP.md](DESKTOP.md#srcpreloadpreloadjs) |
| `bootstrap`, `negotiate`, `attachDataChannel`, `restart` | `desktop/src/renderer/renderer.js` | [DESKTOP.md](DESKTOP.md#srcrendererrendererjs) |
| Setup wizard renderer | `desktop/src/renderer/setup.{html,js}` | [SETUP_WIZARD.md](SETUP_WIZARD.md) |

## Android

| Name | File | Documented in |
| --- | --- | --- |
| `RemoteDesktopApp` | `mobile/android/app/src/main/java/com/remotedesktop/RemoteDesktopApp.kt` | [ANDROID.md](ANDROID.md#remotedesktopappkt) |
| `FirebaseConfig` | `mobile/android/.../config/FirebaseConfig.kt` | [ANDROID.md](ANDROID.md#configfirebaseconfigkt) |
| `ConfigStore` | `mobile/android/.../config/ConfigStore.kt` | [ANDROID.md](ANDROID.md#configconfigstorekt) |
| `MainActivity` | `mobile/android/.../ui/MainActivity.kt` | [ANDROID.md](ANDROID.md#uimainactivitykt) |
| `QrScannerActivity` | `mobile/android/.../ui/QrScannerActivity.kt` | [ANDROID.md](ANDROID.md#uiqrscanneractivitykt) |
| `RemoteControlActivity` | `mobile/android/.../ui/RemoteControlActivity.kt` | [ANDROID.md](ANDROID.md#uiremotecontrolactivitykt) |
| `InputEventEncoder` | `mobile/android/.../input/InputEventEncoder.kt` | [ANDROID.md](ANDROID.md#inputinputeventencoderkt), [INPUT_HANDLING.md](INPUT_HANDLING.md) |
| `PairingCode` | `mobile/android/.../input/PairingCode.kt` | [ANDROID.md](ANDROID.md#inputpairingcodekt) |
| `RemoteSurfaceController` | `mobile/android/.../input/RemoteSurfaceController.kt` | [ANDROID.md](ANDROID.md), [INPUT_HANDLING.md](INPUT_HANDLING.md) |
| `AndroidKeyMapper` | `mobile/android/.../input/AndroidKeyMapper.kt` | [ANDROID.md](ANDROID.md) |
| `SdpPayload`, `IceCandidatePayload` | `mobile/android/.../signaling/Payloads.kt` | [ANDROID.md](ANDROID.md) |
| `SignalingClient` | `mobile/android/.../signaling/SignalingClient.kt` | [ANDROID.md](ANDROID.md), [CONNECTION_FLOW.md](CONNECTION_FLOW.md) |
| `WebRTCClient` | `mobile/android/.../webrtc/WebRTCClient.kt` | [ANDROID.md](ANDROID.md), [SCREEN_SHARING.md](SCREEN_SHARING.md) |

## iOS

| Name | File | Documented in |
| --- | --- | --- |
| `RemoteDesktopApp` | `mobile/ios/RemoteDesktop/Sources/RemoteDesktopApp.swift` | [IOS.md](IOS.md#remotedesktopappswift) |
| `AppState` | `mobile/ios/.../Sources/AppState.swift` | [IOS.md](IOS.md#appstateswift) |
| `ConfigStore` | `mobile/ios/.../Sources/ConfigStore.swift` | [IOS.md](IOS.md) |
| `FirebaseConfig` | `mobile/ios/.../Sources/FirebaseConfig.swift` | [IOS.md](IOS.md#firebaseconfigswift) |
| `ContentView`, `ScannerScreen`, `MainScreen` | `mobile/ios/.../Sources/ContentView.swift` | [IOS.md](IOS.md#contentviewswift) |
| `QRScannerView` | `mobile/ios/.../Sources/QRScannerView.swift` | [IOS.md](IOS.md#qrscannerviewswift) |
| `RemoteControlView`, `RemoteControlViewModel` | `mobile/ios/.../Sources/RemoteControlView.swift` | [IOS.md](IOS.md#remotecontrolviewswift) |
| `SignalingClient` | `mobile/ios/.../Sources/SignalingClient.swift` | [IOS.md](IOS.md), [CONNECTION_FLOW.md](CONNECTION_FLOW.md) |
| `WebRTCClient` | `mobile/ios/.../Sources/WebRTCClient.swift` | [IOS.md](IOS.md), [SCREEN_SHARING.md](SCREEN_SHARING.md) |
| `InputEventEncoder` | `mobile/ios/.../Sources/InputEventEncoder.swift` | [IOS.md](IOS.md) |
| `PairingCode` | `mobile/ios/.../Sources/PairingCode.swift` | [IOS.md](IOS.md) |
| `RemoteSurfaceController` | `mobile/ios/.../Sources/RemoteSurfaceController.swift` | [IOS.md](IOS.md) |

## Firebase

| Name | File | Documented in |
| --- | --- | --- |
| Realtime Database security rules | `firebase/database.rules.json` | [SECURITY.md](SECURITY.md) |

## Tests and verification

| Name | File | Documented in |
| --- | --- | --- |
| Desktop test mocks | `desktop/tests/mocks/*.js` | [TESTING.md](TESTING.md) |
| Fake Realtime Database | `desktop/tests/integration/fake-firebase.js` | [TESTING.md](TESTING.md) |
| Mobile JVM verification project | `mobile/verify/` | [TESTING.md](TESTING.md) |

## Scripts

| Name | File | Documented in |
| --- | --- | --- |
| Run-everything test script | `scripts/test-all.sh` | [TESTING.md](TESTING.md), [DEVELOPMENT.md](DEVELOPMENT.md) |
