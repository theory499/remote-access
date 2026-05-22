'use strict';

const { generateMobileQr } = require('../../src/main/qr-generator');

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
  databaseURL: validWeb.databaseURL
};

describe('generateMobileQr', () => {
  test('returns a data URL and the payload object', async () => {
    const { dataUrl, payload, encoded } = await generateMobileQr({
      backend: 'firebase',
      web: validWeb,
      android: validAndroid,
      ios: null
    });
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(payload.backend).toBe('firebase');
    expect(payload.android).toEqual(validAndroid);
    expect(payload.ios).toBeNull();
    expect(payload.databaseURL).toBe(validWeb.databaseURL);
    // payload should round-trip through JSON
    expect(JSON.parse(encoded)).toEqual(payload);
  });

  test('throws on invalid input', async () => {
    await expect(generateMobileQr({ backend: 'firebase' })).rejects.toThrow(/Invalid/);
  });
});
