'use strict';

const { FakeDatabase, buildFakeHelpers } = require('./fake-firebase');
const { FirebaseSignaling } = require('../../src/main/firebase-signaling');

function makeSignaling(database, role, sessionCode, uid) {
  return new FirebaseSignaling({
    database,
    role,
    sessionCode,
    uid,
    refFactory: (db, path) => db.ref(path),
    serverValue: { TIMESTAMP: Date.now() },
    helpers: buildFakeHelpers(database)
  });
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('signalling round-trip over fake database', () => {
  test('host and client exchange presence, SDP, and ICE candidates', async () => {
    const database = new FakeDatabase();
    const host = makeSignaling(database, 'host', 'AAAAAA', 'host-uid');
    const client = makeSignaling(database, 'client', 'AAAAAA', 'client-uid');

    const hostSawClient = jest.fn();
    const clientSawHost = jest.fn();
    const clientOffers = [];
    const hostAnswers = [];
    const hostCandidates = [];
    const clientCandidates = [];

    host.watchPeerPresence(hostSawClient);
    client.watchPeerPresence(clientSawHost);
    client.watchOffer((offer) => clientOffers.push(offer));
    host.watchAnswer((answer) => hostAnswers.push(answer));
    host.watchIceCandidates((candidate) => hostCandidates.push(candidate));
    client.watchIceCandidates((candidate) => clientCandidates.push(candidate));

    await host.registerPresence();
    await flush();
    expect(clientSawHost).toHaveBeenCalledWith(expect.objectContaining({ uid: 'host-uid' }));

    await client.registerPresence();
    await flush();
    expect(hostSawClient).toHaveBeenCalledWith(expect.objectContaining({ uid: 'client-uid' }));

    await host.sendOffer({ type: 'offer', sdp: 'fake-host-sdp' });
    await flush();
    expect(clientOffers[clientOffers.length - 1]).toEqual({ type: 'offer', sdp: 'fake-host-sdp' });

    await client.sendAnswer({ type: 'answer', sdp: 'fake-client-sdp' });
    await flush();
    expect(hostAnswers[hostAnswers.length - 1]).toEqual({ type: 'answer', sdp: 'fake-client-sdp' });

    await host.sendIceCandidate({ candidate: 'host-1' });
    await host.sendIceCandidate({ candidate: 'host-2' });
    await client.sendIceCandidate({ candidate: 'client-1' });
    await flush();

    expect(clientCandidates.map((c) => c.candidate)).toEqual(['host-1', 'host-2']);
    expect(hostCandidates.map((c) => c.candidate)).toEqual(['client-1']);

    host.dispose();
    client.dispose();
  });

  test('dispose stops further callbacks', async () => {
    const database = new FakeDatabase();
    const host = makeSignaling(database, 'host', 'BBBBBB', 'host-uid');
    const client = makeSignaling(database, 'client', 'BBBBBB', 'client-uid');

    const offers = [];
    client.watchOffer((offer) => offers.push(offer));
    client.dispose();

    await host.sendOffer({ type: 'offer', sdp: 'first' });
    await flush();
    expect(offers).toHaveLength(0);

    host.dispose();
  });

  test('clearSession removes the entire session subtree', async () => {
    const database = new FakeDatabase();
    const host = makeSignaling(database, 'host', 'CCCCCC', 'host-uid');
    await host.registerPresence();
    await host.sendOffer({ type: 'offer', sdp: 'x' });
    await flush();

    let value;
    database.onValue(database.ref('sessions/CCCCCC'), (snap) => { value = snap.val(); });
    await flush();
    expect(value).toBeTruthy();

    await host.clearSession();
    await flush();
    expect(value === undefined || value === null).toBe(true);

    host.dispose();
  });

  test('onDisconnect removes presence', async () => {
    const database = new FakeDatabase();
    const host = makeSignaling(database, 'host', 'DDDDDD', 'host-uid');
    await host.registerPresence();

    let value;
    database.onValue(database.ref('sessions/DDDDDD/host'), (snap) => { value = snap.val(); });
    await flush();
    expect(value).toEqual(expect.objectContaining({ uid: 'host-uid' }));

    await database.triggerDisconnect();
    await flush();
    expect(value === undefined || value === null).toBe(true);

    host.dispose();
  });
});
