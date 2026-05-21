'use strict';

const BUTTONS = Object.freeze(['left', 'right', 'middle']);
const MODIFIERS = Object.freeze(['control', 'shift', 'alt', 'meta']);

const KEYS = Object.freeze([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...'0123456789'.split(''),
  'Space', 'Enter', 'Tab', 'Backspace', 'Delete', 'Escape',
  'Left', 'Right', 'Up', 'Down',
  'Home', 'End', 'PageUp', 'PageDown',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
]);

const KEY_SET = new Set(KEYS);
const BUTTON_SET = new Set(BUTTONS);
const MODIFIER_SET = new Set(MODIFIERS);

const TYPE_TEXT_MAX_LENGTH = 256;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function isNormalised(n) {
  return isFiniteNumber(n) && n >= 0 && n <= 1;
}

function isValidModifiers(value) {
  if (!Array.isArray(value)) return false;
  for (const m of value) {
    if (typeof m !== 'string' || !MODIFIER_SET.has(m)) return false;
  }
  return true;
}

function validate(message) {
  if (message === null || typeof message !== 'object') return false;
  const { type } = message;
  switch (type) {
    case 'mousemove':
      return isNormalised(message.x) && isNormalised(message.y);
    case 'mousedown':
    case 'mouseup':
      return typeof message.button === 'string' && BUTTON_SET.has(message.button);
    case 'click':
      return isNormalised(message.x)
        && isNormalised(message.y)
        && typeof message.button === 'string'
        && BUTTON_SET.has(message.button);
    case 'scroll':
      return isFiniteNumber(message.dx) && isFiniteNumber(message.dy);
    case 'keydown':
    case 'keyup':
      return typeof message.key === 'string'
        && KEY_SET.has(message.key)
        && isValidModifiers(message.modifiers || []);
    case 'type':
      return typeof message.text === 'string'
        && message.text.length > 0
        && message.text.length <= TYPE_TEXT_MAX_LENGTH;
    case 'ping':
    case 'pong':
      return Number.isInteger(message.id) && message.id >= 0;
    default:
      return false;
  }
}

function parse(line) {
  if (typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return null;
  }
  return validate(parsed) ? parsed : null;
}

function encode(message) {
  if (!validate(message)) {
    throw new Error(`Invalid protocol message: ${JSON.stringify(message)}`);
  }
  return JSON.stringify(message);
}

module.exports = {
  BUTTONS,
  MODIFIERS,
  KEYS,
  TYPE_TEXT_MAX_LENGTH,
  validate,
  parse,
  encode
};
