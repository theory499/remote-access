'use strict';

const KEY_MAP_LAZY = () => {
  const { Key } = require('@nut-tree-fork/nut-js');
  const map = {
    Space: Key.Space,
    Enter: Key.Enter,
    Tab: Key.Tab,
    Backspace: Key.Backspace,
    Delete: Key.Delete,
    Escape: Key.Escape,
    Left: Key.Left,
    Right: Key.Right,
    Up: Key.Up,
    Down: Key.Down,
    Home: Key.Home,
    End: Key.End,
    PageUp: Key.PageUp,
    PageDown: Key.PageDown
  };
  for (let i = 0; i < 26; i += 1) {
    map[String.fromCharCode(65 + i)] = Key[String.fromCharCode(65 + i)];
  }
  for (let i = 0; i < 10; i += 1) {
    map[String(i)] = Key[`Num${i}`];
  }
  for (let i = 1; i <= 12; i += 1) {
    map[`F${i}`] = Key[`F${i}`];
  }
  return map;
};

const MODIFIER_MAP_LAZY = () => {
  const { Key } = require('@nut-tree-fork/nut-js');
  return {
    control: Key.LeftControl,
    shift: Key.LeftShift,
    alt: Key.LeftAlt,
    meta: Key.LeftSuper
  };
};

const BUTTON_MAP_LAZY = () => {
  const { Button } = require('@nut-tree-fork/nut-js');
  return {
    left: Button.LEFT,
    right: Button.RIGHT,
    middle: Button.MIDDLE
  };
};

class InputController {
  constructor(options = {}) {
    this.nut = options.nut || require('@nut-tree-fork/nut-js');
    this.screenSize = options.screenSize || null;
    this.keyMap = options.keyMap || KEY_MAP_LAZY();
    this.modifierMap = options.modifierMap || MODIFIER_MAP_LAZY();
    this.buttonMap = options.buttonMap || BUTTON_MAP_LAZY();
    this.nut.mouse.config.mouseSpeed = options.mouseSpeed || 5000;
    this.nut.keyboard.config.autoDelayMs = options.autoDelayMs || 0;
    this._heldKeys = new Set();
    this._heldModifiers = new Set();
  }

  async ensureScreenSize() {
    if (this.screenSize) return this.screenSize;
    const width = await this.nut.screen.width();
    const height = await this.nut.screen.height();
    this.screenSize = { width, height };
    return this.screenSize;
  }

  resolveButton(name) {
    const mapped = this.buttonMap[name];
    if (mapped === undefined) throw new Error(`Unknown mouse button: ${name}`);
    return mapped;
  }

  resolveKey(name) {
    const mapped = this.keyMap[name];
    if (mapped === undefined) throw new Error(`Unknown key: ${name}`);
    return mapped;
  }

  resolveModifiers(modifiers = []) {
    return modifiers.map((m) => {
      const mapped = this.modifierMap[m];
      if (mapped === undefined) throw new Error(`Unknown modifier: ${m}`);
      return mapped;
    });
  }

  async toPixel(xNorm, yNorm) {
    const { width, height } = await this.ensureScreenSize();
    const x = Math.max(0, Math.min(width - 1, Math.round(xNorm * (width - 1))));
    const y = Math.max(0, Math.min(height - 1, Math.round(yNorm * (height - 1))));
    return { x, y };
  }

  async handle(event) {
    switch (event.type) {
      case 'mousemove':
        return this.mouseMove(event.x, event.y);
      case 'mousedown':
        return this.mouseDown(event.button);
      case 'mouseup':
        return this.mouseUp(event.button);
      case 'click':
        return this.click(event.x, event.y, event.button);
      case 'scroll':
        return this.scroll(event.dx, event.dy);
      case 'keydown':
        return this.keyDown(event.key, event.modifiers || []);
      case 'keyup':
        return this.keyUp(event.key, event.modifiers || []);
      case 'type':
        return this.type(event.text);
      default:
        throw new Error(`Unhandled input event type: ${event.type}`);
    }
  }

  async mouseMove(xNorm, yNorm) {
    const { x, y } = await this.toPixel(xNorm, yNorm);
    const { Point } = this.nut;
    if (typeof this.nut.mouse.setPosition === 'function') {
      await this.nut.mouse.setPosition(new Point(x, y));
    } else {
      const { straightTo } = this.nut;
      await this.nut.mouse.move(straightTo(new Point(x, y)));
    }
  }

  async mouseDown(button) {
    await this.nut.mouse.pressButton(this.resolveButton(button));
  }

  async mouseUp(button) {
    await this.nut.mouse.releaseButton(this.resolveButton(button));
  }

  async click(xNorm, yNorm, button) {
    await this.mouseMove(xNorm, yNorm);
    if (typeof this.nut.mouse.click === 'function') {
      await this.nut.mouse.click(this.resolveButton(button));
      return;
    }
    const mapped = this.resolveButton(button);
    await this.nut.mouse.pressButton(mapped);
    await this.nut.mouse.releaseButton(mapped);
  }

  async scroll(dx, dy) {
    if (dy !== 0) {
      if (dy > 0) await this.nut.mouse.scrollDown(Math.abs(dy));
      else        await this.nut.mouse.scrollUp(Math.abs(dy));
    }
    if (dx !== 0) {
      if (dx > 0) await this.nut.mouse.scrollRight(Math.abs(dx));
      else        await this.nut.mouse.scrollLeft(Math.abs(dx));
    }
  }

  async keyDown(key, modifiers = []) {
    const resolved = this.resolveKey(key);
    const mods = this.resolveModifiers(modifiers);
    const pending = [];
    for (const mod of mods) {
      if (!this._heldModifiers.has(mod)) {
        await this.nut.keyboard.pressKey(mod);
        this._heldModifiers.add(mod);
        pending.push(mod);
      }
    }
    this._heldKeys.add(key);
    await this.nut.keyboard.pressKey(resolved);
  }

  async keyUp(key, _modifiers = []) {
    const resolved = this.resolveKey(key);
    this._heldKeys.delete(key);
    await this.nut.keyboard.releaseKey(resolved);
    if (this._heldKeys.size === 0 && this._heldModifiers.size > 0) {
      for (const mod of this._heldModifiers) {
        await this.nut.keyboard.releaseKey(mod);
      }
      this._heldModifiers.clear();
    }
  }

  async type(text) {
    await this.nut.keyboard.type(text);
  }
}

module.exports = { InputController };
