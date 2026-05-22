# Screen sharing - how the phone sees the desktop

This document covers the video path: how a frame of pixels on the
desktop becomes a frame of pixels on the phone. It assumes the
WebRTC peer connection is already established (see
[CONNECTION_FLOW.md](CONNECTION_FLOW.md)).

## End-to-end diagram

```
+-------------------------------------------------------+
|                    DESKTOP HOST                       |
|                                                       |
|   OS compositor (X11 / Win32 / Quartz)                |
|        |                                              |
|        v                                              |
|   Electron desktopCapturer  (main process)            |
|        |  source descriptor                           |
|        v                                              |
|   navigator.mediaDevices.getUserMedia (renderer)      |
|        |  MediaStream { videoTrack }                  |
|        v                                              |
|   RTCPeerConnection.addTrack(videoTrack)              |
|        |                                              |
+--------|----------------------------------------------+
         |
         |  encoded video (VP8 / VP9 / H.264) over SRTP
         |  direct peer-to-peer
         v
+--------|----------------------------------------------+
|        v                                              |
|   PeerConnection.Observer.onAddTrack (Android)        |
|        |  RtpReceiver -> VideoTrack                   |
|        v                                              |
|   WebRTCClient.Callbacks.onRemoteVideoTrack           |
|        |                                              |
|        v                                              |
|   videoTrack.addSink(SurfaceViewRenderer)             |
|        |                                              |
|        v                                              |
|   GPU-composited frames on screen                     |
|                                                       |
|                    ANDROID CLIENT                     |
+-------------------------------------------------------+
```

## Stage 1 - Capturing the desktop

Electron exposes a built-in API, `desktopCapturer`, that wraps each
platform's native screen capture mechanism: Windows uses the Desktop
Duplication API (or GDI fallback), macOS uses `CGDisplayStream`, and
Linux uses X11 / PipeWire depending on the session.

The capture is split between Electron's main process (which has access
to `desktopCapturer`) and the renderer process (which is the only one
that can hold a `MediaStream`).

### Step 1.1 - List sources (main process)

```js
// desktop/src/main/screen-capture.js
const { desktopCapturer } = require('electron');

async function listScreenSources(types = ['screen']) {
  const sources = await desktopCapturer.getSources({ types });
  return sources.map((s) => ({ id: s.id, name: s.name, display_id: s.display_id }));
}
```

The main process exposes this through an IPC handler in `main.js`:

```js
ipcMain.handle('screen:list-sources', async () => listScreenSources(['screen']));
```

### Step 1.2 - Select a source (renderer)

`src/renderer/renderer.js#captureScreen` calls the IPC bridge:

```js
const sources = await window.api.listScreenSources();
const sourceId = sources[0].id;
```

The current implementation picks the first screen. To select a
specific monitor (multi-display setups) the renderer can present a UI
that shows `sources[].name` and lets the user choose.

### Step 1.3 - Open the `MediaStream` (renderer)

The renderer uses Electron's custom `chromeMediaSource` constraint:

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: sourceId,
      maxFrameRate: 30
    }
  }
});
```

`maxFrameRate: 30` caps the capture at 30 fps. Lower values save CPU
and bandwidth; higher values are honoured only as far as the platform
supports.

### Step 1.4 - Attach the track to the peer connection

```js
for (const track of localStream.getTracks()) {
  peerConnection.addTrack(track, localStream);
}
```

`addTrack` schedules a renegotiation, which is why this happens
*before* `createOffer`. The SDP produced by `createOffer` will then
declare a video m-section advertising the supported codecs (VP8, VP9,
and H.264 depending on the Electron build).

## Stage 2 - Encoding and transport

Once both peers have applied each other's descriptions and ICE has
finished, WebRTC takes over:

| Subsystem | Role |
| --- | --- |
| `RTCRtpSender` in Chromium | Encodes each captured frame. The codec is negotiated in SDP; for Electron-to-Android, VP8 is the most common choice. |
| SRTP | Encrypts the encoded packets. |
| ICE / STUN | Found a direct path during Phase 4 of the connection flow. |
| Transport-CC / REMB | Continuously adjusts bitrate based on receiver reports. |

WebRTC handles packet loss recovery (NACK, FEC, and FIR / PLI for
keyframe requests) automatically; no application code is required.

The only application-visible knob beyond `maxFrameRate` is
`RTCRtpSender.setParameters({ encodings: [{ maxBitrate, scaleResolutionDownBy }] })`
which the renderer could call on the sender after `addTrack`. The
current implementation does not call it; the defaults are reasonable
for a typical desktop resolution.

## Stage 3 - Receiving on Android

### Step 3.1 - Track arrives

The Android WebRTC library notifies the `PeerConnection.Observer`:

```kotlin
// mobile/.../webrtc/WebRTCClient.kt
override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
    val track = receiver?.track() ?: return
    when (track) {
        is VideoTrack -> callbacks.onRemoteVideoTrack(track)
        is AudioTrack -> {}
    }
}
```

The `WebRTCClient` forwards the track to `RemoteControlActivity`
through its `Callbacks` interface.

### Step 3.2 - Bind the track to the renderer

`RemoteControlActivity#onRemoteVideoTrack` switches to the UI thread
and attaches the track to the `SurfaceViewRenderer`:

