'use strict';

const protocol = require('../../src/shared/protocol');

describe('protocol.validate', () => {
  test.each([
    [{ type: 'mousemove', x: 0, y: 0 }],
    [{ type: 'mousemove', x: 1, y: 1 }],
    [{ type: 'mousemove', x: 0.5, y: 0.5 }],
    [{ type: 'mousedown', button: 'left' }],
    [{ type: 'mouseup', button: 'right' }],
    [{ type: 'click', x: 0.5, y: 0.5, button: 'middle' }],
    [{ type: 'scroll', dx: 0, dy: -120 }],
    [{ type: 'scroll', dx: 60, dy: 0 }],
    [{ type: 'keydown', key: 'A', modifiers: ['shift'] }],
    [{ type: 'keyup', key: 'Enter', modifiers: [] }],
    [{ type: 'keydown', key: 'F1' }],
    [{ type: 'type', text: 'hello' }],
    [{ type: 'ping', id: 0 }],
    [{ type: 'pong', id: 42 }]
  ])('accepts valid message %j', (msg) => {
    expect(protocol.validate(msg)).toBe(true);
  });

  test.each([
    [null],
    [undefined],
    [{}],
    [{ type: 'mousemove', x: -0.1, y: 0 }],
    [{ type: 'mousemove', x: 1.1, y: 0 }],
    [{ type: 'mousemove', x: 'a', y: 0 }],
    [{ type: 'mousemove', x: NaN, y: 0 }],
    [{ type: 'mousedown', button: 'side' }],
    [{ type: 'click', x: 0.5, y: 0.5 }],
    [{ type: 'scroll', dx: 0 }],
    [{ type: 'keydown', key: 'Foo' }],
    [{ type: 'keydown', key: 'A', modifiers: ['bogus'] }],
    [{ type: 'type', text: '' }],
    [{ type: 'type', text: 'x'.repeat(257) }],
    [{ type: 'ping', id: -1 }],
    [{ type: 'ping', id: 1.5 }],
    [{ type: 'unknown' }]
  ])('rejects invalid message %j', (msg) => {
    expect(protocol.validate(msg)).toBe(false);
  });
});

describe('protocol.parse', () => {
  test('parses a valid JSON line', () => {
    const result = protocol.parse('{"type":"mousemove","x":0.5,"y":0.5}\n');
    expect(result).toEqual({ type: 'mousemove', x: 0.5, y: 0.5 });
  });

  test('returns null for malformed JSON', () => {
    expect(protocol.parse('{')).toBeNull();
  });

  test('returns null for empty input', () => {
    expect(protocol.parse('')).toBeNull();
    expect(protocol.parse('   ')).toBeNull();
  });

  test('returns null for non-string input', () => {
    expect(protocol.parse(null)).toBeNull();
    expect(protocol.parse(42)).toBeNull();
  });

  test('rejects valid JSON that fails schema validation', () => {
    expect(protocol.parse('{"type":"keydown","key":"X1"}')).toBeNull();
  });
});

describe('protocol.encode', () => {
  test('encodes a valid message as JSON', () => {
    const encoded = protocol.encode({ type: 'click', x: 0.5, y: 0.5, button: 'left' });
    expect(encoded).toBe('{"type":"click","x":0.5,"y":0.5,"button":"left"}');
  });

  test('throws on invalid message', () => {
    expect(() => protocol.encode({ type: 'bogus' })).toThrow(/Invalid protocol message/);
  });
});

describe('cross-platform message shape compatibility', () => {
  // These are the literal JSON shapes the Android InputEventEncoder produces.
  // The desktop protocol module must accept them verbatim.
  test.each([
    ['{"type":"mousemove","x":0.5,"y":0.5}'],
    ['{"type":"mousedown","button":"left"}'],
    ['{"type":"mouseup","button":"right"}'],
    ['{"type":"click","x":0.5,"y":0.5,"button":"left"}'],
    ['{"type":"scroll","dx":0,"dy":-120}'],
    ['{"type":"keydown","key":"A","modifiers":["shift","control"]}'],
    ['{"type":"keyup","key":"A","modifiers":[]}'],
    ['{"type":"type","text":"hello"}'],
    ['{"type":"ping","id":17}'],
    ['{"type":"pong","id":17}']
  ])('desktop accepts Android-emitted message %s', (line) => {
    expect(protocol.parse(line)).not.toBeNull();
  });
});
