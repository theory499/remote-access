'use strict';

const { probeFirebaseWebConfig } = require('../../src/main/config-validator');

const validWeb = {
  apiKey: 'AIza-key',
  authDomain: 'demo.firebaseapp.com',
  databaseURL: 'https://demo-default-rtdb.firebaseio.com',
  projectId: 'demo',
  appId: '1:1:web:abc'
};

function buildDeps(overrides = {}) {
  const calls = [];
  const baseDeps = {
    initializeApp: jest.fn((cfg, name) => { calls.push(['initializeApp', name]); return { name }; }),
    deleteApp: jest.fn(async (app) => { calls.push(['deleteApp', app.name]); }),
    getAuth: jest.fn(() => ({})),
    signInAnonymously: jest.fn(async () => ({ user: { uid: 'probe-uid' } })),
    signOut: jest.fn(async () => {}),
    getDatabase: jest.fn(() => ({})),
    ref: jest.fn((_db, path) => ({ path })),
    set: jest.fn(async () => {}),
    get: jest.fn(async () => ({ exists: () => true })),
    remove: jest.fn(async () => {}),
    serverTimestamp: jest.fn(() => 'server-ts')
  };
  return { deps: { ...baseDeps, ...overrides }, calls };
}

describe('probeFirebaseWebConfig', () => {
  test('returns ok with the resolved uid when the round-trip succeeds', async () => {
    const { deps } = buildDeps();
    const result = await probeFirebaseWebConfig(validWeb, deps);
    expect(result).toEqual({ ok: true, uid: 'probe-uid' });
    expect(deps.initializeApp).toHaveBeenCalled();
    expect(deps.set).toHaveBeenCalled();
    expect(deps.get).toHaveBeenCalled();
  });

  test('reports a shape error when the config is missing fields', async () => {
    const { deps } = buildDeps();
    const result = await probeFirebaseWebConfig({}, deps);
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('shape');
    expect(deps.initializeApp).not.toHaveBeenCalled();
  });

  test('returns a friendly message when anonymous sign-in is not enabled', async () => {
    const { deps } = buildDeps({
      signInAnonymously: jest.fn(async () => {
        const err = new Error('not enabled');
        err.code = 'auth/configuration-not-found';
        throw err;
      })
    });
    const result = await probeFirebaseWebConfig(validWeb, deps);
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('auth');
    expect(result.error).toMatch(/Anonymous sign-in is not enabled/);
  });

  test('returns a friendly message when database rules block the write', async () => {
    const { deps } = buildDeps({
      set: jest.fn(async () => {
        const err = new Error('PERMISSION_DENIED: Permission denied');
        err.code = 'PERMISSION_DENIED';
        throw err;
      })
    });
    const result = await probeFirebaseWebConfig(validWeb, deps);
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('write');
    expect(result.error).toMatch(/Realtime Database rules/);
  });

  test('reports a read failure when the snapshot does not exist', async () => {
    const { deps } = buildDeps({
      get: jest.fn(async () => ({ exists: () => false }))
    });
    const result = await probeFirebaseWebConfig(validWeb, deps);
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('read');
  });

  test('cleans up the temporary app even when sign-in fails', async () => {
    const { deps } = buildDeps({
      signInAnonymously: jest.fn(async () => {
        throw new Error('boom');
      })
    });
    await probeFirebaseWebConfig(validWeb, deps);
    expect(deps.deleteApp).toHaveBeenCalled();
  });
});
