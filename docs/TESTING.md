# Testing

This document describes the testing strategy and how to run every test
in the repository.

## Layers

| Layer | Scope | Runtime |
| ----- | ----- | ------- |
| Unit | Pure protocol / encoder / utility logic | Jest (desktop), JUnit (Android) |
| Component | Signalling client, input controller, WebRTC client | Jest with mocked transports, JUnit with mocked Firebase |
| Integration | Two signalling clients exchanging payloads end-to-end against an in-memory fake | Jest |
| End-to-end | One desktop host plus one Android client against a real Firebase project | Manual |

## Desktop

```
cd desktop
npm install
npm test            # unit + integration
npm run test:watch  # development
npm run lint        # optional lint pass
```

Tests live under `desktop/tests/`:

- `tests/unit/protocol.test.js` - schema validation for every protocol
  message.
- `tests/unit/input-controller.test.js` - verifies that protocol events
  call the right `nut.js` primitives with the right arguments.
- `tests/unit/screen-capture.test.js` - error handling when no sources
  are available.
- `tests/unit/session-id.test.js` - pairing code generator entropy and
  format.
- `tests/integration/signalling.test.js` - two `FirebaseSignaling`
  instances on an in-memory database exchange offer / answer / ICE
  candidates and tear down cleanly.

The integration suite uses a `FakeFirebaseDatabase` defined in
`tests/integration/fake-firebase.js`. It implements the subset of the
Realtime Database API used by `FirebaseSignaling` so the real Firebase
network is never touched.

## Android

```
cd mobile
./gradlew test                          # JVM unit tests
./gradlew connectedAndroidTest          # instrumented tests
```

Unit tests under `mobile/app/src/test/`:

- `InputEventEncoderTest.kt` - JSON encoding for every event type.
- `RemoteSurfaceControllerTest.kt` - touch-to-normalised mapping.
- `PairingCodeTest.kt` - validation of user input.

Instrumented tests under `mobile/app/src/androidTest/` require a
connected device or emulator and a Firebase configuration. They cover
the activity launch path and that the pairing flow renders correctly.

## End-to-end checklist

A real run cannot be fully automated because it requires hardware. Use
this checklist after wiring a real Firebase project:

1. Launch the desktop host. Verify the pairing code appears and that
   `sessions/{code}/host` exists in the Firebase console.
2. Launch the Android client, sign in, and enter the code. Verify
   `sessions/{code}/client` appears.
3. Within five seconds the connection state should reach `connected`
   on both peers, and the live desktop screen should appear on the
   phone.
4. Tap on the phone and verify the desktop cursor moves to the same
   relative position. Long-press should drag.
5. Open the soft keyboard on the phone and type. Each character should
   appear on the focused desktop window.
6. Close the Android app. The desktop should detect the disconnect
   within ten seconds and return to "Waiting for client".
7. Close the desktop app. The Android app should detect the disconnect
   within ten seconds and return to the pairing screen.
