'use strict';

const { parseFirebaseConfigPaste, extractObjectLiteral } = require('../../src/shared/config-parser');

describe('parseFirebaseConfigPaste - paste shapes', () => {
  test('accepts strict JSON', () => {
    const raw = '{"apiKey": "AIza", "authDomain": "x.firebaseapp.com"}';
    const result = parseFirebaseConfigPaste(raw);
    expect(result.error).toBeUndefined();
    expect(result.config.apiKey).toBe('AIza');
  });

  test('accepts JavaScript object literal with unquoted keys', () => {
    const raw = '{ apiKey: "AIza", authDomain: "x.firebaseapp.com" }';
    const result = parseFirebaseConfigPaste(raw);
    expect(result.config.apiKey).toBe('AIza');
    expect(result.config.authDomain).toBe('x.firebaseapp.com');
  });

  test('accepts the full Firebase Console snippet', () => {
    const raw = `const firebaseConfig = {
      apiKey: "AIzaSyAAEbcI-9NsZYWlaF9FiVpUIYqBc-XrIFQ",
      authDomain: "rem-con-283d0.firebaseapp.com",
      databaseURL: "https://rem-con-283d0-default-rtdb.firebaseio.com",
      projectId: "rem-con-283d0",
      appId: "1:1234567890:web:abc123"
    };`;
    const result = parseFirebaseConfigPaste(raw);
    expect(result.error).toBeUndefined();
    expect(result.config.projectId).toBe('rem-con-283d0');
    expect(result.config.databaseURL).toBe('https://rem-con-283d0-default-rtdb.firebaseio.com');
  });

  test('accepts let X = { ... };', () => {
    const raw = `let cfg = { apiKey: "AIza", projectId: "p" };`;
    expect(parseFirebaseConfigPaste(raw).config.apiKey).toBe('AIza');
  });

  test('accepts var X = { ... }', () => {
    const raw = `var cfg = { apiKey: "AIza" }`;
    expect(parseFirebaseConfigPaste(raw).config.apiKey).toBe('AIza');
  });

  test('accepts single-quoted string values', () => {
    const raw = `{ apiKey: 'AIza', authDomain: 'x.firebaseapp.com' }`;
    expect(parseFirebaseConfigPaste(raw).config.apiKey).toBe('AIza');
  });

  test('accepts trailing commas', () => {
    const raw = `{ apiKey: "AIza", projectId: "p", }`;
    expect(parseFirebaseConfigPaste(raw).config.projectId).toBe('p');
  });

  test('strips a wrapping { firebaseConfig: { ... } }', () => {
    const raw = `{ firebaseConfig: { apiKey: "AIza", projectId: "p" } }`;
    const result = parseFirebaseConfigPaste(raw);
    expect(result.config.apiKey).toBe('AIza');
    expect(result.config.projectId).toBe('p');
  });

  test('ignores leading and trailing whitespace and comments', () => {
    const raw = `
      // Pasted from Firebase Console
      const firebaseConfig = {
        // your config
        apiKey: "AIza",
        projectId: "p",
      };
    `;
    expect(parseFirebaseConfigPaste(raw).config.projectId).toBe('p');
  });

  test('rejects empty input', () => {
    expect(parseFirebaseConfigPaste('').error).toMatch(/Paste/);
    expect(parseFirebaseConfigPaste('   \n  ').error).toMatch(/Paste/);
  });

  test('rejects input with no object literal', () => {
    expect(parseFirebaseConfigPaste('apiKey = "AIza"').error).toMatch(/object literal/);
  });

  test('rejects garbage', () => {
    expect(parseFirebaseConfigPaste('not json {').error).toBeDefined();
  });

  test('rejects an array literal', () => {
    expect(parseFirebaseConfigPaste('[1, 2, 3]').error).toBeDefined();
  });

  test('rejects non-string input', () => {
    expect(parseFirebaseConfigPaste(null).error).toMatch(/Paste/);
    expect(parseFirebaseConfigPaste(42).error).toMatch(/Paste/);
  });
});

describe('extractObjectLiteral - brace matching', () => {
  test('extracts the first balanced object', () => {
    expect(extractObjectLiteral('foo = { a: 1 };')).toBe('{ a: 1 }');
  });

  test('handles nested braces', () => {
    expect(extractObjectLiteral('x = { a: { b: 2 } } z')).toBe('{ a: { b: 2 } }');
  });

  test('ignores braces inside double-quoted strings', () => {
    expect(extractObjectLiteral('{ a: "}", b: 1 }')).toBe('{ a: "}", b: 1 }');
  });

  test('ignores braces inside single-quoted strings', () => {
    expect(extractObjectLiteral(`{ a: '{', b: 1 }`)).toBe(`{ a: '{', b: 1 }`);
  });

  test('ignores braces inside template literals', () => {
    expect(extractObjectLiteral('{ a: `}`, b: 1 }')).toBe('{ a: `}`, b: 1 }');
  });

  test('handles escaped quote inside string', () => {
    expect(extractObjectLiteral('{ a: "\\"}", b: 1 }')).toBe('{ a: "\\"}", b: 1 }');
  });

  test('returns null when no opening brace exists', () => {
    expect(extractObjectLiteral('no braces here')).toBeNull();
  });

  test('returns null when braces never close', () => {
    expect(extractObjectLiteral('{ a: 1')).toBeNull();
  });
});
