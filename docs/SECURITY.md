# Security model

This document covers what the suite protects against, how, and what
is explicitly out of scope.

## Trust boundaries

```
                +----------------+
                |  Phone owner   |   physical possession of phone
                +-------+--------+
                        | controls
                        v
+-----------+   +----------------+   +-----------------+
| Anonymous |   |                |   | @nut-tree-fork  |
| Firebase  +-->|  Android app   +-->|  nut-js OS API  |
| Auth UID  |   |   (CLIENT)     |   |  (full input)   |
+-----+-----+   +-------+--------+   +--------+--------+
      ^                 |                      ^
      | over TLS        | over WebRTC          | only via
      | + RTDB rules    | (SRTP, DCEP)         | InputController
      v                 v                      |
+-----+----------------------+         +-------+-------+
| Firebase Realtime Database |<--------+ Desktop host  |
| (SDP + ICE candidate ex.)  |  TLS    |   (HOST)      |
+----------------------------+         +---------------+
                                              ^
                                              | physical possession
                                       +------+--------+
                                       | Desktop owner |
                                       +---------------+
```

Three trust boundaries:

1. **Auth boundary.** Anyone can sign in anonymously to Firebase. The
   rules below decide what they can read or write afterwards.
2. **Pairing boundary.** Even after sign-in, a user can only interact
   with a `sessions/{code}` subtree if either (a) the code is brand new
   and they want to claim a role, or (b) the rules already pin their
   UID to a role in that session.
3. **Input dispatch boundary.** Inside the desktop process, the
   renderer can only invoke OS-level input through the IPC channel
   `input:event`. The main process validates every event before
   forwarding it to `nut.js`.

## Realtime Database security rules

The shipping rules in `firebase/database.rules.json`:

- Limit the session-code namespace to `^[A-Z0-9]{6}$` so no other
  paths can be created underneath.
- Allow read access on `sessions/{code}` only to its own host or
  client UID.
- Bind the `host` and `client` nodes such that:
  - A node can be claimed only when it does not yet exist.
  - Once claimed, only the owning UID can modify or delete it.
- Restrict `sessions/{code}/offer` writes to the current host UID.
- Restrict `sessions/{code}/answer` writes to the current client UID.
- Restrict `sessions/{code}/iceCandidates/host` writes to the host UID
  and reads to the client UID. The opposite restriction applies to
  `iceCandidates/client`.

The practical effect is that even if an attacker enumerates session
codes, they cannot read the SDP or hijack the negotiation, because
those reads and writes are bound to UIDs that the original participants
established when they joined.

## Threats covered

| Threat | Mitigation |
| --- | --- |
| Eavesdropping on the WebRTC data path | DTLS-SRTP (mandatory in WebRTC). All video and data-channel traffic is encrypted. |
| Eavesdropping on signalling | TLS / WSS between client and Firebase. Firebase enforces TLS for the Realtime Database API. |
| Code guessing while both peers are offline | Code is generated fresh on each session start. Once both peers leave, the host removes `sessions/{code}` entirely via `clearSession()` and `onDisconnect`. |
| Third party hijacking an active session | Once both peers have set their `uid` fields, the rules prevent a third UID from overwriting offer / answer / ICE entries. |
| Malicious phone trying to crash the host | Every incoming data-channel message goes through `protocol.validate`. Invalid messages are dropped before reaching `InputController` or the OS. |
| Compromised renderer trying to escape the sandbox | Renderer runs with `contextIsolation: true`, `nodeIntegration: false`, and a strict CSP that allows only Firebase HTTPS / WSS origins. The only Node-capable surface is the preload's `ipcRenderer.invoke` for three named channels. |

## Threats not covered

| Threat | Why it is out of scope |
| --- | --- |
| Code guessing while both peers are still in negotiation | A 32^6 space (~30 bits) is large enough to make online guessing slow but is not cryptographically strong. For environments where the network is hostile, augment the rules with an additional `.validate` requiring a pre-shared secret as an extra child node. |
| Authenticated user impersonation | Anyone with the desktop owner's Firebase password (if you replace anonymous auth with email/password) can impersonate them and pair as the host. Use phone or hardware-key second factors if this matters. |
| Side-channel attacks on the OS | If an attacker can already run arbitrary code as the desktop user, no application-level mitigation will help. |
| Denial of service against Firebase | Mitigated by Firebase's own quota and abuse controls, not by this application. |
| Malicious `@nut-tree-fork/nut-js` releases | The host trusts npm dependencies. Lock them with `npm ci` against a vendored `package-lock.json`. |

## Auditing the rules

To verify the rules behave as intended, the Firebase CLI has a built-in
simulator:

```
firebase emulators:start --only database
```

Then write tests against the emulator using the Firebase Rules Unit
Testing library. The repository does not currently ship those tests
because they require running an emulator with real Firebase tooling;
they are a reasonable next step.

## Recommended deployment hardening

1. **Replace anonymous auth with a real identity provider** if the host
   computer holds sensitive data. Anonymous Firebase users can be
   created by anyone with the API key, so the rules are the only barrier.
2. **Add a TURN server with credentials** for environments where the
   peers may be behind symmetric NATs. Free TURN services exist;
   self-hosted `coturn` is also straightforward.
3. **Rate-limit session creation** via a Cloud Function that throttles
   creation by `auth.uid` and writes failures into the rules namespace.
4. **Scope database rules to a project-specific path** so other Firebase
   features in the same project cannot collide with `sessions/`.

## Cross-references

- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - how to configure the rules
  and the auth provider.
- [CONNECTION_FLOW.md](CONNECTION_FLOW.md) - which UID writes which
  node at which step.
- [PROTOCOL.md](PROTOCOL.md) - the schema the renderer validates
  against on every incoming message.
