# Proxia — iOS client

A native SwiftUI client. Firebase is initialised at runtime from a
QR-scanned configuration, so this app ships **without** any
`GoogleService-Info.plist` baked into the bundle.

## Prerequisites

- macOS with Xcode 15 or newer.
- CocoaPods: `sudo gem install cocoapods` or `brew install cocoapods`.
- XcodeGen: `brew install xcodegen`.

## First-time setup

```sh
cd mobile/ios
xcodegen generate              # generates RemoteDesktop.xcodeproj from project.yml
pod install                    # generates RemoteDesktop.xcworkspace and downloads Firebase + WebRTC
open RemoteDesktop.xcworkspace
```

In Xcode:
1. Select the **RemoteDesktop** target.
2. Set **Signing & Capabilities &rarr; Team** to your developer team.
3. Optionally change the **Bundle Identifier** if `com.remotedesktop.ios`
   conflicts with an existing app.
4. Choose a destination (simulator or device) and **Run**.

## How it works

On first launch the app finds no stored configuration in
`UserDefaults`, so it opens the QR scanner. Scan the QR code shown by
the desktop host's setup wizard. The app parses the JSON payload,
stores the iOS-specific fields, and initialises Firebase via
`FirebaseApp.configure(options:)` at runtime. From then on, every
launch goes straight to the pairing-code screen.

Tap **Change backend configuration** to clear the stored credentials
and re-scan.

## File map

| File | Role |
| --- | --- |
| `Sources/RemoteDesktopApp.swift` | `@main` SwiftUI app entry. |
| `Sources/AppState.swift` | Observable object that owns the routing state and Firebase init. |
| `Sources/ConfigStore.swift` | `UserDefaults` wrapper for the persisted config. |
| `Sources/FirebaseConfig.swift` | Data structure + QR payload parser. |
| `Sources/PairingCode.swift` | Six-character pairing code validator (matches desktop and Android). |
| `Sources/ContentView.swift` | Routes between QR scanner and main pairing-code screen. |
| `Sources/QRScannerView.swift` | AVFoundation camera + QR detection. |
| `Sources/RemoteControlView.swift` | Live session UI - SurfaceView, touch gestures. |
| `Sources/SignalingClient.swift` | Firebase Realtime Database wrapper for signalling. |
| `Sources/WebRTCClient.swift` | `RTCPeerConnection` wrapper. |
| `Sources/InputEventEncoder.swift` | Builds protocol JSON for touch / keyboard input. |
| `Sources/RemoteSurfaceController.swift` | Maps touch coordinates to normalised remote coordinates. |
| `RemoteDesktopTests/FirebaseConfigTests.swift` | Unit tests for config parsing, pairing code, and the encoder. |

## Tests

```sh
xcodebuild -workspace RemoteDesktop.xcworkspace \
           -scheme RemoteDesktop \
           -destination 'platform=iOS Simulator,name=iPhone 15' \
           test
```

## Limitations of this implementation

- Long-press right-click currently sends a click at the screen centre,
  not at the press location (SwiftUI's `LongPressGesture` does not
  expose the touch location). A `simultaneousGesture` with
  `DragGesture(minimumDistance: 0)` can be added to track the location.
- The hardware-keyboard handler is omitted. Most iOS users will rely on
  the soft keyboard, which is forwarded as `type` messages by the
  `TextField` on the main screen if/when added there.
- This iOS source set has been verified for structural correctness only;
  it has not been compiled in CI because the build environment is
  Linux. Expect to fix one or two small issues in Xcode the first time
  you build (typically signing or a missing `Capability`).
