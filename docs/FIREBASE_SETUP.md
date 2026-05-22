# Firebase setup

The desktop host now ships with a [setup wizard](SETUP_WIZARD.md) that
handles 90% of this for you. The manual Firebase Console steps that
the wizard cannot perform on your behalf are:

1. **Create the project.**
2. **Enable Anonymous sign-in.**
3. **Publish the Realtime Database security rules.**

Everything else — pasting credentials, validating them, generating QR
codes for the mobile apps — happens inside the wizard.

## 1. Create the Firebase project

1. Open [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Add project**, give it a name (for example
   `remote-desktop`), accept the defaults, **Create project**.

## 2. Enable Anonymous Authentication

1. **Build &rarr; Authentication &rarr; Get started**.
2. **Sign-in method** tab &rarr; **Anonymous** &rarr; toggle **Enable**
   &rarr; **Save**.

If you skip this step the desktop wizard's "Test connection" will fail
at the auth stage with the message:

> Anonymous sign-in is not enabled in this Firebase project. Open
> Firebase Console > Authentication > Sign-in method, enable Anonymous,
> then retry.

## 3. Create the Realtime Database

1. **Build &rarr; Realtime Database &rarr; Create database**, pick a
   location, start in **locked mode**.
2. **Rules** tab &rarr; replace the content with the contents of
   `firebase/database.rules.json` (or use the **Copy rules** button in
   the desktop wizard's step 2) &rarr; **Publish**.

If you skip the rules step, the desktop wizard's "Test connection"
will fail at the write stage with:

> The Realtime Database rules blocked the test write. Publish the
> rules from the next step and retry.

## 4. Register your client apps

The wizard needs values from one or both of these:

- **Web app** — required for the desktop. **Project settings &rarr;
  Your apps &rarr; `</>`** (Add Web app).
- **Android app** — required for the Android client. **Add app &rarr;
  Android**, use package name `com.remotedesktop`. **You do not need
  to download `google-services.json`** - the wizard only needs four
  values from it, which you can read in the Firebase Console preview.
- **iOS app** — required for the iOS client. **Add app &rarr; iOS+**,
  use bundle ID `com.remotedesktop.ios`. Same as Android: no plist
  download required.

## 5. Open the desktop and run the wizard

```sh
cd desktop && npm start
```

Step through the wizard — the rest is automatic.

## Re-running the wizard

Inside the running session, click **Change backend configuration**.
That clears the stored config and re-opens the wizard.

## Cross-references

- [SETUP_WIZARD.md](SETUP_WIZARD.md) — what each wizard step does and
  the diagnostics it surfaces.
- [SECURITY.md](SECURITY.md) — what to treat as sensitive (hint: the
  QR code) and what the rules protect against.
