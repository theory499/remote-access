'use strict';

const {
  parseGoogleServicesJson,
  parseGoogleServiceInfoPlist
} = require('../../src/shared/firebase-file-parser');

const validWebConfig = {
  apiKey: 'AIza-web',
  authDomain: 'demo.firebaseapp.com',
  databaseURL: 'https://demo-default-rtdb.firebaseio.com',
  projectId: 'demo',
  appId: '1:1:web:abc'
};

function buildGoogleServicesJson(overrides = {}) {
  return JSON.stringify({
    project_info: {
      project_number: '1234567890',
      project_id: 'demo',
      storage_bucket: 'demo.appspot.com',
      firebase_url: 'https://demo-default-rtdb.firebaseio.com',
      ...(overrides.project_info || {})
    },
    client: [
      {
        client_info: {
          mobilesdk_app_id: '1:1234567890:android:abc',
          android_client_info: { package_name: 'com.remotedesktop' }
        },
        api_key: [{ current_key: 'AIza-android' }],
        ...(overrides.client0 || {})
      },
      ...(overrides.extraClients || [])
    ],
    ...(overrides.root || {})
  });
}

describe('parseGoogleServicesJson', () => {
  test('extracts all four fields from a typical file', () => {
    const result = parseGoogleServicesJson(buildGoogleServicesJson(), validWebConfig);
    expect(result.error).toBeUndefined();
    expect(result.android).toEqual({
      apiKey: 'AIza-android',
      applicationId: '1:1234567890:android:abc',
      projectId: 'demo',
      databaseURL: 'https://demo-default-rtdb.firebaseio.com'
    });
  });

  test('prefers the com.remotedesktop client entry when multiple are present', () => {
    const result = parseGoogleServicesJson(buildGoogleServicesJson({
      extraClients: [
        {
          client_info: {
            mobilesdk_app_id: '1:1234567890:android:other',
            android_client_info: { package_name: 'com.other' }
          },
          api_key: [{ current_key: 'AIza-other' }]
        }
      ]
    }), validWebConfig);
    expect(result.android.applicationId).toBe('1:1234567890:android:abc');
    expect(result.android.apiKey).toBe('AIza-android');
  });

  test('falls back to the web config databaseURL when firebase_url is missing', () => {
    const json = buildGoogleServicesJson({ project_info: { firebase_url: undefined } });
    const parsed = JSON.parse(json);
    delete parsed.project_info.firebase_url;
    const result = parseGoogleServicesJson(JSON.stringify(parsed), validWebConfig);
    expect(result.android.databaseURL).toBe(validWebConfig.databaseURL);
  });

  test('errors when firebase_url is missing and no web config is provided', () => {
    const json = buildGoogleServicesJson();
    const parsed = JSON.parse(json);
    delete parsed.project_info.firebase_url;
    const result = parseGoogleServicesJson(JSON.stringify(parsed));
    expect(result.error).toMatch(/firebase_url/);
  });

  test('detects a project mismatch with the web config', () => {
    const otherProject = JSON.parse(buildGoogleServicesJson());
    otherProject.project_info.project_id = 'other-project';
    const result = parseGoogleServicesJson(JSON.stringify(otherProject), validWebConfig);
    expect(result.error).toMatch(/Project mismatch/);
  });

  test('rejects malformed JSON', () => {
    expect(parseGoogleServicesJson('not json').error).toMatch(/not a valid JSON file/);
  });

  test('rejects empty content', () => {
    expect(parseGoogleServicesJson('').error).toMatch(/Empty/);
    expect(parseGoogleServicesJson('   ').error).toMatch(/Empty/);
  });

  test('rejects a file with no project_info', () => {
    expect(parseGoogleServicesJson('{}').error).toMatch(/project_info/);
  });

  test('rejects a file with no client array', () => {
    expect(parseGoogleServicesJson(JSON.stringify({
      project_info: { project_id: 'demo', firebase_url: 'https://demo.firebaseio.com' }
    })).error).toMatch(/client/);
  });

  test('rejects when api_key is missing', () => {
    const json = JSON.parse(buildGoogleServicesJson());
    delete json.client[0].api_key;
    expect(parseGoogleServicesJson(JSON.stringify(json)).error).toMatch(/api_key/);
  });

  test('rejects when mobilesdk_app_id is missing', () => {
    const json = JSON.parse(buildGoogleServicesJson());
    delete json.client[0].client_info.mobilesdk_app_id;
    expect(parseGoogleServicesJson(JSON.stringify(json)).error).toMatch(/mobilesdk_app_id/);
  });
});

function buildGoogleServiceInfoPlist(overrides = {}) {
  const fields = {
    API_KEY: 'AIza-ios',
    GOOGLE_APP_ID: '1:1234567890:ios:abc',
    PROJECT_ID: 'demo',
    DATABASE_URL: 'https://demo-default-rtdb.firebaseio.com',
    BUNDLE_ID: 'com.remotedesktop.ios',
    STORAGE_BUCKET: 'demo.appspot.com',
    GCM_SENDER_ID: '1234567890',
    ...overrides
  };
  const entries = Object.entries(fields)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `  <key>${k}</key>\n  <string>${v}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${entries}
</dict>
</plist>`;
}

describe('parseGoogleServiceInfoPlist', () => {
  test('extracts all five fields from a typical plist', () => {
    const result = parseGoogleServiceInfoPlist(buildGoogleServiceInfoPlist(), validWebConfig);
    expect(result.error).toBeUndefined();
    expect(result.ios).toEqual({
      apiKey: 'AIza-ios',
      googleAppId: '1:1234567890:ios:abc',
      projectId: 'demo',
      databaseURL: 'https://demo-default-rtdb.firebaseio.com',
      bundleId: 'com.remotedesktop.ios'
    });
  });

  test('falls back to the web config databaseURL when DATABASE_URL is missing', () => {
    const result = parseGoogleServiceInfoPlist(
      buildGoogleServiceInfoPlist({ DATABASE_URL: undefined }),
      validWebConfig
    );
    expect(result.ios.databaseURL).toBe(validWebConfig.databaseURL);
  });

  test('errors when DATABASE_URL is missing and no web config is provided', () => {
    const result = parseGoogleServiceInfoPlist(
      buildGoogleServiceInfoPlist({ DATABASE_URL: undefined })
    );
    expect(result.error).toMatch(/DATABASE_URL/);
  });

  test('detects a project mismatch with the web config', () => {
    const result = parseGoogleServiceInfoPlist(
      buildGoogleServiceInfoPlist({ PROJECT_ID: 'other-project' }),
      validWebConfig
    );
    expect(result.error).toMatch(/Project mismatch/);
  });

  test('rejects empty content', () => {
    expect(parseGoogleServiceInfoPlist('').error).toMatch(/Empty/);
  });

  test('rejects malformed plist', () => {
    expect(parseGoogleServiceInfoPlist('<not></plist>').error).toBeDefined();
  });

  test('rejects when API_KEY is missing', () => {
    expect(parseGoogleServiceInfoPlist(
      buildGoogleServiceInfoPlist({ API_KEY: undefined })
    ).error).toMatch(/API_KEY/);
  });

  test('rejects when BUNDLE_ID is missing', () => {
    expect(parseGoogleServiceInfoPlist(
      buildGoogleServiceInfoPlist({ BUNDLE_ID: undefined })
    ).error).toMatch(/BUNDLE_ID/);
  });
});
