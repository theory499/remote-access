'use strict';

const bc = require('../../src/shared/backend-config');

const validWeb = {
  apiKey: 'AIza-key',
  authDomain: 'demo.firebaseapp.com',
  databaseURL: 'https://demo-default-rtdb.firebaseio.com',
  projectId: 'demo',
  appId: '1:1:web:abc'
};

const validAndroid = {
  apiKey: 'AIza-key',
  applicationId: '1:1:android:abc',
  projectId: 'demo',
  databaseURL: 'https://demo-default-rtdb.firebaseio.com'
};

const validIos = {
  apiKey: 'AIza-key',
  googleAppId: '1:1:ios:abc',
  projectId: 'demo',
  databaseURL: 'https://demo-default-rtdb.firebaseio.com',
  bundleId: 'com.remotedesktop.ios'
};

describe('validateFirebaseWebConfig', () => {
  test('accepts a complete config and trims whitespace', () => {
    const padded = { ...validWeb, apiKey: '  AIza-key  ' };
    expect(bc.validateFirebaseWebConfig(padded)).toEqual(validWeb);
  });

  test('rejects when a required field is missing', () => {
    for (const key of bc.WEB_REQUIRED) {
      const broken = { ...validWeb };
      delete broken[key];
      expect(bc.validateFirebaseWebConfig(broken)).toBeNull();
    }
  });

  test('rejects when a required field is empty', () => {
    expect(bc.validateFirebaseWebConfig({ ...validWeb, apiKey: '' })).toBeNull();
    expect(bc.validateFirebaseWebConfig({ ...validWeb, projectId: '   ' })).toBeNull();
  });

  test('rejects non-object input', () => {
    expect(bc.validateFirebaseWebConfig(null)).toBeNull();
    expect(bc.validateFirebaseWebConfig('abc')).toBeNull();
    expect(bc.validateFirebaseWebConfig(42)).toBeNull();
  });
});

describe('validateFirebaseAndroidConfig', () => {
  test('accepts a complete config', () => {
    expect(bc.validateFirebaseAndroidConfig(validAndroid)).toEqual(validAndroid);
  });

  test('rejects when applicationId is missing', () => {
    const broken = { ...validAndroid };
    delete broken.applicationId;
    expect(bc.validateFirebaseAndroidConfig(broken)).toBeNull();
  });
});

describe('validateFirebaseIosConfig', () => {
  test('accepts a complete config', () => {
    expect(bc.validateFirebaseIosConfig(validIos)).toEqual(validIos);
  });

  test('rejects when bundleId is missing', () => {
    const broken = { ...validIos };
    delete broken.bundleId;
    expect(bc.validateFirebaseIosConfig(broken)).toBeNull();
  });
});

describe('validateFullConfig', () => {
  test('accepts web + both mobile platforms', () => {
    const result = bc.validateFullConfig({
      backend: 'firebase',
      web: validWeb,
      android: validAndroid,
      ios: validIos
    });
    expect(result.backend).toBe('firebase');
    expect(result.web).toEqual(validWeb);
    expect(result.android).toEqual(validAndroid);
    expect(result.ios).toEqual(validIos);
  });

  test('accepts web only with null mobile platforms', () => {
    const result = bc.validateFullConfig({
      backend: 'firebase',
      web: validWeb,
      android: null,
      ios: null
    });
    expect(result).not.toBeNull();
    expect(result.android).toBeNull();
    expect(result.ios).toBeNull();
  });

  test('rejects unknown backend', () => {
    expect(bc.validateFullConfig({ backend: 'aws', web: validWeb })).toBeNull();
  });

  test('rejects when nested config is malformed', () => {
    expect(bc.validateFullConfig({
      backend: 'firebase',
      web: validWeb,
      android: { apiKey: 'x' }
    })).toBeNull();
  });
});

describe('buildMobilePayload', () => {
  test('produces a payload with versioning and database URL', () => {
    const payload = bc.buildMobilePayload({
      backend: 'firebase',
      web: validWeb,
      android: validAndroid,
      ios: validIos
    });
    expect(payload).toEqual({
      v: 1,
      backend: 'firebase',
      android: validAndroid,
      ios: validIos,
      projectId: 'demo',
      databaseURL: validWeb.databaseURL
    });
  });

  test('omits the platform that was skipped', () => {
    const payload = bc.buildMobilePayload({
      backend: 'firebase',
      web: validWeb,
      android: validAndroid,
      ios: null
    });
    expect(payload.ios).toBeNull();
    expect(payload.android).toEqual(validAndroid);
  });

  test('returns null for invalid input', () => {
    expect(bc.buildMobilePayload({ backend: 'firebase' })).toBeNull();
  });
});
