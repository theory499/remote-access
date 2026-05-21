'use strict';

class Point {
  constructor(x, y) { this.x = x; this.y = y; }
}

function straightTo(point) {
  return { path: 'straightTo', target: point };
}

const Button = { LEFT: 'LEFT', RIGHT: 'RIGHT', MIDDLE: 'MIDDLE' };

const Key = new Proxy({}, {
  get: (_target, prop) => `Key:${String(prop)}`
});

const calls = [];

const mouse = {
  config: { mouseSpeed: 0 },
  move: jest.fn(async (path) => { calls.push({ type: 'move', path }); }),
  setPosition: jest.fn(async (point) => { calls.push({ type: 'setPosition', point }); }),
  click: jest.fn(async (button) => { calls.push({ type: 'click', button }); }),
  pressButton: jest.fn(async (button) => { calls.push({ type: 'pressButton', button }); }),
  releaseButton: jest.fn(async (button) => { calls.push({ type: 'releaseButton', button }); }),
  scrollDown: jest.fn(async (n) => { calls.push({ type: 'scrollDown', n }); }),
  scrollUp: jest.fn(async (n) => { calls.push({ type: 'scrollUp', n }); }),
  scrollLeft: jest.fn(async (n) => { calls.push({ type: 'scrollLeft', n }); }),
  scrollRight: jest.fn(async (n) => { calls.push({ type: 'scrollRight', n }); })
};

const keyboard = {
  config: { autoDelayMs: 0 },
  pressKey: jest.fn(async (...keys) => { calls.push({ type: 'pressKey', keys }); }),
  releaseKey: jest.fn(async (...keys) => { calls.push({ type: 'releaseKey', keys }); }),
  type: jest.fn(async (text) => { calls.push({ type: 'type', text }); })
};

const screen = {
  width: jest.fn(async () => 1920),
  height: jest.fn(async () => 1080)
};

function __reset() {
  calls.length = 0;
  for (const fn of [
    mouse.move, mouse.setPosition, mouse.click,
    mouse.pressButton, mouse.releaseButton,
    mouse.scrollDown, mouse.scrollUp, mouse.scrollLeft, mouse.scrollRight,
    keyboard.pressKey, keyboard.releaseKey, keyboard.type,
    screen.width, screen.height
  ]) {
    if (fn.mockClear) fn.mockClear();
  }
}

module.exports = {
  Point,
  straightTo,
  Button,
  Key,
  mouse,
  keyboard,
  screen,
  __calls: calls,
  __reset
};
