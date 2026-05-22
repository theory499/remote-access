import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  onChildAdded,
  onDisconnect,
  remove,
  serverTimestamp
} from 'firebase/database';

import { FirebaseSignaling } from '../main/firebase-signaling.js';
import { SessionController } from '../main/session-controller.js';
import { parse } from '../shared/protocol.js';

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
];

const dom = {
  code: document.getElementById('pairing-code'),
  status: document.getElementById('status'),
  rtcState: document.getElementById('rtc-state'),
  iceState: document.getElementById('ice-state'),
  rtt: document.getElementById('rtt'),
  restart: document.getElementById('restart'),
  log: document.getElementById('log')
};

const STATUS_LABELS = {
  initialising: 'Initialising',
  authenticating: 'Signing in',
  waiting: 'Waiting for client',
  client_present: 'Client paired, negotiating',
  connected: 'Connected',
  disconnected: 'Disconnected',
  stopped: 'Stopped',
  error: 'Error'
};

const helpers = {
  set,
  push: (r, v) => push(r, v),
  remove,
  onValue: (r, cb) => { const off = onValue(r, cb); return () => off(); },
  onChildAdded: (r, cb) => { const off = onChildAdded(r, cb); return () => off(); },
  onDisconnectRemove: (r) => onDisconnect(r).remove()
};

const serverValue = { TIMESTAMP: serverTimestamp() };

let firebaseApp;
let auth;
let database;
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let session = null;
let pingId = 0;
let pingTimer = null;
let isNegotiating = false;
const pendingPings = new Map();

function log(message) {
  const li = document.createElement('li');
  const stamp = new Date().toISOString().substring(11, 19);
  li.textContent = `[${stamp}] ${message}`;
  dom.log.appendChild(li);
  while (dom.log.childElementCount > 200) dom.log.firstElementChild.remove();
  dom.log.scrollTop = dom.log.scrollHeight;
}

function setStatus(payload) {
  if (payload.code) dom.code.textContent = payload.code;
  if (payload.status) dom.status.textContent = STATUS_LABELS[payload.status] || payload.status;
}

function signalingFactory({ role, uid, sessionCode }) {
  return new FirebaseSignaling({
    database,
    role,
    sessionCode,
    uid,
    refFactory: ref,
    serverValue,
    helpers
  });
}

async function captureScreen() {
  const sources = await window.api.listScreenSources();
  if (sources.length === 0) throw new Error('No capture sources available');
  const sourceId = sources[0].id;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxFrameRate: 30
      }
    }
  });
  return stream;
}

function buildPeerConnection() {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onconnectionstatechange = () => {
    dom.rtcState.textContent = pc.connectionState;
    if (pc.connectionState === 'connected') setStatus({ status: 'connected' });
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      setStatus({ status: 'disconnected' });
    }
  };
  pc.oniceconnectionstatechange = () => {
    dom.iceState.textContent = pc.iceConnectionState;
  };
  pc.onicecandidate = (event) => {
    if (event.candidate && session && session.signaling) {
      session.signaling.sendIceCandidate(event.candidate.toJSON()).catch((err) => {
        log(`Failed to send ICE candidate: ${err.message}`);
      });
    }
  };
  return pc;
}

function attachDataChannel(channel) {
  dataChannel = channel;
  let pendingMove = null;
  let movePending = false;

  const drainMove = async () => {
    if (!pendingMove) { movePending = false; return; }
    const m = pendingMove;
    pendingMove = null;
    try {
      const result = await window.api.dispatchInputEvent(m);
      if (!result.ok) log(`Input dispatch failed: ${result.error}`);
    } finally {
      if (pendingMove) {
        requestAnimationFrame(drainMove);
      } else {
        movePending = false;
      }
    }
  };

  channel.onopen = () => {
    log('Input data channel open');
    schedulePing();
  };
  channel.onclose = () => log('Input data channel closed');
  channel.onmessage = async (event) => {
    const message = parse(event.data);
    if (!message) return;
    if (message.type === 'pong') {
      const sentAt = pendingPings.get(message.id);
      if (sentAt !== undefined) {
        const rtt = performance.now() - sentAt;
        dom.rtt.textContent = `${Math.round(rtt)} ms`;
        pendingPings.delete(message.id);
      }
      return;
    }
    if (message.type === 'ping') {
      channel.send(JSON.stringify({ type: 'pong', id: message.id }));
      return;
    }
    if (message.type === 'mousemove') {
      pendingMove = message;
      if (!movePending) {
        movePending = true;
        requestAnimationFrame(drainMove);
      }
      return;
    }
    const result = await window.api.dispatchInputEvent(message);
    if (!result.ok) log(`Input dispatch failed: ${result.error}`);
  };
}