```kotlin
override fun onRemoteVideoTrack(track: VideoTrack) {
    runOnUiThread {
        remoteVideo?.removeSink(binding.remoteVideo)
        remoteVideo = track
        track.addSink(binding.remoteVideo)
    }
}
```

`removeSink` on the previous track prevents a sink-leak if (for any
reason) `onAddTrack` fires more than once for the same connection.

### Step 3.3 - Rendering

`SurfaceViewRenderer` is part of the `webrtc-sdk` library. It owns an
`EGLContext` (created via `EglBase.create()` in `onCreate`) and renders
each decoded frame onto a `SurfaceTexture` backed by a `SurfaceView`.
Hardware scaling is enabled with `setEnableHardwareScaler(true)`, which
lets the GPU resize frames to the view's bounds.

The renderer registers a layout listener so that whenever the
`SurfaceView` resizes, the `RemoteSurfaceController` learns the new
width and height. This is what lets the touch handler translate phone
coordinates back to the desktop coordinate space.

## Latency budget

A rough breakdown of the latency a user observes between something
happening on the desktop and the phone displaying it:

| Stage | Typical contribution |
| --- | --- |
| Capture (`desktopCapturer` -> `MediaStream`) | 16-33 ms (one frame at 30 fps) |
| Encode (VP8/VP9 in Chromium) | 5-15 ms |
| Network jitter (local Wi-Fi) | 1-20 ms |
| Network jitter (cellular) | 30-150 ms |
| Decode (Android `MediaCodec`) | 5-15 ms |
| Render (`SurfaceViewRenderer` + compositor) | 16-33 ms |
| **Total, same-network** | **~50-100 ms** |
| **Total, cellular** | **~100-250 ms** |

These numbers vary widely with screen content and CPU; the figures are
representative of a typical desktop application UI.

## What can go wrong

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Black screen on the phone | Desktop never called `getUserMedia` or it failed with `NotAllowedError` | Renderer log line "No capture sources available" or browser dev tools console |
| Choppy video | Network bandwidth too low; encoder dropped frames | WebRTC stats (`getStats()` on the renderer's `RTCPeerConnection`) |
| Wrong monitor | Multi-display setup, `sources[0]` was the wrong one | `listScreenSources` returns more than one entry; need a chooser UI |
| Track ends suddenly | OS revoked screen capture permission (macOS Screen Recording, Linux portal denial) | Operating system permission dialog |
| Video shows but cursor is missing | Some platforms exclude the system cursor by default; this is a known Electron quirk | Set the capture options to include the cursor, or use a software cursor overlay |

## Where to read more

- [INPUT_HANDLING.md](INPUT_HANDLING.md) for the reverse path - touches
  becoming clicks.
- [PROTOCOL.md](PROTOCOL.md) for the data channel that carries input
  alongside the video track.
- [DESKTOP.md](DESKTOP.md#screen-capture) for a module-level reference
  of the desktop capture code.
- [ANDROID.md](ANDROID.md#webrtc-client) for the Android `WebRTCClient`
  reference.
