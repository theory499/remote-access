# Connection flow

This document walks the lifecycle of a single connection from the
moment the desktop launches to the moment one side disconnects. Every
step lists the code that runs and the Firebase paths that get touched.

> Symbols used below: `H` is the desktop (host), `C` is the Android
> phone (client), `FB` is the Firebase Realtime Database.

## Phase 0 - Both apps launch

### Desktop

| Step | Code | Effect |
| --- | --- | --- |
| 0.1 | `desktop/src/main/main.js` runs in Electron's main process | Creates a `BrowserWindow`, registers IPC handlers (`screen:list-sources`, `input:event`, `input:screen-size`), loads `src/renderer/index.html`. |
| 0.2 | `src/renderer/renderer.js` bootstraps in the renderer process | Calls `initializeApp(firebaseConfig)`, then `signInAnonymously(auth)`. |
| 0.3 | Once the auth state changes to a non-null user, `startSession()` runs | Generates a six-character pairing code in `src/shared/session-id.js` using `globalThis.crypto.getRandomValues`. |
| 0.4 | `SessionController.start({ uid })` in `src/main/session-controller.js` | Constructs a `FirebaseSignaling` for the host role and code, calls `registerPresence`. |
| 0.5 | `FirebaseSignaling.registerPresence` in `src/main/firebase-signaling.js` | Writes `{ uid, createdAt: ServerValue.TIMESTAMP }` to `FB/sessions/{code}/host` and arms `onDisconnect().remove()` so the entry disappears automatically if the desktop dies. |
| 0.6 | The renderer also subscribes to `sessions/{code}/client` via `watchPeerPresence` | When that node appears the renderer triggers Phase 2 (offer creation). |
| 0.7 | UI updates | Pairing code becomes visible; status reads "Waiting for client". |

### Mobile

| Step | Code | Effect |
| --- | --- | --- |
| 0.8 | `mobile/.../RemoteDesktopApp.kt#onCreate` | Initialises FirebaseApp and disables database disk persistence. |
| 0.9 | `mobile/.../ui/MainActivity.kt#onCreate` | Triggers anonymous sign-in via `FirebaseAuth.signInAnonymously()`. |
| 0.10 | User types the six characters into the `TextInputEditText` | A `TextWatcher` normalises the input through `PairingCode.normalise`; the Connect button enables once `PairingCode.isValid` returns true. |
| 0.11 | User presses Connect | `MainActivity` launches `RemoteControlActivity` with the code as an Intent extra. |

## Phase 1 - Mobile announces itself

| Step | Code | Firebase write |
| --- | --- | --- |
| 1.1 | `RemoteControlActivity#startSession` constructs `SignalingClient(role = CLIENT, sessionCode, uid)` | - |
| 1.2 | Calls `WebRTCClient.createConnection(DEFAULT_ICE_SERVERS)` | - |
| 1.3 | Calls `SignalingClient.registerPresence` | Writes `FB/sessions/{code}/client = { uid, createdAt }`. |
| 1.4 | Mobile subscribes to `FB/sessions/{code}/offer`, `answer`, and `iceCandidates/host` | - |

Desktop sees the new `client` node via the listener wired up in step 0.6
and proceeds to Phase 2.

## Phase 2 - Desktop creates the offer

When the renderer's `watchPeerPresence(client)` callback fires with a
non-null value, the renderer's `negotiate()` runs.

| Step | Code | Detail |
| --- | --- | --- |
| 2.1 | `negotiate()` guards against being called twice with `isNegotiating` flag | - |
| 2.2 | Calls `buildPeerConnection()` | Creates an `RTCPeerConnection` with `iceServers` set to Google's public STUN servers. Wires up `onicecandidate`, `onconnectionstatechange`, `oniceconnectionstatechange`. |
| 2.3 | Calls `captureScreen()` | Uses `window.api.listScreenSources()` (IPC into the main process) to enumerate sources via `desktopCapturer`, then calls `navigator.mediaDevices.getUserMedia` with `chromeMediaSource: 'desktop'` constraints. |
| 2.4 | For each track on the resulting `MediaStream`, calls `peerConnection.addTrack(track, localStream)` | - |
| 2.5 | Creates the input data channel: `peerConnection.createDataChannel('input', { ordered: true })` | - |
| 2.6 | `peerConnection.createOffer({ offerToReceiveAudio: false })` then `setLocalDescription(offer)` | - |
| 2.7 | `session.signaling.sendOffer({ type, sdp })` | Writes `FB/sessions/{code}/offer = { type: 'offer', sdp: '...' }`. |

