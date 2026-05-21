# Input handling - sending a message from the phone to the desktop

This document covers the input path: how a finger touch on the phone
becomes a real mouse click on the desktop, and how characters typed in
the soft keyboard become real key presses. It assumes the WebRTC peer
connection is already established and the `input` data channel is
open (see [CONNECTION_FLOW.md](CONNECTION_FLOW.md) Phase 5).

## End-to-end diagram

```
+-----------------------------------------------------+
|                  ANDROID CLIENT                     |
|                                                     |
|   User touches SurfaceViewRenderer                  |
|     |                                               |
|     v                                               |
|   View.OnTouchListener (RemoteControlActivity)      |
|     | (x, y) in view pixels                         |
|     v                                               |
|   RemoteSurfaceController.toNormalised(x, y)        |
|     | (xN, yN) in [0, 1]                            |
|     v                                               |
|   InputEventEncoder.{mouseMove, click, ...}         |
|     | JSON string                                   |
|     v                                               |
|   DataChannel.send(buffer)                          |
|                                                     |
+-----|-----------------------------------------------+
      |
      |  ordered, reliable, encrypted DCEP/SCTP
      |  direct peer-to-peer
      v
+-----|-----------------------------------------------+
|     v                                               |
|   RTCDataChannel.onmessage  (renderer process)      |
|     |                                               |
|     v                                               |
|   protocol.parse(line)                              |
|     | validated message object                      |
|     v                                               |
|   window.api.dispatchInputEvent(message)            |
|     | IPC                                           |
|     v                                               |
|   ipcMain.handle('input:event', ...)  (main proc)   |
|     |                                               |
|     v                                               |
|   InputController.handle(event)                     |
|     |                                               |
|     v                                               |
|   @nut-tree-fork/nut-js: mouse / keyboard / screen  |
|     |                                               |
|     v                                               |
|   OS-level input event injected                     |
|                                                     |
|                   DESKTOP HOST                      |
+-----------------------------------------------------+
```

## The four kinds of messages a phone sends

1. **Mouse movement and clicks** - tap, drag, long-press on the screen
   renderer area.
2. **Typed text** - characters from the soft keyboard.
3. **Discrete key presses** - non-character keys (Enter, Escape, arrows,
   F1-F12, etc.) from a hardware keyboard.
4. **Ping / pong** - latency measurement, initiated by the desktop and
   echoed by the phone.

The exact wire format for every message type is in
[PROTOCOL.md](PROTOCOL.md). Below we trace each kind end to end.

## 1. Mouse movement and clicks

### Phone side

`RemoteControlActivity.configureTouchInput()` attaches an
`OnTouchListener` to the `SurfaceViewRenderer`. The listener:

- Runs every event through a `GestureDetector`.
- On `onSingleTapUp`, sends a `click` message with `button = "left"`.
- On `onLongPress`, sends a `click` message with `button = "right"`.
- On `ACTION_MOVE`, sends a `mousemove` message with the current
  normalised coordinates.

`RemoteSurfaceController.toNormalised(x, y)` converts a pixel position
on the rendered surface into a `(0..1, 0..1)` pair. The surface size
comes from the layout listener attached in `configureRenderer`.

`InputEventEncoder.mouseMove(x, y)` returns a JSON string like
`{"type":"mousemove","x":0.5,"y":0.5}`. The encoder clamps values into
the `[0, 1]` range as a defensive measure.

Finally `WebRTCClient.sendData(channel, message)` wraps the bytes in a
`DataChannel.Buffer` and calls `channel.send(buffer)`.

### Desktop side

The renderer's data channel `onmessage` handler is in
`src/renderer/renderer.js#attachDataChannel`. It:

- Parses the JSON line via `protocol.parse`. If parsing or validation
  fails, the message is silently dropped.
- For `mousemove`, it stores the message in `pendingMove` and schedules
  a single `requestAnimationFrame` drain. If more `mousemove` messages
  arrive before the drain runs, only the latest one survives.
- For other types, it forwards immediately via `window.api.dispatchInputEvent`.

