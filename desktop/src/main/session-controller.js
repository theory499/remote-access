'use strict';

const { generate } = require('../shared/session-id');

const PEER_DISCONNECT_GRACE_MS = 10000;

class SessionController {
  constructor({ signalingFactory, onStatus, onLog }) {
    this.signalingFactory = signalingFactory;
    this.onStatus = onStatus || (() => {});
    this.onLog = onLog || (() => {});
    this.signaling = null;
    this.sessionCode = null;
    this.disconnectTimer = null;
  }

  setStatus(status, extra = {}) {
    this.onStatus({ status, ...extra });
  }

  log(message) {
    this.onLog(message);
  }

  async start({ uid }) {
    this.sessionCode = generate();
    this.signaling = this.signalingFactory({
      role: 'host',
      uid,
      sessionCode: this.sessionCode
    });
    await this.signaling.registerPresence();
    this.setStatus('waiting', { code: this.sessionCode });
    this.log(`Session opened with pairing code ${this.sessionCode}`);

    this.signaling.watchPeerPresence((presence) => {
      if (presence) {
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
        this.setStatus('client_present', { code: this.sessionCode });
        this.log(`Client connected (uid ${presence.uid})`);
      } else if (this.disconnectTimer === null) {
        this.disconnectTimer = setTimeout(() => {
          this.setStatus('waiting', { code: this.sessionCode });
          this.log('Client disconnected');
        }, PEER_DISCONNECT_GRACE_MS);
      }
    });

    return { sessionCode: this.sessionCode };
  }

  async stop() {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    if (this.signaling) {
      try {
        await this.signaling.clearSession();
      } catch (err) {
        this.log(`Failed to clear session: ${err.message}`);
      }
      this.signaling.dispose();
      this.signaling = null;
    }
    this.sessionCode = null;
    this.setStatus('stopped');
  }
}

module.exports = { SessionController, PEER_DISCONNECT_GRACE_MS };