## Phase 3 - Mobile answers

When the mobile's `watchOffer` callback fires:

| Step | Code | Detail |
| --- | --- | --- |
| 3.1 | `RemoteControlActivity#startSession` `watchOffer` lambda | Uses `offerAccepted.compareAndSet(false, true)` to ensure the offer is processed exactly once, even if the listener fires multiple times. |
| 3.2 | `WebRTCClient.setRemoteOffer(payload, onSuccess, onError)` | Calls `pc.setRemoteDescription(new SessionDescription(OFFER, sdp))`. |
| 3.3 | On success, drains any ICE candidates that arrived early into `pc.addIceCandidate(...)` | `pendingIce` list, protected by `synchronized(pendingIce)`. |
| 3.4 | `WebRTCClient.createAnswer(...)` | Calls `pc.createAnswer(constraints)`, then `pc.setLocalDescription(answer)`. |
| 3.5 | On success, `SignalingClient.sendAnswer(answer)` | Writes `FB/sessions/{code}/answer = { type: 'answer', sdp: '...' }`. |

## Phase 4 - ICE candidate exchange

Both sides ran `setLocalDescription` in Phase 2 and Phase 3, which
causes their `RTCPeerConnection` to begin ICE gathering. Each candidate
the local side discovers is published to Firebase, and each candidate
the remote side publishes is applied locally.

### Desktop

| Direction | Code | Firebase path |
| --- | --- | --- |
| Outbound | `pc.onicecandidate` in `src/renderer/renderer.js` calls `session.signaling.sendIceCandidate(event.candidate.toJSON())` | Pushes a new child under `FB/sessions/{code}/iceCandidates/host`. |
| Inbound | `session.signaling.watchIceCandidates` listens to `FB/sessions/{code}/iceCandidates/client` | For each child, calls `pc.addIceCandidate(new RTCIceCandidate(candidate))`. |

### Mobile

| Direction | Code | Firebase path |
| --- | --- | --- |
| Outbound | `WebRTCClient`'s `PeerConnection.Observer.onIceCandidate` invokes `callbacks.onLocalIceCandidate(...)`, which calls `SignalingClient.sendIceCandidate(...)` | Pushes under `FB/sessions/{code}/iceCandidates/client`. |
| Inbound | `RemoteControlActivity` registers `sig.watchIceCandidates { candidate -> ... }`, which queues if `remoteDescriptionSet` is false, otherwise calls `rtc.addRemoteIceCandidate(candidate)` | - |

### Why we queue inbound candidates on mobile

Firebase's `addValueEventListener` fires immediately with the current
value. That means the host's ICE candidates can arrive before the
mobile finishes applying the offer's remote description. WebRTC will
silently drop ICE candidates added before the description is set, so
the mobile buffers them in `pendingIce` and drains the buffer once
`setRemoteDescription` succeeds. The desktop side does not need this
because it sets the local description first and the remote description
arrives only via `watchAnswer` after Phase 3.

## Phase 5 - WebRTC connects

`RTCPeerConnection` automatically pairs candidates and reports state
changes via `onconnectionstatechange`. The expected sequence on both
peers is:

```
new -> connecting -> connected
```

- On the desktop, the renderer updates `dom.rtcState.textContent` and
  shows the "Connected" status.
- On the mobile, `WebRTCClient.Callbacks.onConnectionStateChange` posts
  the state to `RemoteControlActivity` via `runOnUiThread`, which
  updates `statusText`.

The input data channel transitions independently:

```
connecting -> open
```

- On the desktop, `dataChannel.onopen` schedules a ping (`schedulePing`).
- On the mobile, `attachDataChannel` is called by `onDataChannel`
  callback from `WebRTCClient`. The mobile then knows the channel is
  ready for input messages.

## Phase 6 - Live operation

This phase is covered in two separate documents:

- [SCREEN_SHARING.md](SCREEN_SHARING.md) - the video flow from desktop
  to mobile.
