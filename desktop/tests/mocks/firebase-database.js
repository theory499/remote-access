'use strict';

const noop = () => {};

module.exports = {
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn((_db, path) => ({ path })),
  set: jest.fn(async () => {}),
  push: jest.fn(async () => ({ key: 'pushed' })),
  remove: jest.fn(async () => {}),
  onValue: jest.fn((_ref, _cb) => noop),
  onChildAdded: jest.fn((_ref, _cb) => noop),
  onDisconnect: jest.fn(() => ({ remove: jest.fn(async () => {}) })),
  serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' }))
};
