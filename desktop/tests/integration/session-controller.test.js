'use strict';

const { FakeDatabase, buildFakeHelpers } = require('./fake-firebase');
const { FirebaseSignaling } = require('../../src/main/firebase-signaling');
const { SessionController, PEER_DISCONNECT_GRACE_MS } = require('../../src/main/session-controller');

jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask'] });

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function makeSignalingFactory(database) {
  return ({ role, uid, sessionCode }) => new FirebaseSignaling({
    database,
    role,
    sessionCode,
    uid,
    refFactory: (db, path) => db.ref(path),
    serverValue: { TIMESTAMP: Date.now() },
    helpers: buildFakeHelpers(database)
  });
}

describe('SessionController', () => {
  test('start opens a session and announces waiting status', async () => {
    const database = new FakeDatabase();
    const statuses = [];
    const controller = new SessionController({
      signalingFactory: makeSignalingFactory(database),
      onStatus: (s) => statuses.push(s),
      onLog: () => {}
    });
    const { sessionCode } = await controller.start({ uid: 'host-uid' });
    await flush();
    expect(sessionCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(statuses[0].status).toBe('waiting');
    expect(statuses[0].code).toBe(sessionCode);
    await controller.stop();
  });

  test('client presence transitions status', async () => {
    const database = new FakeDatabase();
    const statuses = [];
    const controller = new SessionController({
      signalingFactory: makeSignalingFactory(database),
      onStatus: (s) => statuses.push(s),
      onLog: () => {}
    });
    const { sessionCode } = await controller.start({ uid: 'host-uid' });
    await flush();

    const client = new FirebaseSignaling({
      database,
      role: 'client',
      sessionCode,
      uid: 'client-uid',
      refFactory: (db, path) => db.ref(path),
      serverValue: { TIMESTAMP: Date.now() },
      helpers: buildFakeHelpers(database)
    });
    await client.registerPresence();
    await flush();

    const last = statuses[statuses.length - 1];
    expect(last.status).toBe('client_present');

    await controller.stop();
    client.dispose();
  });

  test('client disconnect transitions back to waiting after grace period', async () => {
    const database = new FakeDatabase();
    const statuses = [];
    const controller = new SessionController({
      signalingFactory: makeSignalingFactory(database),
      onStatus: (s) => statuses.push(s),
      onLog: () => {}
    });
    const { sessionCode } = await controller.start({ uid: 'host-uid' });
    await flush();

    const client = new FirebaseSignaling({
      database,
      role: 'client',
      sessionCode,
      uid: 'client-uid',
      refFactory: (db, path) => db.ref(path),
      serverValue: { TIMESTAMP: Date.now() },
      helpers: buildFakeHelpers(database)
    });
    await client.registerPresence();
    await flush();
    expect(statuses[statuses.length - 1].status).toBe('client_present');

    await database.remove(database.ref(`sessions/${sessionCode}/client`));
    await flush();

    jest.advanceTimersByTime(PEER_DISCONNECT_GRACE_MS + 100);
    await flush();

    expect(statuses[statuses.length - 1].status).toBe('waiting');

    await controller.stop();
    client.dispose();
  });
});
