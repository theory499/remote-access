'use strict';

const desktopCapturer = {
  getSources: jest.fn(async () => [
    { id: 'screen:0:0', name: 'Entire Screen', display_id: '0' }
  ])
};

module.exports = {
  desktopCapturer,
  app: { whenReady: jest.fn(), on: jest.fn(), quit: jest.fn() },
  BrowserWindow: jest.fn(),
  ipcMain: { handle: jest.fn() }
};
