'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const { InputController } = require('./input-controller');
const { listScreenSources } = require('./screen-capture');
const { validate } = require('../shared/protocol');
const { ConfigStore } = require('./config-store');
const { generateMobileQr } = require('./qr-generator');
const { probeFirebaseWebConfig } = require('./config-validator');
const {
  validateFirebaseWebConfig,
  validateFirebaseAndroidConfig,
  validateFirebaseIosConfig
} = require('../shared/backend-config');
const { parseFirebaseConfigPaste } = require('../shared/config-parser');
const {
  parseGoogleServicesJson,
  parseGoogleServiceInfoPlist
} = require('../shared/firebase-file-parser');

let mainWindow = null;
let inputController = null;
let configStore = null;

function getInputController() {
  if (!inputController) inputController = new InputController();
  return inputController;
}

function getConfigStore() {
  if (!configStore) {
    configStore = new ConfigStore({ userDataDir: app.getPath('userData') });
  }
  return configStore;
}

function buildFirebaseDeps() {
  return {
    initializeApp: require('firebase/app').initializeApp,
    deleteApp: require('firebase/app').deleteApp,
    getAuth: require('firebase/auth').getAuth,
    signInAnonymously: require('firebase/auth').signInAnonymously,
    signOut: require('firebase/auth').signOut,
    getDatabase: require('firebase/database').getDatabase,
    ref: require('firebase/database').ref,
    set: require('firebase/database').set,
    get: require('firebase/database').get,
    remove: require('firebase/database').remove,
    serverTimestamp: require('firebase/database').serverTimestamp
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 720,
    resizable: true,
    title: 'Remote Desktop Host',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.removeMenu();
  routeWindow();
}

function routeWindow() {
  const store = getConfigStore();
  const target = store.exists() ? 'index.html' : 'setup.html';
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', target));
}

function registerIpcHandlers() {
  ipcMain.handle('screen:list-sources', async () => listScreenSources(['screen']));

  ipcMain.handle('input:event', async (_event, message) => {
    if (!validate(message)) return { ok: false, error: 'invalid' };
    try {
      await getInputController().handle(message);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('input:screen-size', async () => getInputController().ensureScreenSize());

  ipcMain.handle('config:get-active', async () => {
    return getConfigStore().load();
  });

  ipcMain.handle('config:parse-web', async (_event, raw) => {
    return parseFirebaseConfigPaste(raw);
  });

  ipcMain.handle('config:probe-web', async (_event, web) => {
    return probeFirebaseWebConfig(web, buildFirebaseDeps());
  });

  ipcMain.handle('config:validate-android', async (_event, android) => {
    const cleaned = validateFirebaseAndroidConfig(android);
    return cleaned ? { ok: true, value: cleaned } : { ok: false };
  });

  ipcMain.handle('config:validate-ios', async (_event, ios) => {
    const cleaned = validateFirebaseIosConfig(ios);
    return cleaned ? { ok: true, value: cleaned } : { ok: false };
  });

  ipcMain.handle('config:parse-android-file', async (_event, { content, webConfig }) => {
    return parseGoogleServicesJson(content, webConfig || {});
  });

  ipcMain.handle('config:parse-ios-file', async (_event, { content, webConfig }) => {
    return parseGoogleServiceInfoPlist(content, webConfig || {});
  });

  ipcMain.handle('config:save', async (_event, fullConfig) => {
    try {
      const saved = getConfigStore().save(fullConfig);
      return { ok: true, config: saved };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('config:reset', async () => {
    getConfigStore().clear();
    routeWindow();
    return { ok: true };
  });

  ipcMain.handle('config:enter-session', async () => {
    routeWindow();
    return { ok: true };
  });

  ipcMain.handle('config:enter-setup', async () => {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'setup.html'));
    return { ok: true };
  });

  ipcMain.handle('config:generate-qr', async (_event, fullConfig) => {
    try {
      const { dataUrl, payload } = await generateMobileQr(fullConfig);
      return { ok: true, dataUrl, payload };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('config:get-rules', async () => {
    const fs = require('fs');
    const rulesPath = path.join(__dirname, '..', '..', '..', 'firebase', 'database.rules.json');
    try {
      return { ok: true, rules: fs.readFileSync(rulesPath, 'utf8') };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
