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
| `listScreenSources`, `selectPrimaryScreen` | `desktop/src/main/screen-capture.js` | [DESKTOP.md](DESKTOP.md#srcmainscreen-capturejs), [SCREEN_SHARING.md](SCREEN_SHARING.md) |
| `validate`, `parse`, `encode` | `desktop/src/shared/protocol.js` | [DESKTOP.md](DESKTOP.md#srcsharedprotocoljs), [PROTOCOL.md](PROTOCOL.md) |
| `generate`, `isValid` | `desktop/src/shared/session-id.js` | [DESKTOP.md](DESKTOP.md#srcsharedsession-idjs) |
| `window.api.*` | `desktop/src/preload/preload.js` | [DESKTOP.md](DESKTOP.md#srcpreloadpreloadjs) |
| `bootstrap`, `negotiate`, `attachDataChannel`, `restart` | `desktop/src/renderer/renderer.js` | [DESKTOP.md](DESKTOP.md#srcrendererrendererjs) |

## Android

| Name | File | Documented in |
| --- | --- | --- |
| `RemoteDesktopApp` | `mobile/app/src/main/java/com/remotedesktop/RemoteDesktopApp.kt` | [MOBILE.md](MOBILE.md#remotedesktopappkt) |
| `MainActivity` | `mobile/.../ui/MainActivity.kt` | [MOBILE.md](MOBILE.md#uimainactivitykt) |
| `RemoteControlActivity` | `mobile/.../ui/RemoteControlActivity.kt` | [MOBILE.md](MOBILE.md#uiremotecontrolactivitykt) |
| `InputEventEncoder` | `mobile/.../input/InputEventEncoder.kt` | [MOBILE.md](MOBILE.md#inputinputeventencoderkt), [INPUT_HANDLING.md](INPUT_HANDLING.md) |
| `PairingCode` | `mobile/.../input/PairingCode.kt` | [MOBILE.md](MOBILE.md#inputpairingcodekt) |
| `RemoteSurfaceController` | `mobile/.../input/RemoteSurfaceController.kt` | [MOBILE.md](MOBILE.md#inputremotesurfacecontrollerkt), [INPUT_HANDLING.md](INPUT_HANDLING.md) |
| `AndroidKeyMapper` | `mobile/.../input/AndroidKeyMapper.kt` | [MOBILE.md](MOBILE.md#inputandroidkeymapperkt) |
| `SdpPayload`, `IceCandidatePayload` | `mobile/.../signaling/Payloads.kt` | [MOBILE.md](MOBILE.md#signalingpayloadskt) |
| `SignalingClient` | `mobile/.../signaling/SignalingClient.kt` | [MOBILE.md](MOBILE.md#signalingsignalingclientkt), [CONNECTION_FLOW.md](CONNECTION_FLOW.md) |
| `WebRTCClient` | `mobile/.../webrtc/WebRTCClient.kt` | [MOBILE.md](MOBILE.md#webrtcwebrtcclientkt), [SCREEN_SHARING.md](SCREEN_SHARING.md) |

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
