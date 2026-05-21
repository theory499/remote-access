'use strict';

const nut = require('../mocks/nut-js');
const { InputController } = require('../../src/main/input-controller');

function makeController(overrides = {}) {
  const keyMap = {
    A: 'KEY_A', B: 'KEY_B', Z: 'KEY_Z',
    Enter: 'KEY_ENTER', Tab: 'KEY_TAB', Escape: 'KEY_ESC', Space: 'KEY_SPACE',
    Left: 'KEY_LEFT', Right: 'KEY_RIGHT', Up: 'KEY_UP', Down: 'KEY_DOWN',
    Backspace: 'KEY_BACK', Delete: 'KEY_DEL',
    Home: 'KEY_HOME', End: 'KEY_END', PageUp: 'KEY_PGUP', PageDown: 'KEY_PGDN',
    F1: 'KEY_F1', F12: 'KEY_F12',
    0: 'KEY_0', 1: 'KEY_1', 9: 'KEY_9'
  };
  const modifierMap = {
    control: 'MOD_CTRL', shift: 'MOD_SHIFT', alt: 'MOD_ALT', meta: 'MOD_META'
  };
  const buttonMap = {
    left: 'BTN_LEFT', right: 'BTN_RIGHT', middle: 'BTN_MIDDLE'
  };
  return new InputController({
    nut,
    screenSize: { width: 1000, height: 500 },
    keyMap, modifierMap, buttonMap,
    ...overrides
  });
}

beforeEach(() => nut.__reset());

describe('InputController.toPixel', () => {
  test('maps normalised coordinates onto the screen', async () => {
    const controller = makeController();
    await expect(controller.toPixel(0, 0)).resolves.toEqual({ x: 0, y: 0 });
    await expect(controller.toPixel(1, 1)).resolves.toEqual({ x: 999, y: 499 });
    await expect(controller.toPixel(0.5, 0.5)).resolves.toEqual({ x: 500, y: 250 });
  });

  test('clamps out-of-range coordinates', async () => {
    const controller = makeController();
    await expect(controller.toPixel(-0.5, 1.5)).resolves.toEqual({ x: 0, y: 499 });
    await expect(controller.toPixel(2, -2)).resolves.toEqual({ x: 999, y: 0 });
  });
});

