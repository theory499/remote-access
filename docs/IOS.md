# iOS module reference

A file-by-file tour of the iOS SwiftUI client. The iOS client lives
under `mobile/ios/` and mirrors the Android client's architecture
([ANDROID.md](ANDROID.md)) but is built around AVFoundation,
SwiftUI, and the GoogleWebRTC pod.

## Directory map

```
mobile/ios/
├── project.yml                              XcodeGen project spec
├── Podfile                                  Firebase + WebRTC pods
├── README.md                                build and run instructions
├── RemoteDesktop/
│   ├── Resources/
│   │   └── Info.plist                       NSCameraUsageDescription, scheme
│   └── Sources/
│       ├── RemoteDesktopApp.swift           @main SwiftUI entry
│       ├── AppState.swift                   ObservableObject - routing + Firebase init
│       ├── ContentView.swift                Routes between scanner and main
│       ├── ConfigStore.swift                UserDefaults wrapper
│       ├── FirebaseConfig.swift             QR payload parser
│       ├── PairingCode.swift                Six-character code validator
│       ├── QRScannerView.swift              AVFoundation camera + QR detection
│       ├── RemoteControlView.swift          Live session UI + view model
│       ├── SignalingClient.swift            FirebaseDatabase wrapper
│       ├── WebRTCClient.swift               RTCPeerConnection wrapper
│       ├── InputEventEncoder.swift          Protocol JSON encoder
│       └── RemoteSurfaceController.swift    Touch -> normalised mapping
└── RemoteDesktopTests/
    └── FirebaseConfigTests.swift            XCTest for parser, encoder, pairing code
```

There is **no** `GoogleService-Info.plist` baked into the bundle.
Firebase is configured at runtime from a QR-scanned payload.

## Build environment

The build is not exercised by CI because the test runners are Linux.
Generate the Xcode project locally with:

```sh
cd mobile/ios
xcodegen generate
pod install
open RemoteDesktop.xcworkspace
```

See [`mobile/ios/README.md`](../mobile/ios/README.md) for the full
walkthrough including signing.

## Configuration flow (QR-driven)

Identical conceptually to Android:

1. `RemoteDesktopApp` creates an `AppState` and calls `bootstrap()`.
2. `bootstrap()` checks `ConfigStore`. If a stored config exists,
   `initialiseFirebase(with:)` runs (`FirebaseApp.configure(options:)`),
   `signInAnonymouslyIfNeeded()` runs, and the route flips to `.main`.
3. Otherwise the route stays at `.scanner`, and SwiftUI shows
   `ScannerScreen`, which hosts `QRScannerView`.
4. When the scanner reports a valid payload, `apply(config:)` saves
   the config, initialises Firebase, and flips the route.
5. `MainScreen` is then visible. Tap **Change backend configuration**
   to call `appState.reset()`, which clears the store and returns to
   `.scanner`.

## RemoteDesktopApp.swift

```swift
@main
struct RemoteDesktopApp: App {
    @StateObject private var appState = AppState()
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onAppear { appState.bootstrap() }
        }
    }
}
```

## AppState.swift

`@MainActor` `ObservableObject` exposing:

- `route: AppRoute` (`.scanner` or `.main`).
- `authUid: String?` (populated after anonymous sign-in).
- `configError: String?` (surfaced in the scanner UI when initialisation fails).

Key methods:

| Method | Effect |
| --- | --- |
| `bootstrap()` | Loads any stored config, initialises Firebase, signs in. |
| `apply(config:)` | Initialises Firebase from a freshly-scanned config, persists it, then signs in. |
| `reset()` | Clears the store and returns to the scanner. |

## ConfigStore.swift

`UserDefaults` wrapper that serialises `FirebaseConfig` as JSON under
key `backend_config_firebase_v1`.

## FirebaseConfig.swift

```swift
struct FirebaseConfig: Equatable, Codable {
    let apiKey: String
    let googleAppId: String
    let projectId: String
    let databaseURL: String
    let bundleId: String

    static func fromQrPayload(_ raw: String) -> FirebaseConfig?
}
```

The parser validates `v == 1`, `backend == "firebase"`, and the
presence of all five non-empty strings inside the `ios` block of the
QR payload.

