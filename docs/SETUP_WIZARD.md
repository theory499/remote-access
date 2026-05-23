# Setup wizard

The desktop host ships without any baked-in backend credentials. The
first time you launch it, it opens a five-step wizard that walks you
through Firebase setup, validates the configuration by making a real
authenticated round-trip, and generates a QR code that the mobile apps
read to configure themselves.

## When the wizard appears

- **First launch on a fresh machine** — there is no
  `backend-config.json` in Electron's `userData` directory, so the
  main process loads `setup.html` instead of `index.html`.
- **You click "Change backend configuration"** in the running app's
  session view. That action calls `config:reset` which removes the
  stored config and re-routes the window to `setup.html`.

You never need to edit a source file or restart with new environment
variables.

## Where the configuration lives

| Platform | Path |
| --- | --- |
| macOS    | `~/Library/Application Support/Proxia/backend-config.json` |
| Linux    | `~/.config/Proxia/backend-config.json` |
| Windows  | `%APPDATA%\Proxia\backend-config.json` |

The file is written with mode `0600` so only the current user can
read it. You can delete it manually to force the wizard back to step 1.

## Step 1 — Choose a backend

A future version may add more options (a self-hosted signalling
server, AWS, etc.). For now there is one choice: **Firebase**.

## Step 2 — Paste the Firebase web config

```json
{
  "apiKey": "...",
  "authDomain": "your-project.firebaseapp.com",
  "databaseURL": "https://your-project-default-rtdb.firebaseio.com",
  "projectId": "your-project",
  "appId": "1:1234567890:web:..."
}
```

You can copy the entire object verbatim from
**Firebase Console &rarr; Project settings &rarr; Your apps &rarr; Web app**.
The wizard accepts:

- The bare object: `{ "apiKey": "...", ... }`.
- The full assignment statement: `{ "firebaseConfig": { "apiKey": "...", ... } }`
  (it unwraps the `firebaseConfig` key automatically).

Click **Test connection**. The wizard does four things in sequence:

1. Validates the shape (every required field is present and non-empty).
2. Calls `signInAnonymously` against your Firebase project.
3. Writes a tiny test record to
   `__healthcheck__/{uid}` in your Realtime Database.
4. Reads that record back and deletes it.

If any step fails, the wizard surfaces a friendly diagnostic in line:

| Failure | Diagnostic |
| --- | --- |
| `auth/configuration-not-found` | "Anonymous sign-in is not enabled in this Firebase project. Open Firebase Console &gt; Authentication &gt; Sign-in method, enable Anonymous, then retry." |
| `auth/api-key-not-valid` / `auth/invalid-api-key` | "The apiKey in the pasted config is not valid for this project." |
| `PERMISSION_DENIED` on the write | "The Realtime Database rules blocked the test write. Publish the rules from the next step and retry." |
| Database URL missing or wrong | "The databaseURL in the pasted config is missing or points to a different project." |

The wizard also exposes a **Copy rules** button under the
"Don't have it yet?" disclosure. It reads
`firebase/database.rules.json` from the repo and writes its contents
to your clipboard so you can paste them into the Realtime Database
rules tab.

## Step 3 — Android config

If you plan to use the Android client, paste the four Android-specific
values from your Firebase project's `google-services.json` (you don't
need to download the file - just open it once in the browser preview
or copy from Firebase Console &rarr; Add Android app):

- `client[0].api_key[0].current_key` &rarr; **API key**.
- `client[0].client_info.mobilesdk_app_id` &rarr; **Application ID**.
- `project_info.project_id` &rarr; **Project ID**.
- `project_info.firebase_url` &rarr; **Database URL**.

If you only need iOS, tick the **Skip Android** checkbox.

## Step 4 — iOS config

If you plan to use the iOS client, paste the five iOS-specific values
from your project's `GoogleService-Info.plist`:

- `API_KEY`           &rarr; **API key**.
- `GOOGLE_APP_ID`     &rarr; **Google app ID**.
- `PROJECT_ID`        &rarr; **Project ID**.
- `DATABASE_URL`      &rarr; **Database URL**.
- `BUNDLE_ID`         &rarr; **Bundle ID**.

If you only need Android, tick the **Skip iOS** checkbox. You cannot
skip both — at least one mobile platform must be configured.

## Step 5 — Pair the phone

The wizard generates a QR code containing all the values you just
entered. Open the Proxia app on your phone and either:

- **Point the camera at the QR** (live scan), or
- **Tap "Choose image from gallery"** and pick a saved screenshot of
  the QR.

The gallery option exists specifically for emulator / simulator
testing where the virtual camera shows a scripted scene rather than
your desktop. The simplest workflow on an Android emulator:

```sh
# Right-click the QR in the desktop wizard, "Save image as qr.png", then:
adb push qr.png /sdcard/Download/qr.png
```

The PNG immediately shows up in the emulator's gallery, ready to pick.

On an iOS Simulator, drag the PNG onto the Simulator window - it
will land in Photos.

The mobile apps process the QR like this:

1. The Android client reads the `android` field from the payload and
   discards the `ios` field; the iOS client does the opposite.
2. The chosen fields are persisted (Android `SharedPreferences`, iOS
   `UserDefaults`).
3. Firebase is initialised in-process with `FirebaseOptions` built
   from the persisted values.
4. Anonymous sign-in is triggered; once the phone gets a UID it is
   ready to accept a pairing code.

Click **Save and start**. The wizard:

1. Writes the validated config to
   `userData/backend-config.json` (mode `0600`).
2. Switches the window from `setup.html` to `index.html`.
3. The session renderer reads the config via `window.api.getActiveConfig()`,
   initialises Firebase, signs in, and shows the pairing code.

## Re-running the wizard

In the running session view, click **Change backend configuration**.
The renderer calls `window.api.resetConfig()` (which deletes
`backend-config.json`) and `window.api.enterSetup()` (which re-loads
`setup.html`). You can also delete `backend-config.json` manually
from the file system between launches.

## Security note

The QR code contains live Firebase credentials. Anyone who scans it
can configure a phone against your Firebase project, where they could
attempt to sign in anonymously and probe the rules. The rules in
`firebase/database.rules.json` are designed to prevent third parties
from hijacking active sessions, but you should still treat the QR
code as a deployment key: do not share it publicly, and re-generate
it (Project settings &rarr; rotate API key) if you suspect leakage.

## Where to look next

- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) — what the wizard guides you
  through, plus the manual Firebase Console steps that the wizard
  cannot automate (project creation, Anonymous Auth toggle, rules
  publish).
- [CONNECTION_FLOW.md](CONNECTION_FLOW.md) — what happens after the
  config is in place.
- [SECURITY.md](SECURITY.md) — full threat model including the QR
  code as a credential.
