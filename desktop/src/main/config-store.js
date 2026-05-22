'use strict';

const fs = require('fs');
const path = require('path');

const { validateFullConfig } = require('../shared/backend-config');

const FILE_NAME = 'backend-config.json';

class ConfigStore {
  constructor({ userDataDir }) {
    if (!userDataDir) throw new Error('userDataDir is required');
    this.userDataDir = userDataDir;
    this.filePath = path.join(userDataDir, FILE_NAME);
    this.cache = null;
  }

  load() {
    if (this.cache) return this.cache;
    let raw;
    try {
      raw = fs.readFileSync(this.filePath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return null;
    }
    const validated = validateFullConfig(parsed);
    if (!validated) return null;
    this.cache = validated;
    return validated;
  }

  save(config) {
    const validated = validateFullConfig(config);
    if (!validated) throw new Error('Invalid backend configuration');
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(validated, null, 2), { mode: 0o600 });
    this.cache = validated;
    return validated;
  }

  clear() {
    this.cache = null;
    try {
      fs.unlinkSync(this.filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  exists() {
    return this.load() !== null;
  }
}

module.exports = { ConfigStore, FILE_NAME };
