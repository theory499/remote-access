'use strict';

const { validateFirebaseWebConfig } = require('../shared/backend-config');
const { generate: generateSessionCode } = require('../shared/session-id');

async function probeFirebaseWebConfig(webConfig, deps) {
  const valid = validateFirebaseWebConfig(webConfig);
  if (!valid) {
    return { ok: false, stage: 'shape', error: 'Required fields are missing' };
  }

  const {
    initializeApp,
    deleteApp,
    getAuth,
    signInAnonymously,
    signOut,
    getDatabase,
    ref,
    set,
    get,
    remove,
    serverTimestamp
  } = deps;

  const appName = `probe-${Date.now()}`;
  const app = initializeApp(valid, appName);
  try {
    const auth = getAuth(app);
    let signInResult;
    try {
      signInResult = await signInAnonymously(auth);
    } catch (err) {
      return {
        ok: false,
        stage: 'auth',
        error: friendlyAuthError(err),
        rawCode: err.code || null
      };
    }
    const uid = signInResult.user.uid;

    const database = getDatabase(app);

    // The shipped Realtime Database rules only allow writes under
    // sessions/{code}/{host|client}. To test that the rules and the
    // database are reachable, we briefly claim a host slot on a
    // randomly generated probe code, read it back, then delete the
    // entire session node. The code is opaque to any concurrent user
    // because it is freshly generated for this probe.
    const probeCode = generateSessionCode();
    const sessionRef = ref(database, `sessions/${probeCode}`);
    const probeRef = ref(database, `sessions/${probeCode}/host`);

    try {
      await set(probeRef, { uid, createdAt: serverTimestamp() });
    } catch (err) {
      return {
        ok: false,
        stage: 'write',
        error: friendlyWriteError(err),
        rawCode: err.code || null
      };
    }

    try {
      const snap = await get(probeRef);
      if (!snap.exists()) {
        return { ok: false, stage: 'read', error: 'Wrote but cannot read back the probe entry' };
      }
    } catch (err) {
      return {
        ok: false,
        stage: 'read',
        error: friendlyWriteError(err),
        rawCode: err.code || null
      };
    }

    try { await remove(sessionRef); } catch (_) { /* ignore cleanup */ }
    try { await signOut(auth); } catch (_) { /* ignore cleanup */ }

    return { ok: true, uid, probeCode };
  } finally {
    try { await deleteApp(app); } catch (_) { /* ignore */ }
  }
}

function friendlyAuthError(err) {
  switch (err.code) {
    case 'auth/configuration-not-found':
      return 'Anonymous sign-in is not enabled in this Firebase project. Open Firebase Console > Authentication > Sign-in method, enable Anonymous, then retry.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'The apiKey in the pasted config is not valid for this project.';
    case 'auth/network-request-failed':
      return 'Network request failed while contacting Firebase. Check connectivity, VPN, or firewall.';
    default:
      return err.message || 'Sign-in failed.';
  }
}

function friendlyWriteError(err) {
  const message = err.message || '';
  if (err.code === 'PERMISSION_DENIED' || /permission_denied/i.test(message)) {
    return 'The Realtime Database rules blocked the test write. Paste the rules from firebase/database.rules.json into Firebase Console > Realtime Database > Rules and click Publish, then retry.';
  }
  if (/database url/i.test(message)) {
    return 'The databaseURL in the pasted config is missing or points to a different project.';
  }
  return message || 'Database probe failed.';
}

module.exports = { probeFirebaseWebConfig };