This coalescing matters: on a fast drag, the phone can produce 100+
`mousemove` events per second, but the host OS can only consume a few
dozen distinct cursor positions per frame. Without coalescing, the
events would queue inside Electron's IPC bridge and the cursor would
lag behind the finger by hundreds of milliseconds.

The preload (`src/preload/preload.js`) exposes `window.api` via
`contextBridge`:

```js
contextBridge.exposeInMainWorld('api', {
  dispatchInputEvent: (message) => ipcRenderer.invoke('input:event', message),
  // ...
});
```

`ipcMain.handle('input:event', ...)` in `src/main/main.js` calls
`InputController.handle(event)`.

`InputController` (`src/main/input-controller.js`) is the only place
that talks to the OS:

```js
async mouseMove(xNorm, yNorm) {
  const { x, y } = await this.toPixel(xNorm, yNorm);  // multiply by screen size
  if (typeof this.nut.mouse.setPosition === 'function') {
    await this.nut.mouse.setPosition(new Point(x, y));
  } else {
    await this.nut.mouse.move(straightTo(new Point(x, y)));
  }
}

async click(xNorm, yNorm, button) {
  await this.mouseMove(xNorm, yNorm);
  await this.nut.mouse.click(this.resolveButton(button));
}
```

`setPosition` jumps the cursor instantly; `mouse.move(straightTo(...))`
animates the cursor to the target. The implementation prefers
`setPosition` for low latency, falling back to `move` when only the
animated path is available (older nut.js builds).

## 2. Typed text

Typing on the phone goes through a hidden `EditText` (`keyboardInput`).
The user reveals the soft keyboard by tapping a "Keyboard" button.

`configureKeyboardInput` registers a `TextWatcher` whose
`afterTextChanged` reads any characters that were appended, sends them
as a single `type` message, and clears the `EditText`:

```kotlin
override fun afterTextChanged(s: Editable?) {
    if (s == null || s.isEmpty()) return
    val toSend = s.toString()
    send(InputEventEncoder.typeText(toSend))
    s.clear()
}
```

`InputEventEncoder.typeText` truncates anything longer than 256
characters - the same limit the desktop's `protocol.validate` enforces.

On the desktop:

```js
case 'type':
  return this.type(event.text);

async type(text) {
  await this.nut.keyboard.type(text);
}
```

`nut.js` translates each character into the platform's text-injection
API: `SendInput` on Windows, `CGEventCreateKeyboardEvent` on macOS,
`X11 XTestFakeKeyEvent` on Linux.

This path is preferable to `keydown`/`keyup` for characters because it
handles Unicode, dead keys, and platform-specific keyboard layouts.

## 3. Discrete key presses

For Enter, Escape, arrows, function keys, and any non-character key, the
phone produces `keydown` and `keyup` messages instead.

`RemoteControlActivity` overrides `onKeyDown` and `onKeyUp`:

```kotlin
override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
    val key = AndroidKeyMapper.toProtocolKey(keyCode)
    if (key != null) {
        send(InputEventEncoder.keyDown(key, AndroidKeyMapper.toProtocolModifiers(event.metaState)))
        return true
    }
    return super.onKeyDown(keyCode, event)
}
```

