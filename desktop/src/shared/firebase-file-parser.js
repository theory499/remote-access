'use strict';

const plist = require('plist');

// Extracts the four values the Android Firebase SDK needs from the
// google-services.json file Firebase generates.
//
// Returns { android } on success or { error } on failure. The
// optional `webConfig` is the already-validated Firebase web config
// from the previous wizard step. If the JSON file lacks a
// firebase_url (the file was downloaded before Realtime Database was
// enabled), we fall back to the web config's databaseURL. We also
// verify the JSON belongs to the same Firebase project as the web
// config to catch the common mistake of mixing projects.
function parseGoogleServicesJson(rawContent, webConfig = {}) {
  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    return { error: 'Empty or missing file.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    return { error: `That is not a valid JSON file: ${err.message}` };
  }

  const projectInfo = parsed && parsed.project_info;
  if (!projectInfo || typeof projectInfo !== 'object') {
    return { error: 'Missing "project_info" - this does not look like a google-services.json file.' };
  }

  const clients = Array.isArray(parsed.client) ? parsed.client : null;
  if (!clients || clients.length === 0) {
    return { error: 'Missing "client" array - this does not look like a google-services.json file.' };
  }

  // Prefer the client entry whose package_name matches com.remotedesktop;
  // fall back to the first one if none match.
  const preferred = clients.find((c) =>
    c && c.client_info && c.client_info.android_client_info &&
    c.client_info.android_client_info.package_name === 'com.remotedesktop'
  ) || clients[0];

  const apiKey = readPath(preferred, ['api_key', 0, 'current_key']);
  const applicationId = readPath(preferred, ['client_info', 'mobilesdk_app_id']);
  const projectId = projectInfo.project_id;
  const databaseURL = projectInfo.firebase_url || webConfig.databaseURL || null;

  if (!isNonEmpty(apiKey)) return { error: 'Could not find client.api_key[0].current_key in the JSON.' };
  if (!isNonEmpty(applicationId)) return { error: 'Could not find client.client_info.mobilesdk_app_id in the JSON.' };
  if (!isNonEmpty(projectId)) return { error: 'Could not find project_info.project_id in the JSON.' };
  if (!isNonEmpty(databaseURL)) {
    return { error: 'Could not find project_info.firebase_url. Enable Realtime Database in your Firebase project and download google-services.json again.' };
  }

  if (webConfig.projectId && projectId !== webConfig.projectId) {
    return {
      error: `Project mismatch: the Android JSON is for "${projectId}" but the web config is for "${webConfig.projectId}". Re-download google-services.json from the same Firebase project.`
    };
  }

  return {
    android: {
      apiKey: apiKey.trim(),
      applicationId: applicationId.trim(),
      projectId: projectId.trim(),
      databaseURL: databaseURL.trim()
    }
  };
}

// Extracts the five values the iOS Firebase SDK needs from the
// GoogleService-Info.plist file Firebase generates. Same semantics
// as parseGoogleServicesJson.
function parseGoogleServiceInfoPlist(rawContent, webConfig = {}) {
  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    return { error: 'Empty or missing file.' };
  }
  let parsed;
  try {
    parsed = plist.parse(rawContent);
  } catch (err) {
    return { error: `Could not parse the plist file: ${err.message}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'The plist root must be a dictionary.' };
  }

  const apiKey = parsed.API_KEY;
  const googleAppId = parsed.GOOGLE_APP_ID;
  const projectId = parsed.PROJECT_ID;
  const databaseURL = parsed.DATABASE_URL || webConfig.databaseURL || null;
  const bundleId = parsed.BUNDLE_ID;

  if (!isNonEmpty(apiKey)) return { error: 'Missing API_KEY in the plist.' };
  if (!isNonEmpty(googleAppId)) return { error: 'Missing GOOGLE_APP_ID in the plist.' };
  if (!isNonEmpty(projectId)) return { error: 'Missing PROJECT_ID in the plist.' };
  if (!isNonEmpty(databaseURL)) {
    return { error: 'Missing DATABASE_URL in the plist. Enable Realtime Database in your Firebase project and re-download GoogleService-Info.plist.' };
  }
  if (!isNonEmpty(bundleId)) return { error: 'Missing BUNDLE_ID in the plist.' };

  if (webConfig.projectId && projectId !== webConfig.projectId) {
    return {
      error: `Project mismatch: the iOS plist is for "${projectId}" but the web config is for "${webConfig.projectId}". Re-download GoogleService-Info.plist from the same Firebase project.`
    };
  }

  return {
    ios: {
      apiKey: apiKey.trim(),
      googleAppId: googleAppId.trim(),
      projectId: projectId.trim(),
      databaseURL: databaseURL.trim(),
      bundleId: bundleId.trim()
    }
  };
}

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readPath(obj, path) {
  let cursor = obj;
  for (const key of path) {
    if (cursor === null || cursor === undefined) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

module.exports = { parseGoogleServicesJson, parseGoogleServiceInfoPlist };
