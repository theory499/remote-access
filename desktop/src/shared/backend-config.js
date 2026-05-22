'use strict';

const BACKEND_KINDS = Object.freeze(['firebase']);

const WEB_REQUIRED = Object.freeze(['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId']);
const ANDROID_REQUIRED = Object.freeze(['apiKey', 'applicationId', 'projectId', 'databaseURL']);
const IOS_REQUIRED = Object.freeze(['apiKey', 'googleAppId', 'projectId', 'databaseURL', 'bundleId']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pickStrings(input, keys) {
  if (input === null || typeof input !== 'object') return null;
  const out = {};
  for (const key of keys) {
    if (!isNonEmptyString(input[key])) return null;
    out[key] = input[key].trim();
  }
  return out;
}

function validateFirebaseWebConfig(input) {
  return pickStrings(input, WEB_REQUIRED);
}

function validateFirebaseAndroidConfig(input) {
  return pickStrings(input, ANDROID_REQUIRED);
}

function validateFirebaseIosConfig(input) {
  return pickStrings(input, IOS_REQUIRED);
}

function validateFullConfig(input) {
  if (!input || typeof input !== 'object') return null;
  if (input.backend !== 'firebase') return null;

  const web = validateFirebaseWebConfig(input.web);
  if (!web) return null;

  let android = null;
  if (input.android !== undefined && input.android !== null) {
    android = validateFirebaseAndroidConfig(input.android);
    if (!android) return null;
  }

  let ios = null;
  if (input.ios !== undefined && input.ios !== null) {
    ios = validateFirebaseIosConfig(input.ios);
    if (!ios) return null;
  }

  return { backend: 'firebase', web, android, ios };
}

function buildMobilePayload(fullConfig) {
  const v = validateFullConfig(fullConfig);
  if (!v) return null;
  return {
    v: 1,
    backend: v.backend,
    android: v.android,
    ios: v.ios,
    projectId: v.web.projectId,
    databaseURL: v.web.databaseURL
  };
}

module.exports = {
  BACKEND_KINDS,
  WEB_REQUIRED,
  ANDROID_REQUIRED,
  IOS_REQUIRED,
  validateFirebaseWebConfig,
  validateFirebaseAndroidConfig,
  validateFirebaseIosConfig,
  validateFullConfig,
  buildMobilePayload
};