`AndroidKeyMapper.toProtocolKey` translates Android `KeyEvent.KEYCODE_*`
constants into the protocol's logical key names (see
[PROTOCOL.md](PROTOCOL.md#keydown--keyup)).

`InputEventEncoder.keyUp` deliberately accepts an empty modifier list.
This matters because of how the desktop tracks held modifiers:

```js
async keyDown(key, modifiers = []) {
  const resolved = this.resolveKey(key);
  const mods = this.resolveModifiers(modifiers);
  for (const mod of mods) {
    if (!this._heldModifiers.has(mod)) {
      await this.nut.keyboard.pressKey(mod);
      this._heldModifiers.add(mod);
    }
  }
  this._heldKeys.add(key);
  await this.nut.keyboard.pressKey(resolved);
}

async keyUp(key, _modifiers = []) {
  const resolved = this.resolveKey(key);
  this._heldKeys.delete(key);
  await this.nut.keyboard.releaseKey(resolved);
  if (this._heldKeys.size === 0 && this._heldModifiers.size > 0) {
    for (const mod of this._heldModifiers) {
      await this.nut.keyboard.releaseKey(mod);
    }
    this._heldModifiers.clear();
  }
}
```

The controller maintains two sets, `_heldModifiers` and `_heldKeys`, and
only releases modifiers when every regular key has come back up. This
prevents a common bug where Shift gets "stuck" on if the user releases
Shift before releasing the letter (Android's `event.metaState` at the
moment of `keyUp` does not contain Shift any more, so a naive
implementation that releases whatever modifiers came with the message
would never call `releaseKey(Shift)`).

## 4. Ping / pong

The desktop schedules a ping every two seconds while the data channel
is open:

```js
function schedulePing() {
  if (pingTimer !== null) { clearTimeout(pingTimer); pingTimer = null; }
  if (!dataChannel || dataChannel.readyState !== 'open') return;
  pingId += 1;
  const id = pingId;
  pendingPings.set(id, performance.now());
  dataChannel.send(JSON.stringify({ type: 'ping', id }));
  pingTimer = setTimeout(schedulePing, 2000);
}
```

The phone echoes any `ping` it receives:

```kotlin
"ping" -> {
    val id = json.optInt("id", -1)
    if (id >= 0) webRtc?.sendData(channel, InputEventEncoder.pong(id))
}
```

When the desktop receives the matching `pong`, it subtracts the stored
timestamp from `performance.now()` and updates the "Round trip" metric
in the UI:

```js
if (message.type === 'pong') {
  const sentAt = pendingPings.get(message.id);
  if (sentAt !== undefined) {
    const rtt = performance.now() - sentAt;
    dom.rtt.textContent = `${Math.round(rtt)} ms`;
    pendingPings.delete(message.id);
  }
}
```

This is also why the desktop holds open the timer through the renderer
even when no user activity is happening - it provides a continuous
liveness signal.

## Validation and trust boundaries

Every incoming message on the desktop goes through `protocol.validate`
in `src/shared/protocol.js`. The validator is strict:

- `mousemove` coordinates must be finite numbers in `[0, 1]`.
- `mousedown`/`mouseup`/`click` buttons must be `"left"`, `"right"`, or
  `"middle"`.
- `keydown`/`keyup` keys must be in a closed allowlist.
- `keydown`/`keyup` modifiers must be a subset of
  `["control", "shift", "alt", "meta"]`.
- `type.text` must be a non-empty string of at most 256 characters.
- `ping`/`pong` ids must be non-negative integers.

If validation fails, the renderer logs a "Input dispatch failed" line
and drops the message. Nothing is forwarded to the OS.

The same constraints are enforced on the producer side by
`InputEventEncoder`, so the validator is purely defensive. It catches
bugs (or hostile peers, which the security rules already mitigate)
without crashing or behaving unpredictably.

## What can go wrong

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Cursor does not move at all | Data channel never opened | Renderer log: "Input data channel open" should appear after `connectionState=connected` |
| Cursor moves but lags behind | Mousemove flood, or low frame rate on the renderer | `requestAnimationFrame` drain in `attachDataChannel` should already mitigate this |
| Typing produces extra characters | Both `type` and `keydown` paths firing for the same key | Only the soft keyboard should produce `type`; hardware keyboards produce `keydown` |
| Modifier keys "stick" | Bug in `_heldKeys` / `_heldModifiers` tracking | `InputController#keyUp` releases modifiers only when `_heldKeys.size === 0` |
| `Unknown key` errors in the log | Phone sent a `KeyEvent` that has no mapping | Extend `AndroidKeyMapper.toProtocolKey` or the desktop key map in `InputController` |

## Where to read more

- [PROTOCOL.md](PROTOCOL.md) for the exact JSON schema.
- [DESKTOP.md](DESKTOP.md#input-controller) for `InputController`'s
  full module reference.
- [MOBILE.md](MOBILE.md#input) for the Android `InputEventEncoder`,
  `RemoteSurfaceController`, and `AndroidKeyMapper`.
