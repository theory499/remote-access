# Product overview

## What it is

Proxia is a two-part application that
lets a person see and control their desktop computer from an Android
phone over the internet. The desktop runs an Electron application that
captures its own screen and accepts remote input. The phone runs a
native Android application that displays the desktop and forwards every
touch and keystroke back to it.

Both sides talk to each other directly via WebRTC. Everything else -
authentication, peer discovery, and the cryptographic handshake that
sets WebRTC up - happens through Firebase. There is no custom server
component to deploy.

## Who it is for

- Individuals who want to access their personal computer from their
  phone, the same way one might use TeamViewer, Chrome Remote Desktop,
  or RustDesk, but without trusting a third-party relay.
- Developers who want a small, readable reference implementation of
  WebRTC signalling over Firebase Realtime Database with anonymous
  authentication.
- Teams that already use Firebase and need a minimal-infrastructure
  pattern for peer-to-peer screen sharing.

## What it does

| Capability | Where it lives |
| --- | --- |
| Pair an Android phone with a desktop using a six-character code | `desktop/src/shared/session-id.js`, `mobile/.../input/PairingCode.kt` |
| Authenticate both peers against Firebase | `desktop/src/renderer/renderer.js`, `mobile/.../RemoteDesktopApp.kt` |
| Establish a WebRTC peer connection | `desktop/src/main/firebase-signaling.js`, `mobile/.../signaling/SignalingClient.kt`, `mobile/.../webrtc/WebRTCClient.kt` |
| Stream the desktop's screen to the phone | `desktop/src/main/screen-capture.js`, `desktop/src/renderer/renderer.js`, `mobile/.../ui/RemoteControlActivity.kt` |
| Send taps, drags, typed text, and modifier-aware keystrokes from the phone to the desktop | `mobile/.../input/*`, `desktop/src/shared/protocol.js`, `desktop/src/main/input-controller.js` |
| Detect disconnects on either side and surface them in the UI | `desktop/src/main/session-controller.js`, `mobile/.../ui/RemoteControlActivity.kt` |
| Measure round-trip latency | `desktop/src/renderer/renderer.js`, `mobile/.../ui/RemoteControlActivity.kt` |

## What it does not do

- It does not stream audio. Adding an audio track is a single addition
  to the desktop renderer (`getUserMedia({ audio: true, video: {...} })`)
  but is not enabled by default.
- It does not relay traffic through a TURN server. If both peers are
  behind symmetric NATs, the connection will fail. See
  [TROUBLESHOOTING.md](TROUBLESHOOTING.md#connection-stuck-at-checking).
- It does not include unattended access provisioning. Both peers must
  be on and signed in for a session to start.
- It does not yet ship a desktop client or a mobile host. The desktop
  is the host (the side being controlled), the phone is the client (the
  side doing the controlling).

## The shape of a session

```
1.  Desktop launches, signs in anonymously, generates code "K7P2QM",
    publishes its presence at sessions/K7P2QM/host.
2.  User opens the Android app, signs in anonymously, types "K7P2QM".
3.  Android publishes its presence at sessions/K7P2QM/client.
4.  Desktop sees the client appear, creates a WebRTC offer with the
    screen video track and an input data channel, writes the offer to
    sessions/K7P2QM/offer.
5.  Android reads the offer, applies it as a remote description, creates
    an answer, writes it to sessions/K7P2QM/answer.
6.  Both sides exchange ICE candidates through Firebase until WebRTC
    reports `connected`.
7.  Desktop video flows directly to the phone. Phone input flows
    directly to the desktop. Firebase is no longer in the path.
8.  Either side closes; the other side notices via presence removal and
    returns to its waiting state.
```

The exact mechanics of each step are in
[CONNECTION_FLOW.md](CONNECTION_FLOW.md).

## Design principles

1. **Firebase end to end.** Anything that needs to be brokered before
   the peers can talk goes through Firebase. There is no custom server.
2. **WebRTC for the hot path.** Once the connection exists, every byte
   of video and every input event travels peer to peer.
3. **No assumed resolutions.** The phone never needs to know the
   desktop's display dimensions; everything is normalised to `[0, 1]`.
4. **No proprietary native code.** The desktop uses `@nut-tree-fork/nut-js`
   - an open-source cross-platform input library - and Electron's
   built-in screen capture. The Android client uses the official
   `webrtc-sdk` library.
5. **The desktop is the source of truth for the host OS.** All actual
   OS-level mouse and keyboard simulation happens in one well-isolated
   module: `desktop/src/main/input-controller.js`.

## What to read next

- [ARCHITECTURE.md](ARCHITECTURE.md) for the component diagram and
  threading model.
- [CONNECTION_FLOW.md](CONNECTION_FLOW.md) for the per-message
  walkthrough of how a session is established.
