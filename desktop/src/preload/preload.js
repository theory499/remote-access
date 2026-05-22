'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Session-time
  listScreenSources: () => ipcRenderer.invoke('screen:list-sources'),
  dispatchInputEvent: (m) => ipcRenderer.invoke('input:event', m),
  getScreenSize: () => ipcRenderer.invoke('input:screen-size'),

  // Configuration / setup wizard
  getActiveConfig: () => ipcRenderer.invoke('config:get-active'),
  probeWebConfig: (web) => ipcRenderer.invoke('config:probe-web', web),
  validateAndroidConfig: (android) => ipcRenderer.invoke('config:validate-android', android),
  validateIosConfig: (ios) => ipcRenderer.invoke('config:validate-ios', ios),
  saveConfig: (full) => ipcRenderer.invoke('config:save', full),
  resetConfig: () => ipcRenderer.invoke('config:reset'),
  enterSession: () => ipcRenderer.invoke('config:enter-session'),
  enterSetup: () => ipcRenderer.invoke('config:enter-setup'),
  generateQr: (full) => ipcRenderer.invoke('config:generate-qr', full),
  getRules: () => ipcRenderer.invoke('config:get-rules')
});
