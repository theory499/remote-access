# Firebase setup

The remote desktop suite uses three Firebase services:

- **Authentication** - anonymous sign-in so both peers can read / write
  signalling data with stable UIDs.
- **Realtime Database** - WebRTC offer / answer / ICE candidate exchange,
  plus presence tracking.
- **Cloud Messaging** *(optional)* - wake the desktop from low-power
  state. Not required for core functionality.

## 1. Create a project

1. Open [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Add project**, give it a name (for example
   `remote-desktop`), accept the defaults, and create the project.

## 2. Enable Anonymous Authentication

1. In the project, open **Build > Authentication**.
2. Click **Get started**.
3. On the **Sign-in method** tab, enable **Anonymous** and save.

## 3. Enable Realtime Database

1. Open **Build > Realtime Database**.
2. Click **Create database**, choose a location, and start in
   **locked mode**.
3. On the **Rules** tab, paste the contents of
   `firebase/database.rules.json` and **Publish**.

## 4. Register the desktop (web) app

1. In **Project settings > General**, scroll to **Your apps** and click
   the `</>` icon.
2. Register the app (any nickname; do not enable hosting).
3. Copy the generated `firebaseConfig` object.
4. Open `desktop/src/shared/firebase-config.js` and replace the
   placeholder object with your configuration.

## 5. Register the Android app

1. In the same **Your apps** section, click the Android icon.
2. Use package name `com.remotedesktop` (or change it everywhere - see
   `mobile/app/build.gradle.kts`).
3. Download the generated `google-services.json` and copy it to
   `mobile/app/google-services.json`.

## 6. Verify

- Desktop: `cd desktop && npm install && npm start` should display a
  six-character pairing code and the status "Waiting for client".
- Android: `cd mobile && ./gradlew installDebug` should install the app
  and signing in anonymously should succeed.

If anonymous sign-in fails, double-check step 2 - Authentication must be
enabled before the database rules will allow signalling.
