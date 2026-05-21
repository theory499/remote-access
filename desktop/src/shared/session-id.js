'use strict';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 6;
const CODE_REGEX = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

function getRandomBytes(n) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Web Crypto API is required (Node 19+ or modern browser)');
  }
  const buf = new Uint8Array(n);
  cryptoApi.getRandomValues(buf);
  return buf;
}

function generate() {
  const bytes = getRandomBytes(LENGTH);
  let code = '';
  for (let i = 0; i < LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

function isValid(code) {
  return typeof code === 'string' && CODE_REGEX.test(code);
}

module.exports = { generate, isValid, ALPHABET, LENGTH };
