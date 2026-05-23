# Documentation Hub

Everything about the Proxia suite lives here. The
documents below are organised so a reader can start anywhere and follow
links to the next layer of detail.

## Start here

| Document | Purpose |
| --- | --- |
| [OVERVIEW.md](OVERVIEW.md) | What this product is, who it is for, what problems it solves. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The full system - components, data flow, threading. |
| [CONNECTION_FLOW.md](CONNECTION_FLOW.md) | Step-by-step lifecycle of a connection from cold start to teardown. |

## How the product works

| Document | Purpose |
| --- | --- |
| [CONNECTION_FLOW.md](CONNECTION_FLOW.md) | How the desktop and the phone find each other and connect. |
| [SCREEN_SHARING.md](SCREEN_SHARING.md) | How the desktop's screen reaches the phone. |
| [INPUT_HANDLING.md](INPUT_HANDLING.md) | How taps and keystrokes on the phone become real mouse clicks and key presses on the desktop. |
| [PROTOCOL.md](PROTOCOL.md) | The exact wire format used over the WebRTC data channel. |

## Module reference

| Document | Purpose |
| --- | --- |
| [DESKTOP.md](DESKTOP.md) | Every file under `desktop/` - what it does, who calls it, what it depends on. |
| [ANDROID.md](ANDROID.md) | Every file under `mobile/android/`. |
| [IOS.md](IOS.md) | Every file under `mobile/ios/`. |
| [COMPONENTS.md](COMPONENTS.md) | A one-page index of every named component on each platform. |

## Operations

| Document | Purpose |
| --- | --- |
| [SETUP_WIZARD.md](SETUP_WIZARD.md) | The first-run wizard in the desktop host - what each step does, what it validates, and the QR pairing flow. |
| [FIREBASE_SETUP.md](FIREBASE_SETUP.md) | The three manual Firebase Console steps the wizard cannot automate. |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Local development setup, build commands, recommended IDE configuration. |
| [TESTING.md](TESTING.md) | Test layers, what is covered, how to run each layer. |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | What to do when something does not work. |
| [SECURITY.md](SECURITY.md) | Threat model, security rules, what we protect against and what we do not. |
| [GLOSSARY.md](GLOSSARY.md) | Definitions of every term and acronym used in the docs and the code. |

## Reading paths

**"I just want to use the product."**
1. [OVERVIEW.md](OVERVIEW.md)
2. [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
3. The root `README.md` Quick Start section.
4. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) when something does not work.

**"I want to understand the system end to end."**
1. [OVERVIEW.md](OVERVIEW.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [CONNECTION_FLOW.md](CONNECTION_FLOW.md)
4. [SCREEN_SHARING.md](SCREEN_SHARING.md) and [INPUT_HANDLING.md](INPUT_HANDLING.md)
5. [PROTOCOL.md](PROTOCOL.md)
6. [SECURITY.md](SECURITY.md)

**"I want to change the code."**
1. [DEVELOPMENT.md](DEVELOPMENT.md)
2. [DESKTOP.md](DESKTOP.md), [ANDROID.md](ANDROID.md), or [IOS.md](IOS.md) for the area you are
   touching.
3. [COMPONENTS.md](COMPONENTS.md) for a quick lookup of where a name lives.
4. [TESTING.md](TESTING.md) before opening a pull request.
