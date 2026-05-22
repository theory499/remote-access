# Troubleshooting

This document is organised by symptom. Find the row that matches what
you are seeing, then follow the steps in the right-hand column.

## During desktop launch

| Symptom | Most likely cause | What to do |
| --- | --- | --- |
| The pairing code stays as `------` and the status reads "Signing in" | `desktop/src/shared/firebase-config.js` still has placeholders. | Fill in the real values from Firebase Console -> Project settings -> Web app. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md). |
| Status reads "Bootstrap failed: auth/operation-not-allowed" | Anonymous sign-in is disabled in Firebase. | In Firebase Console, enable Anonymous in Authentication -> Sign-in method. |
| Status reads "Bootstrap failed: PERMISSION_DENIED" | The Realtime Database rules are still in locked mode. | Paste `firebase/database.rules.json` into Database -> Rules and publish. |
| Window opens but the pairing code is empty | The renderer bundle was not built. | Run `npm run build:renderer` (or just `npm start`, which builds it as a prerequisite). |
| `Error: Cannot find module '@nut-tree-fork/nut-js'` on startup | Dependencies were not installed. | Run `npm install` in `desktop/`. |

## During mobile launch

| Symptom | Most likely cause | What to do |
| --- | --- | --- |
| Build fails with `File google-services.json is missing` | The Firebase config file is not present. | Copy `app/google-services.json.template` to `app/google-services.json` and replace the placeholder values, or download the file from Firebase Console -> Project settings -> Your apps. |
| "Sign-in failed" toast on the main screen | Anonymous auth not enabled. | Same fix as the desktop above - enable it in the Firebase Console. |
| Connect button stays greyed out even with six characters | The code contains characters not in the alphabet (`O`, `0`, `I`, `1`). | Re-type with the safe alphabet. The `TextWatcher` automatically strips them; if the field looks shorter than what you typed, that is why. |
| App immediately closes on launch | `RemoteDesktopApp` failed to initialise Firebase. | Inspect logcat for the underlying exception; usually a malformed `google-services.json`. |

## Testing on an emulator / simulator

| Symptom | What to do |
| --- | --- |
| The Android emulator's camera shows a scripted living room scene, not the QR | Right-click the QR in the desktop wizard and save it as `qr.png`. Then `adb push qr.png /sdcard/Download/qr.png`. On the emulator, in the Remote Desktop app's QR scanner, tap **Choose image from gallery** and select the file. |
| The iOS Simulator's camera shows a virtual scene | Drag the saved `qr.png` from your Mac onto the Simulator window - it lands in Photos. In the app, tap **Choose image from gallery**. |
| Picked image is rejected as "No QR code found" | Pick a higher-resolution screenshot. The desktop wizard's QR is 512x512 - that's plenty. Avoid screenshots with the QR off-centre or with reflections. |

## During pairing

| Symptom | Most likely cause | What to do |
| --- | --- | --- |
| Mobile shows "Waiting for desktop offer" forever | Mobile's `sessions/{code}/client` is not visible to the desktop because of rules. | Re-check the rules pasted in Firebase; confirm both peers signed in (the desktop log will show "Signed in as ..."). Check that the code on the phone exactly matches the desktop. |
| Desktop log shows "Client connected" but mobile shows no video | WebRTC negotiation stalled. | Look at the log for "Negotiation failed" or "Failed to set remote description". Confirm both peers can reach the STUN servers (`stun.l.google.com:19302`). |
| Mobile's status flips between `connecting` and `failed` | ICE could not find a path - typically symmetric NAT or strict firewall. | Add a TURN server to `ICE_SERVERS` in `desktop/src/renderer/renderer.js` and `DEFAULT_ICE_SERVERS` in `mobile/android/app/src/main/.../webrtc/WebRTCClient.kt`. |
| Connection state reaches "connected" but RTT in the desktop UI stays `-` | Data channel never opened. | Confirm the desktop log includes "Input data channel open" within a couple of seconds of `connected`. If not, examine the SDP for the `m=application` line. |

## During an active session

| Symptom | Most likely cause | What to do |
| --- | --- | --- |
| Cursor moves but laggy | The desktop's renderer is at 1:1 input dispatch instead of frame-coalesced. | Verify `attachDataChannel` includes the `pendingMove` / `requestAnimationFrame` block. This was added to mitigate input flooding. |
| Cursor jumps to the wrong monitor | Multi-monitor desktop; `listScreenSources` returned the wrong one first. | Add a chooser UI, or sort sources so the primary monitor is first. |
| Typed characters appear duplicated or out of order | Soft keyboard is sending both `type` (via the hidden EditText) and `keydown` (via hardware listeners) for the same physical key. | Confirm the device has a real hardware keyboard; if not, the `onKeyDown` overrides should not be firing. Check that `AndroidKeyMapper.toProtocolKey(keyCode)` returns `null` for the affected keys. |
| Shift, Ctrl, or Alt gets "stuck" pressed on the desktop | A bug in `InputController._heldKeys` / `_heldModifiers`. | Restart the desktop session via the Restart button to release everything. Verify the tracking sets are reset between sessions. |
| Mobile shows "Desktop is offline" mid-session | Desktop process died or lost network. | Restart the desktop. The mobile will not auto-reconnect to a new pairing code - the user has to go back and re-enter. |
| Black or frozen video on the phone | OS revoked screen-capture permission on the desktop. | macOS: System Settings -> Privacy & Security -> Screen Recording, enable for Electron. Linux: re-grant via the desktop portal dialog. |

## During shutdown

| Symptom | Most likely cause | What to do |
| --- | --- | --- |
| Desktop window closes but the process keeps running | Some Electron background work is keeping the event loop alive. | The default lifecycle quits the app when the window closes on Windows and Linux. On macOS this is intentional; press Cmd-Q to fully quit. |
| `sessions/{code}` stays in Firebase after both peers disconnect | `onDisconnect().remove()` not configured, or the server never noticed the disconnect. | The desktop's `SessionController.stop()` explicitly calls `clearSession`. Confirm it ran by checking the log for "Stopped". |

## Build / development

| Symptom | Most likely cause | What to do |
| --- | --- | --- |
| `npm test` fails with `crypto` resolution error | You are bundling for the browser without Node 19+ available. | The `getRandomBytes` helper in `session-id.js` relies on `globalThis.crypto`. Use Node 19 or newer. The shipping package.json already declares this in `engines`. |
| `npm run build:renderer` shows a 1.2MB bundle warning | Firebase modular SDK is included. | This is expected. The bundle is mostly compressed code; gzip brings it under 400 KB. |
| `gradle test` in `mobile/android/` fails with "Cannot find a Java installation" | The JVM toolchain version does not match. | Install JDK 17, or remove the toolchain block in `app/build.gradle.kts` to fall back to the system JDK. |
| `gradle test` in `mobile/android/verify/` fails to download plugins | Network access blocked. | Configure a proxy via `~/.gradle/gradle.properties` (`systemProp.http.proxyHost=...`) or use a local Maven mirror. |
| Android instrumented tests time out | No connected device / emulator. | Run `adb devices` and confirm at least one device appears. The script will skip this step automatically if `ANDROID_HOME` is unset. |

## Where to look next

- For protocol questions: [PROTOCOL.md](PROTOCOL.md).
- For lifecycle questions: [CONNECTION_FLOW.md](CONNECTION_FLOW.md).
- For module questions: [DESKTOP.md](DESKTOP.md), [ANDROID.md](ANDROID.md).
- For test infrastructure questions: [TESTING.md](TESTING.md).