## QRScannerView.swift

A `UIViewControllerRepresentable` that hosts an
`AVCaptureMetadataOutput` configured for the `.qr` object type. The
first non-handled QR string is delivered to the `onResult` callback,
which `ContentView` routes into `appState.apply(config:)`.

## ContentView.swift

Two private `View`s:

- `ScannerScreen` — overlays a hint and any error on the camera
  preview.
- `MainScreen` — pairing-code text field, sign-in spinner, Connect
  button, and a `fullScreenCover` that mounts `RemoteControlView`.

## RemoteControlView.swift

The live session screen. It wraps an `RTCMTLVideoView` in a
`UIViewRepresentable`, attaches drag / tap / long-press gestures, and
owns a `RemoteControlViewModel` (`@MainActor ObservableObject`) that
wires up the `SignalingClient` and `WebRTCClient`.

Behaviour:
- Drag &rarr; `mousemove` to the latest normalised point.
- Tap &rarr; `click(x, y, "left")`.
- Long-press &rarr; `click(0.5, 0.5, "right")` — see "limitations" in
  the iOS README for the planned improvement.
- Incoming `ping` messages are echoed as `pong`.

## SignalingClient.swift

Same surface as Android's `SignalingClient.kt`:
`registerPresence`, `watchPeerPresence`, `sendOffer`, `watchOffer`,
`sendAnswer`, `watchAnswer`, `sendIceCandidate`, `watchIceCandidates`,
`dispose`. Each `watch*` method stores its `(ref, handle)` pair so
`dispose()` can detach every listener in one call.

## WebRTCClient.swift

`NSObject`-based wrapper around `RTCPeerConnection` and
`RTCDataChannel`. Implements `RTCPeerConnectionDelegate` and
`RTCDataChannelDelegate`. Public surface:

- `createConnection(iceServers:)` — builds the peer with default STUN.
- `setRemoteOffer(_:completion:)` and `createAnswer(completion:)`.
- `addRemoteIceCandidate(_:)`.
- `sendData(_:)` for outbound messages.
- `dispose()` to close both the data channel and the peer connection.

The factory and SSL initialisation are wrapped in a single `static let`
so they run exactly once per process — symmetric to Android's
`PeerConnectionFactory.initialize`.

## InputEventEncoder.swift

Functional mirror of the Android and desktop encoders. Returns plain
JSON strings; throws on out-of-range keys, buttons, or modifiers.

## RemoteSurfaceController.swift

Maps a `CGPoint` from the live `RTCMTLVideoView` size to a
`NormalisedPoint` in `[0, 1]`. The view model calls `update(size:)`
from the `updateUIView` of the `UIViewRepresentable`.

## Tests

`RemoteDesktopTests/FirebaseConfigTests.swift` contains three test
classes:

- `FirebaseConfigTests` — happy path, wrong version, missing iOS
  block, malformed input.
- `PairingCodeTests` — alphabet filtering and validation.
- `InputEventEncoderTests` — coordinate clamping, unknown-key
  rejection, text truncation.

Run with:

```sh
xcodebuild -workspace RemoteDesktop.xcworkspace \
           -scheme RemoteDesktop \
           -destination 'platform=iOS Simulator,name=iPhone 15' \
           test
```

## Limitations

- The repository's CI cannot compile this target (no Xcode on Linux).
  Expect to fix one or two trivial Xcode-only issues the first time
  you build (signing, simulator destination, etc.).
- The long-press right-click currently sends a click at the screen
  centre. Switch the long-press to a custom drag-tracking gesture if
  you need positional right-clicks.
- The hardware-keyboard handler is not wired in. The on-screen
  keyboard route via the soft keyboard / `TextField` works.

## Cross-references

- [ANDROID.md](ANDROID.md) — the platform counterpart this file
  mirrors.
- [SETUP_WIZARD.md](SETUP_WIZARD.md) — how the QR code is generated.
- [PROTOCOL.md](PROTOCOL.md) — the wire format `InputEventEncoder`
  produces.
- [`mobile/ios/README.md`](../mobile/ios/README.md) — build and run
  instructions.