function schedulePing() {
  if (pingTimer !== null) { clearTimeout(pingTimer); pingTimer = null; }
  if (!dataChannel || dataChannel.readyState !== 'open') return;
  pingId += 1;
  const id = pingId;
  pendingPings.set(id, performance.now());
  dataChannel.send(JSON.stringify({ type: 'ping', id }));
  pingTimer = setTimeout(schedulePing, 2000);
}

async function negotiate() {
  if (isNegotiating || peerConnection) return;
  isNegotiating = true;
  log('Negotiating WebRTC offer');
  peerConnection = buildPeerConnection();
  localStream = await captureScreen();
  for (const track of localStream.getTracks()) {
    peerConnection.addTrack(track, localStream);
  }
  const channel = peerConnection.createDataChannel('input', { ordered: true });
  attachDataChannel(channel);

  const offer = await peerConnection.createOffer({ offerToReceiveAudio: false });
  await peerConnection.setLocalDescription(offer);
  await session.signaling.sendOffer({ type: offer.type, sdp: offer.sdp });

  session.signaling.watchAnswer(async (answer) => {
    if (peerConnection.currentRemoteDescription) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    log('Remote answer applied');
    isNegotiating = false;
  });
  session.signaling.watchIceCandidates(async (candidate) => {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      log(`Failed to add ICE candidate: ${err.message}`);
    }
  });
}

async function bootstrap() {
  setStatus({ status: 'initialising' });
  const active = await window.api.getActiveConfig();
  if (!active || !active.web) {
    log('No backend configuration found; opening setup.');
    await window.api.enterSetup();
    return;
  }
  firebaseApp = initializeApp(active.web);
  auth = getAuth(firebaseApp);
  database = getDatabase(firebaseApp);
  setStatus({ status: 'authenticating' });
  await signInAnonymously(auth);
  await new Promise((resolve) => onAuthStateChanged(auth, (user) => user && resolve()));
  log(`Signed in as ${auth.currentUser.uid}`);
  await startSession();
}

async function startSession() {
  session = new SessionController({
    signalingFactory,
    onStatus: setStatus,
    onLog: log
  });
  await session.start({ uid: auth.currentUser.uid });
  session.signaling.watchPeerPresence(async (presence) => {
    if (presence && !peerConnection) {
      try { await negotiate(); } catch (err) { log(`Negotiation failed: ${err.message}`); }
    }
  });
}

async function restart() {
  log('Restarting session');
  if (pingTimer !== null) { clearTimeout(pingTimer); pingTimer = null; }
  if (dataChannel) {
    try { dataChannel.close(); } catch (_) { /* already closed */ }
    dataChannel = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    for (const track of localStream.getTracks()) track.stop();
    localStream = null;
  }
  if (session) await session.stop();
  pendingPings.clear();
  isNegotiating = false;
  dom.rtcState.textContent = 'new';
  dom.iceState.textContent = 'new';
  dom.rtt.textContent = '-';
  await startSession();
}

dom.restart.addEventListener('click', () => {
  restart().catch((err) => log(`Restart failed: ${err.message}`));
});

const reconfigureBtn = document.getElementById('reconfigure');
if (reconfigureBtn) {
  reconfigureBtn.addEventListener('click', async () => {
    await window.api.resetConfig();
    await window.api.enterSetup();
  });
}

bootstrap().catch((err) => {
  setStatus({ status: 'error' });
  log(`Bootstrap failed: ${err.message}`);
});
