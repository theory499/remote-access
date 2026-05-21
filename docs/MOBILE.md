# Mobile module reference

A file-by-file tour of the Android Kotlin client. Each section names
its path, dependencies, public surface, and callers.

## Directory map

```
mobile/
├── build.gradle.kts                 root project config, plugins
├── settings.gradle.kts              project list, repositories
├── gradle.properties                JVM args, AndroidX flags
├── gradle/wrapper/                  wrapper metadata
├── app/
│   ├── build.gradle.kts             module config, dependencies
│   ├── proguard-rules.pro           release shrinker rules
│   ├── google-services.json.template  Firebase config template
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/remotedesktop/
│       │   │   ├── RemoteDesktopApp.kt           Application class
│       │   │   ├── ui/
│       │   │   │   ├── MainActivity.kt
│       │   │   │   └── RemoteControlActivity.kt
│       │   │   ├── input/
│       │   │   │   ├── InputEventEncoder.kt
│       │   │   │   ├── PairingCode.kt
│       │   │   │   ├── RemoteSurfaceController.kt
│       │   │   │   └── AndroidKeyMapper.kt
│       │   │   ├── signaling/
│       │   │   │   ├── Payloads.kt
│       │   │   │   └── SignalingClient.kt
│       │   │   └── webrtc/
│       │   │       └── WebRTCClient.kt
│       │   └── res/                  layouts, strings, themes, icons
│       ├── test/                     JVM-only unit tests
│       └── androidTest/              instrumented tests
└── verify/                           JVM-safe verification project
    ├── build.gradle.kts
    └── settings.gradle.kts
```

The `mobile/verify/` project re-uses the same Kotlin source files for
the JVM-safe subset (input encoders, surface mapper, pairing code,
signalling payloads) and runs them with plain JUnit. This lets a
contributor verify the bulk of the Android logic without installing the
Android SDK.

---

## RemoteDesktopApp.kt

**Class:** `RemoteDesktopApp : Application`

The custom `Application` subclass declared in `AndroidManifest.xml`.

**Responsibilities:**
- Calls `FirebaseApp.initializeApp(this)` so the Firebase SDK reads
  `google-services.json` exactly once per process.
- Exposes lazy singletons for `FirebaseAuth` and `FirebaseDatabase`.
- Disables Realtime Database disk persistence (`setPersistenceEnabled(false)`)
  because the session state is short-lived and we never want stale
  pairing-code metadata to come back after a restart.

---

## ui/MainActivity.kt

The pairing screen. The first activity in the manifest's launcher
intent filter.

**Responsibilities:**
- Sign the user in anonymously via `FirebaseAuth.signInAnonymously`.
- Render a `TextInputEditText` for the six-character code with a
  `TextWatcher` that runs each keystroke through
  `PairingCode.normalise` (lowercase to upper, strip ambiguous chars,
  cap at six characters).
- Enable the Connect button once `PairingCode.isValid` returns true.
- On Connect, launch `RemoteControlActivity` with the code as an
  `Intent` extra.

**View binding:** `ActivityMainBinding` (generated from
`res/layout/activity_main.xml`).

---

## ui/RemoteControlActivity.kt

The main screen. Hosts the remote video and turns user input into
protocol messages.

### Lifecycle
1. `onCreate` reads `EXTRA_SESSION_CODE`, finishes if missing.
2. Initialises `EglBase`, configures the `SurfaceViewRenderer`, wires
   up touch and keyboard listeners.
3. Calls `startSession()` which creates a `SignalingClient`, a
   `WebRTCClient`, registers presence, and subscribes to offer / answer
   / ICE candidates.
4. `onDestroy` disposes signaling, closes the data channel, releases
   the video sink, disposes the WebRTC client, releases the renderer
   and EGL base.

### State

| Field | Purpose |
| --- | --- |
| `eglBase` | OpenGL context for the `SurfaceViewRenderer`. |
| `surfaceController` | Translates view-pixel touches to normalised coordinates. |
| `signaling` | Active `SignalingClient` or `null`. |
| `webRtc` | Active `WebRTCClient` or `null`. |
| `inputChannel` | The `DataChannel` once `onDataChannel` fires. |
| `remoteVideo` | The remote `VideoTrack` once `onAddTrack` fires. |
| `offerAccepted` | `AtomicBoolean` guard that ensures we process the offer once even if `addValueEventListener` fires multiple times. |
| `pendingIce` | `MutableList<IceCandidatePayload>` buffer for ICE candidates that arrive before the remote description is set. |
| `remoteDescriptionSet` | Flag flipped to `true` once `setRemoteOffer.onSuccess` runs. Until then, ICE candidates queue. |

### Touch handling

`configureTouchInput` attaches a `GestureDetector` and an
`OnTouchListener`:

