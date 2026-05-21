# Development guide

This document describes how to set up a local development environment,
run the app, and contribute changes.

## Prerequisites

| Tool | Minimum version | Used for |
| --- | --- | --- |
| Node.js | 19 | Desktop runtime (`getRandomBytes` relies on the standard Web Crypto API exposed on `globalThis`). |
| npm | 9 | Desktop dependency installation. |
| Java JDK | 17 | Gradle and Android compilation. |
| Gradle | 8.5+ | Building the mobile module. The wrapper specifies 8.14.3 but anything 8.x compatible with AGP 8.5 will work. |
| Android SDK | API 34 platform, build-tools 34, command-line tools | Mobile builds and tests. Not required for the JVM-only verification project. |
| A device or emulator | Android 7.0+ | Mobile instrumented tests and manual end-to-end testing. |

## First-time setup

```sh
# Clone and configure
git clone <repo-url>
cd remote-access

# Desktop
cd desktop
npm install

# Mobile (only if you have the Android SDK)
cd ../mobile
gradle wrapper            # generates ./gradlew
# Place your downloaded google-services.json into app/google-services.json

# Firebase
# See docs/FIREBASE_SETUP.md and paste firebase/database.rules.json into the console.
```

You also need to fill in two configuration files:
- `desktop/src/shared/firebase-config.js` - your Firebase web config.
- `mobile/app/google-services.json` - your Firebase Android config.

The repository ships placeholder versions of both so the project lays
out cleanly without these files; the app will not actually connect to
Firebase until you replace them.

## Running the desktop locally

```sh
cd desktop
npm start                   # builds the renderer bundle and runs Electron
```

For iterative work, run the renderer bundler in watch mode in a second
terminal:

```sh
npm run watch:renderer
```

When you edit `src/renderer/renderer.js`, the bundler regenerates
`renderer.bundle.js`; reload the Electron window with Ctrl/Cmd+R to
pick up the change. Main-process and preload changes still require an
Electron restart.

## Running the mobile app locally

```sh
cd mobile
./gradlew installDebug      # installs onto the connected device
./gradlew run               # alternative if you have only an emulator
```

The Android Studio "Run" action wraps these commands with the
auto-deploy and log streaming that you would expect.

## Testing during development

For tight feedback, run only the relevant layer:

```sh
# Desktop unit + integration
cd desktop && npm test

# Desktop with file watching
cd desktop && npm run test:watch

# Mobile JVM-safe verification (no Android SDK needed)
cd mobile/verify && gradle test

# Mobile full unit tests (Android SDK required)
cd mobile && ./gradlew test

# Mobile instrumented tests (device or emulator required)
cd mobile && ./gradlew connectedAndroidTest
```

Run everything the host environment can support:

```sh
bash scripts/test-all.sh
```

See [TESTING.md](TESTING.md) for an exhaustive breakdown.

## Branch hygiene

Development happens on feature branches; the main integration branch
in this repository is `main`. The branch convention used by automated
contributions is `claude/<descriptor>-<short-id>`; the current working
branch is `claude/affectionate-davinci-MTfnb`.

When opening a pull request, include:

- A short summary of the change.
- The test layers you ran locally.
- Screenshots or a screen recording if the change affects the UI on
  either side.

## Coding conventions

### JavaScript / Node

- The repository uses `eslint` with the configuration in
  `desktop/.eslintrc.json`. Run `npm run lint`.
- Prefer CommonJS in shared modules so they can be loaded both by the
  Electron main process and by the renderer (which uses esbuild for
  ESM-to-CJS interop).
- Validate at boundaries. Inside the desktop process, modules can
  assume their inputs are valid - it is the renderer's job to validate
  network payloads.

### Kotlin

- Match the existing style: four-space indentation, expression bodies
  for short methods, `data class` for value types.
- Keep Android-framework-dependent code under `ui/` or in clearly
  named files (`AndroidKeyMapper`); everything else should be pure
  Kotlin so it can run under `mobile/verify/`.
- Use the existing `SignalingClient` / `WebRTCClient` callback-based
  APIs rather than `kotlinx.coroutines` unless there is a clear win,
  to keep the surface narrow.

### Documentation

- Every public component should have a one-line description in
  [COMPONENTS.md](COMPONENTS.md) and a more detailed entry in either
  [DESKTOP.md](DESKTOP.md) or [MOBILE.md](MOBILE.md).
- When changing the wire protocol, update both
  [PROTOCOL.md](PROTOCOL.md) and the cross-platform compatibility
  tests in `desktop/tests/unit/protocol.test.js`.

## Adding a new input event type

A worked example to illustrate where things plug in.

1. **Decide the JSON shape.** Add it to
   [PROTOCOL.md](PROTOCOL.md#message-types).
2. **Extend the validator.** Add a case in `desktop/src/shared/protocol.js`
   and update the unit tests in `tests/unit/protocol.test.js`.
3. **Extend the encoder.** Add a function in
   `mobile/.../input/InputEventEncoder.kt` and a test in
   `app/src/test/.../InputEventEncoderTest.kt`.
4. **Extend the controller.** Add a method on
   `desktop/src/main/input-controller.js` and a test in
   `tests/unit/input-controller.test.js` (with the mock in
   `tests/mocks/nut-js.js` if you need new primitives).
5. **Wire up the producer.** Call the new encoder from
   `RemoteControlActivity` or `MainActivity` where it makes sense.
6. **Run the cross-platform compatibility test set in
   `desktop/tests/unit/protocol.test.js`** to make sure the literal
   JSON your encoder produces still passes the validator.

## Adding a new Firebase path

If you add a new sub-node under `sessions/{code}/`, update the
security rules in `firebase/database.rules.json` so they explicitly
allow or deny it. The catch-all `"$other": { ".validate": false }`
entry will reject anything unspecified.

## Versioning and releases

The current versioning scheme is plain SemVer in `package.json`
(`1.0.0`) and `mobile/app/build.gradle.kts` (`versionName = "1.0.0"`).
For coordinated releases:

1. Bump the version in both places.
2. Run `npm run package` in `desktop/` to produce installer artifacts.
3. Run `./gradlew assembleRelease` in `mobile/` to produce a signed
   APK / AAB (requires a keystore).
4. Tag the commit (`vX.Y.Z`) and attach the artifacts to a GitHub
   release.

## Where to read next

- [TESTING.md](TESTING.md) - everything about the test layers.
- [SECURITY.md](SECURITY.md) - things to think about before deploying.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - common pitfalls during
  development.
