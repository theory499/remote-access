# Architecture

## Overview

```
+----------------------+                  +----------------------+
|  Desktop (Electron)  |                  |  Android (Kotlin)    |
|                      |                  |                      |
|  Screen capture  --->|       WebRTC     |<--- SurfaceViewRender|
|                      |   video track    |                      |
|  Input simulator <---|<---data channel--|<--- Touch / keyboard |
|        ^             |                  |              ^       |
|        |             |                  |              |       |
|        +------ Firebase Realtime Database ------+------+       |
|                  (offer / answer / ICE candidates)             |
+----------------------+                  +----------------------+
```

The Firebase Realtime Database carries only the small WebRTC signalling
payloads (SDP descriptions and ICE candidates). All real-time media -
screen video and input events - flows directly between the two peers over
WebRTC once the connection is established.

## Components

### Desktop host

| Module                                       | Responsibility |
| -------------------------------------------- | --- |
| `src/main/main.js`                           | Electron entry point, window lifecycle |
| `src/main/firebase-signaling.js`             | Reads / writes signalling payloads in Realtime Database |
| `src/main/webrtc-host.js`                    | Builds the `RTCPeerConnection`, attaches the screen track and the input data channel |
| `src/main/screen-capture.js`                 | Acquires a desktop `MediaStream` via `desktopCapturer` |
| `src/main/input-controller.js`               | Translates protocol events into OS-level mouse / keyboard actions |
| `src/main/session-controller.js`             | Orchestrates pairing code, signalling, peer connection |
| `src/preload/preload.js`                     | IPC bridge exposed to the renderer |
| `src/renderer/`                              | Pairing UI - displays the code, status, and disconnect button |
| `src/shared/protocol.js`                     | Wire protocol constants and validation |
| `src/shared/firebase-config.js`              | Firebase project credentials (user-supplied) |

The renderer process is responsible for the WebRTC peer connection because
`navigator.mediaDevices.getUserMedia` and `RTCPeerConnection` are only
available in a renderer context. The main process owns input simulation
(via `@nut-tree-fork/nut-js`) because it requires Node access to native
modules. The two communicate through a typed IPC bridge declared in the
preload script.

### Android client

| Module                                       | Responsibility |
| -------------------------------------------- | --- |
| `ui/MainActivity.kt`                         | Sign-in and pairing-code entry |
| `ui/RemoteControlActivity.kt`                | Hosts the `SurfaceViewRenderer` and input overlay |
| `firebase/FirebaseAuthClient.kt`             | Anonymous sign-in with Firebase Auth |
| `signaling/SignalingClient.kt`               | Reads / writes signalling payloads in Realtime Database |
| `webrtc/WebRTCClient.kt`                     | Builds the `PeerConnection`, attaches the remote video sink and the input data channel |
| `input/InputEventEncoder.kt`                 | Encodes touch / keyboard input into protocol JSON |
| `input/RemoteSurfaceController.kt`           | Maps screen-space touch events onto normalised remote coordinates |

## Pairing and signalling

1. Desktop host signs in anonymously, generates a six-character pairing
   code, and writes its presence to
   `sessions/{code}/host` with a server timestamp.
2. The user types the same code into the Android app. The app reads
   `sessions/{code}/host` to confirm a host is online, then writes its own
   presence to `sessions/{code}/client`.
3. Desktop, seeing the client appear, creates an offer SDP and writes it
   to `sessions/{code}/offer`.
4. Android reads the offer, sets it as remote description, generates an
   answer, and writes it to `sessions/{code}/answer`.
5. Both peers continuously stream ICE candidates into
   `sessions/{code}/iceCandidates/{host|client}/{candidateId}`.
6. Once the WebRTC connection moves to `connected`, the data channel and
   video track are live; signalling traffic stops.
7. When either side disconnects, the corresponding presence node is
   removed via `onDisconnect()`, allowing the peer to detect the loss
   even if it never sends an explicit message.

## Input protocol

The data channel carries newline-delimited JSON objects. The full schema
is in `docs/PROTOCOL.md`. Co-ordinates are normalised to `[0, 1]` so the
client doesn't need to know the desktop's native resolution.

## Security model

- Database rules require authentication and limit each session node to
  the two participants.
- The pairing code is a one-shot identifier; the host removes
  `sessions/{code}` on disconnect.
- The Android client never receives the desktop's native screen
  resolution; all coordinates are normalised.
- Input simulation runs in the desktop main process, isolated from the
  renderer that talks to Firebase / WebRTC.

## Threading and lifecycle

### Desktop

- Electron main process owns the IPC handlers and the
  `@nut-tree-fork/nut-js` input controller.
- Renderer process owns the WebRTC `RTCPeerConnection` and the Firebase
  client.
- Renderer forwards each decoded input event to the main process via
  `window.api.sendInputEvent(...)`.

### Android

- Firebase listeners run on the database's worker thread; results are
  posted to the main thread before touching the UI.
- WebRTC callbacks run on the WebRTC signalling thread; data channel
  sends are dispatched on a single-threaded executor to preserve order.
- Touch and key events are captured on the main thread and serialised
  through the same executor.
