'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const { InputController } = require('./input-controller');
const { listScreenSources } = require('./screen-capture');
const { validate } = require('../shared/protocol');

let mainWindow = null;
let inputController = null;

function getInputController() {
  if (!inputController) {
    inputController = new InputController();
  }
  return inputController;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    title: 'Remote Desktop Host',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function registerIpcHandlers() {
  ipcMain.handle('screen:list-sources', async () => listScreenSources(['screen']));

  ipcMain.handle('input:event', async (_event, message) => {
    if (!validate(message)) {
      return { ok: false, error: 'invalid' };
    }
    try {
      await getInputController().handle(message);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('input:screen-size', async () => {
    const size = await getInputController().ensureScreenSize();
    return size;
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