describe('InputController.handle', () => {
  test('mousemove uses setPosition when available for low latency', async () => {
    const controller = makeController();
    await controller.handle({ type: 'mousemove', x: 0.25, y: 0.5 });
    expect(nut.mouse.setPosition).toHaveBeenCalledTimes(1);
    expect(nut.mouse.move).not.toHaveBeenCalled();
    const point = nut.mouse.setPosition.mock.calls[0][0];
    expect(point.x).toBe(Math.round(0.25 * 999));
    expect(point.y).toBe(Math.round(0.5 * 499));
  });

  test('mousemove falls back to move(straightTo) when setPosition is unavailable', async () => {
    const limitedNut = { ...nut, mouse: { ...nut.mouse } };
    delete limitedNut.mouse.setPosition;
    const controller = new InputController({
      nut: limitedNut,
      screenSize: { width: 1000, height: 500 },
      keyMap: { A: 'KEY_A' }, modifierMap: {}, buttonMap: { left: 'BTN_LEFT' }
    });
    await controller.handle({ type: 'mousemove', x: 0, y: 0 });
    expect(limitedNut.mouse.move).toHaveBeenCalledTimes(1);
    expect(limitedNut.mouse.move.mock.calls[0][0].path).toBe('straightTo');
  });

  test('mousedown calls pressButton with the mapped button', async () => {
    const controller = makeController();
    await controller.handle({ type: 'mousedown', button: 'right' });
    expect(nut.mouse.pressButton).toHaveBeenCalledWith('BTN_RIGHT');
  });

  test('mouseup calls releaseButton with the mapped button', async () => {
    const controller = makeController();
    await controller.handle({ type: 'mouseup', button: 'middle' });
    expect(nut.mouse.releaseButton).toHaveBeenCalledWith('BTN_MIDDLE');
  });

  test('click moves and uses native click when available', async () => {
    const controller = makeController();
    await controller.handle({ type: 'click', x: 0.5, y: 0.5, button: 'left' });
    expect(nut.mouse.setPosition).toHaveBeenCalledTimes(1);
    expect(nut.mouse.click).toHaveBeenCalledWith('BTN_LEFT');
  });

  test('scroll dispatches to the correct axis and direction', async () => {
    const controller = makeController();
    await controller.handle({ type: 'scroll', dx: 0, dy: 50 });
    expect(nut.mouse.scrollDown).toHaveBeenCalledWith(50);
    await controller.handle({ type: 'scroll', dx: 0, dy: -30 });
    expect(nut.mouse.scrollUp).toHaveBeenCalledWith(30);
    await controller.handle({ type: 'scroll', dx: 20, dy: 0 });
    expect(nut.mouse.scrollRight).toHaveBeenCalledWith(20);
    await controller.handle({ type: 'scroll', dx: -10, dy: 0 });
    expect(nut.mouse.scrollLeft).toHaveBeenCalledWith(10);
  });

  test('keydown presses each modifier once then the key', async () => {
    const controller = makeController();
    await controller.handle({ type: 'keydown', key: 'A', modifiers: ['control', 'shift'] });
    expect(nut.keyboard.pressKey.mock.calls).toEqual([
      ['MOD_CTRL'],
      ['MOD_SHIFT'],
      ['KEY_A']
    ]);
  });

  test('repeated keydowns do not double-press a held modifier', async () => {
    const controller = makeController();
    await controller.handle({ type: 'keydown', key: 'A', modifiers: ['shift'] });
    await controller.handle({ type: 'keydown', key: 'B', modifiers: ['shift'] });
    const shiftPresses = nut.keyboard.pressKey.mock.calls.filter((c) => c[0] === 'MOD_SHIFT').length;
    expect(shiftPresses).toBe(1);
  });

  test('keyup releases the key and only releases modifiers once all keys are up', async () => {
    const controller = makeController();
    await controller.handle({ type: 'keydown', key: 'A', modifiers: ['shift'] });
    await controller.handle({ type: 'keydown', key: 'B', modifiers: ['shift'] });
    nut.keyboard.releaseKey.mockClear();

    await controller.handle({ type: 'keyup', key: 'A' });
    expect(nut.keyboard.releaseKey).toHaveBeenCalledWith('KEY_A');
    const shiftReleases1 = nut.keyboard.releaseKey.mock.calls.filter((c) => c[0] === 'MOD_SHIFT').length;
    expect(shiftReleases1).toBe(0);

    await controller.handle({ type: 'keyup', key: 'B' });
    expect(nut.keyboard.releaseKey).toHaveBeenCalledWith('KEY_B');
    const shiftReleases2 = nut.keyboard.releaseKey.mock.calls.filter((c) => c[0] === 'MOD_SHIFT').length;
    expect(shiftReleases2).toBe(1);
  });

  test('type forwards text to nut.keyboard.type', async () => {
    const controller = makeController();
    await controller.handle({ type: 'type', text: 'hello world' });
    expect(nut.keyboard.type).toHaveBeenCalledWith('hello world');
  });

  test('throws on an unknown event type', async () => {
    const controller = makeController();
    await expect(controller.handle({ type: 'unknown' })).rejects.toThrow(/Unhandled/);
  });

  test('throws on an unknown button', async () => {
    const controller = makeController();
    await expect(controller.handle({ type: 'mousedown', button: 'side' })).rejects.toThrow(/Unknown mouse button/);
  });

  test('throws on an unknown key', async () => {
    const controller = makeController();
    await expect(controller.handle({ type: 'keydown', key: 'AltGr' })).rejects.toThrow(/Unknown key/);
  });

  test('ensureScreenSize queries nut.screen once and caches', async () => {
    const controller = new InputController({
      nut,
      keyMap: {}, modifierMap: {}, buttonMap: {}
    });
    await controller.ensureScreenSize();
    await controller.ensureScreenSize();
    expect(nut.screen.width).toHaveBeenCalledTimes(1);
    expect(nut.screen.height).toHaveBeenCalledTimes(1);
  });
});
