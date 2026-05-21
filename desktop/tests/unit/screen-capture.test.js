'use strict';

const electron = require('../mocks/electron');
const { listScreenSources, selectPrimaryScreen } = require('../../src/main/screen-capture');

beforeEach(() => {
  electron.desktopCapturer.getSources.mockReset();
});

describe('listScreenSources', () => {
  test('returns a shallow copy of the requested fields', async () => {
    electron.desktopCapturer.getSources.mockResolvedValue([
      { id: 'screen:0:0', name: 'Display 1', display_id: '0', extra: 'ignored' }
    ]);
    const sources = await listScreenSources();
    expect(sources).toEqual([
      { id: 'screen:0:0', name: 'Display 1', display_id: '0' }
    ]);
  });

  test('passes through the requested source types', async () => {
    electron.desktopCapturer.getSources.mockResolvedValue([]);
    await listScreenSources(['screen', 'window']);
    expect(electron.desktopCapturer.getSources).toHaveBeenCalledWith({ types: ['screen', 'window'] });
  });
});

describe('selectPrimaryScreen', () => {
  test('returns the first screen source', async () => {
    electron.desktopCapturer.getSources.mockResolvedValue([
      { id: 'screen:0:0', name: 'Primary' },
      { id: 'screen:1:0', name: 'Secondary' }
    ]);
    const source = await selectPrimaryScreen();
    expect(source.id).toBe('screen:0:0');
  });

  test('throws when no screen sources are present', async () => {
    electron.desktopCapturer.getSources.mockResolvedValue([]);
    await expect(selectPrimaryScreen()).rejects.toThrow(/No screen sources/);
  });
});