- [INPUT_HANDLING.md](INPUT_HANDLING.md) - the input event flow from
  mobile to desktop.

Firebase is no longer in the data path. The two side channels that
still touch Firebase during the session are:

1. The desktop's `onDisconnect().remove()` on `sessions/{code}/host`,
   which fires automatically if the desktop process dies, the device
   sleeps, or the network drops.
2. The mobile's equivalent on `sessions/{code}/client`.

## Phase 7 - Disconnect

There are three ways a session ends.

### Mobile closes voluntarily

| Step | Code | Effect |
| --- | --- | --- |
| 7.1 | User presses back, or Android destroys the activity | `RemoteControlActivity#onDestroy` runs. |
| 7.2 | `signaling.dispose()` | Removes all attached listeners. |
| 7.3 | `inputChannel?.close()` | Closes the data channel. |
| 7.4 | `webRtc.dispose()` | Closes the `PeerConnection` and disposes the factory. |
| 7.5 | `binding.remoteVideo.release()` + `eglBase.release()` | Frees rendering resources. |
| 7.6 | Firebase observes the connection drop and fires `onDisconnect` | `sessions/{code}/client` disappears. |

On the desktop side, `watchPeerPresence(client)` fires with `null` and
the `SessionController` starts a ten-second grace timer
(`PEER_DISCONNECT_GRACE_MS`). If the client does not return inside
that window, status flips back to "Waiting for client".

### Desktop closes voluntarily

| Step | Code | Effect |
| --- | --- | --- |
| 7.7 | User clicks Restart, or closes the window | The renderer calls `restart()` or Electron triggers `window-all-closed`. |
| 7.8 | `restart()` | Cancels the ping timer, closes the data channel, closes the peer connection, stops media tracks, stops the `SessionController`, generates a brand new pairing code, and starts a new session. |
| 7.9 | `SessionController#stop` | Calls `signaling.clearSession()` which removes `sessions/{code}` entirely. |

On the mobile side, the mobile's `watchPeerPresence(host)` fires with
`null`, the activity shows "Desktop is offline", and the user must
return to `MainActivity` to type a new code.

### Network failure

Either side may lose connectivity without an explicit close.

- The `onDisconnect().remove()` arms set up at registration cause
  Firebase to remove the presence entry as soon as the server-side
  socket closes (typically within a minute).
- WebRTC's `iceConnectionState` transitions to `disconnected` and then
  `failed` if the connection cannot be repaired.
- The desktop renderer sets the status to "Disconnected" on either
  state. The mobile updates `statusText` similarly via
  `onConnectionStateChange`.

## Sequence diagram

```
H = Desktop (host)
C = Android (client)
FB = Firebase Realtime Database

H -> FB         set sessions/{code}/host = { uid, createdAt }
H -> FB         arm onDisconnect remove on sessions/{code}/host
H -> FB         subscribe sessions/{code}/client

C -> FB         set sessions/{code}/client = { uid, createdAt }
C -> FB         arm onDisconnect remove on sessions/{code}/client
C -> FB         subscribe sessions/{code}/offer
C -> FB         subscribe sessions/{code}/answer
C -> FB         subscribe sessions/{code}/iceCandidates/host

FB -> H         sessions/{code}/client populated
H -> H          captureScreen, createOffer, setLocalDescription
H -> FB         set sessions/{code}/offer = { type, sdp }

FB -> C         sessions/{code}/offer populated
C -> C          setRemoteDescription(offer), createAnswer, setLocalDescription
C -> FB         set sessions/{code}/answer = { type, sdp }

FB -> H         sessions/{code}/answer populated
H -> H          setRemoteDescription(answer)

Both sides:
*  -> FB        push iceCandidates/{role}/{auto-id} = { candidate, sdpMid, sdpMLineIndex }
FB -> *         deliver iceCandidates/{peer-role}/* -> addIceCandidate

Both sides:
*  -> *         RTCPeerConnection.connectionState -> "connected"
H  -> C         data channel "input" opens
H  -> C         video track delivers frames
C  -> H         data channel messages with mousemove / click / keydown / ...
```

## Related reading

- [PROTOCOL.md](PROTOCOL.md) for the exact data-channel message format.
- [SECURITY.md](SECURITY.md) for what the Firebase rules allow and
  forbid during each phase.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for what to do when the flow
  stalls.