- `onSingleTapUp` -> `click(x, y, "left")`.
- `onLongPress` -> `click(x, y, "right")`.
- `ACTION_MOVE` -> `mouseMove(x, y)`.

The "Keyboard" button programmatically focuses a 1x1px hidden
`EditText` and shows the soft keyboard. The `EditText`'s `TextWatcher`
sends each batch of characters as a single `type` message.

### Hardware key handling

`onKeyDown` and `onKeyUp` map Android `KeyEvent`s to protocol messages
via `AndroidKeyMapper`. If a key has no protocol mapping (for example
the volume buttons) the handler returns `super`, letting Android
handle it normally.

### Layout

`res/layout/activity_remote_control.xml`:
- A `SurfaceViewRenderer` filling most of the screen.
- A 48dp status bar at the bottom with the pairing code, status text,
  and Keyboard button.
- A 1x1 transparent `EditText` for soft-keyboard input.

---

## input/InputEventEncoder.kt

Builds protocol JSON strings.

**Public surface:**

| Function | Returns |
| --- | --- |
| `mouseMove(x, y)` | `{"type":"mousemove","x":xN,"y":yN}` with `x`, `y` clamped to `[0, 1]`. |
| `mouseDown(button)` / `mouseUp(button)` | Throws if `button` is not `"left"`, `"right"`, or `"middle"`. |
| `click(x, y, button)` | Combined message used for single taps. |
| `scroll(dx, dy)` | Vertical and horizontal deltas. |
| `keyDown(key, modifiers = [])` / `keyUp(key, modifiers = [])` | Throws if `key` is not in the allowlist or `modifiers` contains an unknown value. |
| `typeText(text)` | Truncates to 256 characters; throws on empty input. |
| `ping(id)` / `pong(id)` | Latency probes. |

**Constants:**
- `TYPE_TEXT_MAX_LENGTH = 256` - matches the desktop validator.
- `BUTTONS`, `MODIFIERS`, `KEYS` - the same sets the desktop's
  `protocol.js` validates against.

---

## input/PairingCode.kt

Validation helpers used by `MainActivity`'s `TextWatcher`.

**Public surface:**
- `normalise(raw)` - trims, uppercases, drops anything not in the
  alphabet, truncates to six characters.
- `isValid(code)` - regex match against
  `^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$`.

The alphabet is identical to the desktop's
`session-id.js` so both sides agree on what codes look like.

---

## input/RemoteSurfaceController.kt

Maps touch coordinates on the `SurfaceViewRenderer` to normalised
remote coordinates.

**Public surface:**
- `updateSurfaceSize(width, height)` - called from
  `SurfaceViewRenderer.addOnLayoutChangeListener`.
- `toNormalised(touchX, touchY): NormalisedPoint` - returns `(x, y)`
  in `[0.0, 1.0]`. Returns `(0, 0)` if the surface has not been
  measured yet.

Out-of-range touches are clamped, which makes the contract
predictable when the user drags slightly outside the surface bounds.

---

## input/AndroidKeyMapper.kt

Translates `android.view.KeyEvent` codes to the protocol's logical key
names.

**Public surface:**
- `toProtocolKey(keyCode)` returns the protocol name (for example
  `"A"`, `"Enter"`, `"Left"`, `"F5"`) or `null` if the key is not
  mapped.
- `toProtocolModifiers(metaState)` returns the subset of
  `["control", "shift", "alt", "meta"]` currently held.

Maps in this file are the only Android-framework-dependent code in the
`input` package, which is why it is excluded from the
`mobile/verify/` JVM-only test project.

---

## signaling/Payloads.kt

Plain Kotlin data classes for the values written into Firebase. These
have no Android or Firebase dependencies, so they live in the JVM-safe
subset.

**Classes:**
- `SdpPayload(type, sdp)` with `fromMap` / `toMap` helpers.
- `IceCandidatePayload(candidate, sdpMid, sdpMLineIndex)` with `fromMap` /
  `toMap` helpers.

---

## signaling/SignalingClient.kt

Wraps Firebase Realtime Database listeners and writes for the mobile
side. Symmetric to `desktop/src/main/firebase-signaling.js`.

**Class:** `SignalingClient`

**Constructor:**

| Parameter | Purpose |
| --- | --- |
| `database` | `FirebaseDatabase` instance from `RemoteDesktopApp.database`. |
| `uid` | Authenticated user id. |
| `sessionCode` | The six-character code. |
| `role` | `Role.CLIENT` on the phone. The same class also supports `Role.HOST`, which is useful for tests and possible future host-side ports. |

**Public methods:** mirror the JavaScript signalling client -
`registerPresence`, `watchPeerPresence`, `sendOffer`, `watchOffer`,
`sendAnswer`, `watchAnswer`, `sendIceCandidate`, `watchIceCandidates`,
`dispose`.

