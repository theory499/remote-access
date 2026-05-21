'use strict';

module.exports = {
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  signInAnonymously: jest.fn(async () => ({ user: { uid: 'test-uid' } })),
  onAuthStateChanged: jest.fn((auth, cb) => { cb(auth.currentUser); return () => {}; })
};
