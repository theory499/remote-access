# Input event protocol

All input events flow from the Android client to the desktop host over a
single ordered, reliable WebRTC data channel named `input`. Each message
is a UTF-8 encoded JSON object terminated by a newline. The desktop
validates every incoming message against the schema below and silently
discards anything that fails validation.

Coordinates `x` and `y` are normalised to the inclusive range `[0.0, 1.0]`
relative to the captured display. The desktop multiplies by the actual
screen size before forwarding to the OS.

## Message types

### mousemove

```json
{ "type": "mousemove", "x": 0.5121, "y": 0.7843 }
```

Move the cursor to the absolute normalised position.

### mousedown / mouseup

```json
{ "type": "mousedown", "button": "left" }
{ "type": "mouseup",   "button": "left" }
```

`button` is one of `"left"`, `"right"`, `"middle"`.

### click

```json
{ "type": "click", "x": 0.5, "y": 0.5, "button": "left" }
```

Convenience message - moves the cursor to `(x, y)` and performs a press
+ release of `button`. Equivalent to a `mousemove` followed by
`mousedown` and `mouseup`.

### scroll

```json
{ "type": "scroll", "dx": 0, "dy": -120 }
```

Vertical (`dy`) and horizontal (`dx`) wheel deltas. Positive `dy` scrolls
down, negative scrolls up.

### keydown / keyup

```json
{ "type": "keydown", "key": "A", "modifiers": ["shift"] }
{ "type": "keyup",   "key": "A", "modifiers": [] }
```

`key` is a logical key name. Recognised values:

- Letters: single uppercase character `A`-`Z`.
- Digits: `0`-`9`.
- Whitespace and editing: `Space`, `Enter`, `Tab`, `Backspace`, `Delete`,
  `Escape`.
- Arrows: `Left`, `Right`, `Up`, `Down`.
- Function keys: `F1`-`F12`.
- Navigation: `Home`, `End`, `PageUp`, `PageDown`.

`modifiers` is a subset of `["control", "shift", "alt", "meta"]`.

### type

```json
{ "type": "type", "text": "hello world" }
```

Convenience message - the desktop simulates typing the entire string
character by character. The desktop limits a single `type` message to
256 characters; longer strings are truncated.

### ping / pong

```json
{ "type": "ping", "id": 17 }
{ "type": "pong", "id": 17 }
```

Either side may send `ping`; the receiver echoes the same `id` in a
`pong`. Used to measure round-trip latency and to keep stateful NAT
mappings alive.

## Validation rules in one place

Each rule is enforced both by `InputEventEncoder` on Android (at the
producer) and `protocol.validate` on the desktop (at the consumer).

- `x`, `y` must be finite numbers and lie inside `[0.0, 1.0]`. The
  desktop's `InputController` clamps the result to the screen size
  inside `toPixel`.
- `button` must be exactly one of `"left"`, `"right"`, `"middle"`.
  Any other string is rejected.
- `key` must be exactly one of the values listed under
  [keydown / keyup](#keydown--keyup). Case matters.
- `modifiers` must be a (possibly empty) array of strings from
  `["control", "shift", "alt", "meta"]`. Duplicates are tolerated but
  ignored.
- `text` must be a non-empty string. The producer truncates anything
  longer than 256 characters; the validator rejects strings longer
  than 256.
- `dx`, `dy` must be finite numbers (typically integers).
- `id` for `ping`/`pong` must be a non-negative integer.

## End-to-end example

The shape of a single user action, expressed as the literal JSON sent
through the data channel:

1. User taps near the top-left of the rendered surface:
   ```json
   {"type":"click","x":0.0512,"y":0.0843,"button":"left"}
   ```
2. The user drags to the right:
   ```json
   {"type":"mousemove","x":0.4123,"y":0.0843}
   {"type":"mousemove","x":0.4126,"y":0.0851}
   {"type":"mousemove","x":0.4129,"y":0.0859}
   ```
3. The user opens the soft keyboard and types `hi`:
   ```json
   {"type":"type","text":"hi"}
   ```
4. The user presses Enter on the soft keyboard:
   ```json
   {"type":"keydown","key":"Enter","modifiers":[]}
   {"type":"keyup","key":"Enter","modifiers":[]}
   ```
5. Meanwhile the desktop is regularly probing latency:
   ```json
   {"type":"ping","id":42}
   {"type":"pong","id":42}
   ```

All of these messages are tested explicitly in
`desktop/tests/unit/protocol.test.js`'s "cross-platform message shape
compatibility" suite.

## Error handling

- If `protocol.parse` cannot deserialise a line (malformed JSON,
  empty, non-string), it returns `null`.
- If the JSON object fails validation, `protocol.parse` also returns
  `null`. The renderer drops the message and does not propagate to
  IPC.
- If `InputController.handle` throws (for example because an internal
  map lacks an entry that the validator nevertheless accepts - a
  configuration bug), the renderer logs the failure but the session
  continues.

## Versioning

The protocol is currently unversioned. A future version field would be
added as a top-level `v` field defaulting to `1`. Today, both sides
ship with the same release; if you mix incompatible client and host
versions, the receiver will silently drop messages it does not
understand. Adding a handshake message after `connectionState === 'connected'`
is the recommended way to evolve the protocol in a backwards-compatible
fashion.

## Cross-references

- [INPUT_HANDLING.md](INPUT_HANDLING.md) - the end-to-end path each
  message follows.
- [DESKTOP.md](DESKTOP.md#srcsharedprotocoljs) - implementation of
  `validate`, `parse`, `encode`.
- [ANDROID.md](ANDROID.md#inputinputeventencoderkt) - implementation of
  `InputEventEncoder`.