**Listener tracking:** every `addValueEventListener` and
`addChildEventListener` call records the `(ref, listener)` pair in an
internal list so `dispose()` can remove all of them in one shot. This
is critical for avoiding leaks across configuration changes.

---

## webrtc/WebRTCClient.kt

Owns the `PeerConnectionFactory` and a single `PeerConnection`.

**Class:** `WebRTCClient`

**Constructor:**

| Parameter | Purpose |
| --- | --- |
| `context` | `applicationContext` - passed to `PeerConnectionFactory.initialize`. |
| `eglBase` | The `EglBase` shared with the `SurfaceViewRenderer`. |
| `callbacks` | A `Callbacks` interface implementation - `RemoteControlActivity` provides it. |

**Callbacks interface:**

```kotlin
interface Callbacks {
    fun onLocalIceCandidate(candidate: IceCandidatePayload)
    fun onRemoteVideoTrack(track: VideoTrack)
    fun onDataChannel(channel: DataChannel)
    fun onConnectionStateChange(state: PeerConnection.PeerConnectionState)
}
```

**Public methods:**

| Method | Effect |
| --- | --- |
| `createConnection(iceServers)` | Builds an `RTCConfiguration` with `UNIFIED_PLAN` semantics, TCP candidates disabled, and creates the `PeerConnection`. |
| `setRemoteOffer(payload, onSuccess, onError)` | Calls `pc.setRemoteDescription(new SessionDescription(OFFER, sdp))`. |
| `createAnswer(onSuccess, onError)` | Calls `pc.createAnswer`, then `setLocalDescription`. Reports the answer SDP through `onSuccess`. |
| `addRemoteIceCandidate(payload)` | Wraps the payload into an `IceCandidate` and calls `pc.addIceCandidate`. |
| `sendData(channel, message)` | Encodes a string to UTF-8 and pushes it through `DataChannel.Buffer`. |
| `dispose()` | Closes the `PeerConnection` and disposes the factory. Idempotent via `AtomicBoolean`. |

**Default ICE servers** (`Companion.DEFAULT_ICE_SERVERS`): Google's
public STUN servers `stun.l.google.com:19302` and
`stun1.l.google.com:19302`. To add a TURN server, append additional
`PeerConnection.IceServer` entries.

---

## AndroidManifest.xml

- `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK` permissions.
- `RemoteDesktopApp` as the `android:name`.
- `MainActivity` as the launcher.
- `RemoteControlActivity` declared with
  `configChanges="orientation|screenSize|keyboardHidden|screenLayout"`
  so rotation does not destroy the WebRTC connection.
- `windowSoftInputMode="adjustResize|stateAlwaysHidden"` so the soft
  keyboard does not push the video off the screen on its own.

---

## Resources

| File | Purpose |
| --- | --- |
| `res/layout/activity_main.xml` | Pairing screen UI. |
| `res/layout/activity_remote_control.xml` | Live session UI. |
| `res/values/strings.xml` | All user-facing copy in one place. |
| `res/values/themes.xml` | Material 3 day/night theme. |
| `res/values/colors.xml` | Brand colours. |
| `res/xml/data_extraction_rules.xml` | Backup/transfer exclusions. |
| `res/mipmap-anydpi-v26/ic_launcher.xml` | Adaptive launcher icon. |
| `res/drawable/ic_launcher_foreground.xml` | Foreground vector for the icon. |

---

## Tests

| File | Layer | What it covers |
| --- | --- | --- |
| `test/.../InputEventEncoderTest.kt` | Unit | Every encoder method, including invalid input. |
| `test/.../InputEventEncoderModifierTest.kt` | Unit | `keyUp` defaulting modifiers to empty. |
| `test/.../PairingCodeTest.kt` | Unit | Normalisation and validation. |
| `test/.../RemoteSurfaceControllerTest.kt` | Unit | Coordinate mapping and clamping. |
| `test/.../SignalingPayloadTest.kt` | Unit | `SdpPayload` / `IceCandidatePayload` round-trips. |
| `androidTest/.../MainActivityInstrumentedTest.kt` | Instrumented | Activity launch and basic view presence. |

All five JVM-safe unit-test classes also run inside the `mobile/verify/`
project, which means they execute on systems without an Android SDK.

Run the full unit-test suite with `./gradlew test` (requires Android
SDK), or just the JVM-safe portion with `cd verify && gradle test`.

---

## Cross-references

- [CONNECTION_FLOW.md](CONNECTION_FLOW.md) for the lifecycle these
  modules participate in.
- [SCREEN_SHARING.md](SCREEN_SHARING.md) for how `WebRTCClient` and
  `SurfaceViewRenderer` cooperate to display the remote screen.
- [INPUT_HANDLING.md](INPUT_HANDLING.md) for how `InputEventEncoder`,
  `RemoteSurfaceController`, and `AndroidKeyMapper` feed the data
  channel.
- [DESKTOP.md](DESKTOP.md) for the host counterparts.
