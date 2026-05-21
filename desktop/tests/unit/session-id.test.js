'use strict';

const { generate, isValid, ALPHABET, LENGTH } = require('../../src/shared/session-id');

describe('session-id', () => {
  test('generates a code of the correct length', () => {
    expect(generate()).toHaveLength(LENGTH);
  });

  test('uses only the allowed alphabet', () => {
    for (let i = 0; i < 1000; i += 1) {
      const code = generate();
      for (const ch of code) {
        expect(ALPHABET).toContain(ch);
      }
    }
  });

  test('codes are highly diverse across 1000 samples', () => {
    const codes = new Set();
    for (let i = 0; i < 1000; i += 1) codes.add(generate());
    expect(codes.size).toBeGreaterThan(990);
  });

  test('isValid accepts generated codes', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(isValid(generate())).toBe(true);
    }
  });

  test('isValid rejects bad inputs', () => {
    expect(isValid('')).toBe(false);
    expect(isValid('ABC')).toBe(false);
    expect(isValid('abcdef')).toBe(false);
    expect(isValid('AAAAAAA')).toBe(false);
    expect(isValid('AAAAA2')).toBe(true);
    expect(isValid('AAAAA0')).toBe(false);
    expect(isValid('AAAAA1')).toBe(false);
    expect(isValid('AAAAAO')).toBe(false);
    expect(isValid('AAAAAI')).toBe(false);
    expect(isValid(null)).toBe(false);
    expect(isValid(123456)).toBe(false);
  });
});
