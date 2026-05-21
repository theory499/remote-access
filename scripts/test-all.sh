#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Desktop tests ==="
cd "$ROOT_DIR/desktop"
if [ ! -d node_modules ]; then
    npm install --no-audit --no-fund --loglevel=error
fi
npm test

echo
echo "=== Android JVM-safe verification tests ==="
cd "$ROOT_DIR/mobile/verify"
gradle test --no-daemon

echo
echo "=== Android full Gradle tests (requires Android SDK) ==="
cd "$ROOT_DIR/mobile"
if [ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]; then
    gradle test --no-daemon
else
    echo "[skip] ANDROID_HOME / ANDROID_SDK_ROOT not set, skipping full Android build."
fi

echo
echo "All available tests passed."
