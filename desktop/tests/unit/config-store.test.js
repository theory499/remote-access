'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { ConfigStore, FILE_NAME } = require('../../src/main/config-store');

const validWeb = {
  apiKey: 'AIza-key',
  authDomain: 'demo.firebaseapp.com',
  databaseURL: 'https://demo-default-rtdb.firebaseio.com',
  projectId: 'demo',
  appId: '1:1:web:abc'
};

const fullConfig = {
  backend: 'firebase',
  web: validWeb,
  android: null,
  ios: null
};

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'config-store-'));
}

describe('ConfigStore', () => {
  let dir;
  beforeEach(() => { dir = makeTempDir(); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('load returns null when no file exists', () => {
    const store = new ConfigStore({ userDataDir: dir });
    expect(store.load()).toBeNull();
    expect(store.exists()).toBe(false);
  });

  test('save writes the file with 0600 permissions and load reads it back', () => {
    const store = new ConfigStore({ userDataDir: dir });
    store.save(fullConfig);
    const stat = fs.statSync(path.join(dir, FILE_NAME));
    // permissions are not asserted on Windows-only nodes, but the file mode bits should be 0600
    expect((stat.mode & 0o777)).toBe(0o600);

    const reloaded = new ConfigStore({ userDataDir: dir });
    expect(reloaded.load()).toEqual(fullConfig);
  });

  test('save rejects an invalid config', () => {
    const store = new ConfigStore({ userDataDir: dir });
    expect(() => store.save({ backend: 'firebase' })).toThrow(/Invalid/);
  });

  test('clear removes the file', () => {
    const store = new ConfigStore({ userDataDir: dir });
    store.save(fullConfig);
    store.clear();
    expect(store.exists()).toBe(false);
  });

  test('load returns null when the file is corrupt', () => {
    fs.writeFileSync(path.join(dir, FILE_NAME), 'not json');
    const store = new ConfigStore({ userDataDir: dir });
    expect(store.load()).toBeNull();
  });

  test('load returns null when the stored config is invalid', () => {
    fs.writeFileSync(
      path.join(dir, FILE_NAME),
      JSON.stringify({ backend: 'firebase', web: { apiKey: 'x' } })
    );
    const store = new ConfigStore({ userDataDir: dir });
    expect(store.load()).toBeNull();
  });
});
