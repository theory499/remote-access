'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listScreenSources: () => ipcRenderer.invoke('screen:list-sources'),
  dispatchInputEvent: (message) => ipcRenderer.invoke('input:event', message),
  getScreenSize: () => ipcRenderer.invoke('input:screen-size')
});
