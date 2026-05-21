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
