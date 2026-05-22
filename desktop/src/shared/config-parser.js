'use strict';

const JSON5 = require('json5');

// Parses whatever shape Firebase Console copies into the clipboard:
//
//   strict JSON           {"apiKey": "...", "authDomain": "..."}
//   object literal        { apiKey: "...", authDomain: "..." }
//   wrapped in const      const firebaseConfig = { ... };
//   wrapped in let/var    let firebaseConfig = { ... }
//   trailing semicolon    { ... };
//   trailing commas       { apiKey: "...", }
//   single-quoted strings { apiKey: 'AIza...' }
//   wrapped in {firebaseConfig: {...}}   (rare paste variant)
//
// Returns { config } on success or { error: <user-facing message> }.

function parseFirebaseConfigPaste(raw) {
  if (typeof raw !== 'string') return { error: 'Paste the config object first.' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { error: 'Paste the config object first.' };

  const objectText = extractObjectLiteral(trimmed);
  if (!objectText) {
    return { error: 'Could not find an object literal. Make sure you copied the whole { ... } block.' };
  }

  let parsed;
  try {
    parsed = JSON5.parse(objectText);
  } catch (err) {
    return { error: `That doesn't look like a valid Firebase config: ${err.message}` };
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.firebaseConfig) {
    parsed = parsed.firebaseConfig;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'The pasted content is not an object.' };
  }
  return { config: parsed };
}

// Returns the text between the first `{` and its matching `}`, ignoring
// braces inside string literals. Strips everything outside.
function extractObjectLiteral(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = null;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (inString) {
      if (ch === '\\') { escaped = true; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

module.exports = { parseFirebaseConfigPaste, extractObjectLiteral };
