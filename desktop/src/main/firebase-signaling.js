'use strict';

class FirebaseSignaling {
  constructor({ database, role, sessionCode, uid, refFactory, serverValue, helpers }) {
    if (!database) throw new Error('database is required');
    if (role !== 'host' && role !== 'client') throw new Error('role must be host or client');
    if (typeof sessionCode !== 'string' || sessionCode.length === 0) {
      throw new Error('sessionCode is required');
    }
    if (typeof uid !== 'string' || uid.length === 0) {
      throw new Error('uid is required');
    }
    this.database = database;
    this.role = role;
    this.peer = role === 'host' ? 'client' : 'host';
    this.sessionCode = sessionCode;
    this.uid = uid;
    this.refFactory = refFactory;
    this.serverValue = serverValue;
    this.helpers = helpers;
    this.unsubscribes = [];
    this.disposed = false;
  }

  basePath() {
    return `sessions/${this.sessionCode}`;
  }

  ref(suffix) {
    return this.refFactory(this.database, `${this.basePath()}/${suffix}`);
  }

  async registerPresence() {
    const presenceRef = this.ref(this.role);
    await this.helpers.set(presenceRef, {
      uid: this.uid,
      createdAt: this.serverValue.TIMESTAMP
    });
    await this.helpers.onDisconnectRemove(presenceRef);
  }

  watchPeerPresence(callback) {
    const peerRef = this.ref(this.peer);
    const unsubscribe = this.helpers.onValue(peerRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null);
    });
    this.unsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  async sendOffer(description) {
    await this.helpers.set(this.ref('offer'), description);
  }

  watchOffer(callback) {
    const unsubscribe = this.helpers.onValue(this.ref('offer'), (snapshot) => {
      if (snapshot.exists()) callback(snapshot.val());
    });
    this.unsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  async sendAnswer(description) {
    await this.helpers.set(this.ref('answer'), description);
  }

  watchAnswer(callback) {
    const unsubscribe = this.helpers.onValue(this.ref('answer'), (snapshot) => {
      if (snapshot.exists()) callback(snapshot.val());
    });
    this.unsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  async sendIceCandidate(candidate) {
    const ref = this.ref(`iceCandidates/${this.role}`);
    await this.helpers.push(ref, candidate);
  }

  watchIceCandidates(callback) {
    const ref = this.ref(`iceCandidates/${this.peer}`);
    const unsubscribe = this.helpers.onChildAdded(ref, (snapshot) => {
      if (snapshot.exists()) callback(snapshot.val());
    });
    this.unsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  async clearSession() {
    await this.helpers.remove(this.ref(''));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.unsubscribes) {
      try { off(); } catch (err) { /* swallow on teardown */ }
    }
    this.unsubscribes = [];
  }
}

function buildRealtimeHelpers() {
  const database = require('firebase/database');
  return {
    refFactory: database.ref,
    serverValue: database.serverTimestamp ? { TIMESTAMP: database.serverTimestamp() } : database.ServerValue,
    helpers: {
      set: database.set,
      push: (ref, value) => database.push(ref, value),
      remove: database.remove,
      onValue: (ref, cb) => database.onValue(ref, cb),
      onChildAdded: (ref, cb) => database.onChildAdded(ref, cb),
      onDisconnectRemove: (ref) => database.onDisconnect(ref).remove()
    }
  };
}

module.exports = { FirebaseSignaling, buildRealtimeHelpers };
