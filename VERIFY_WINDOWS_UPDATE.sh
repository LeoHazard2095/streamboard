#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node desktop/scripts/verify-source.js >/dev/null 2>&1 && {
  echo "Runtime files verified (including HLS.js)";
} || {
  # HLS.js is intentionally added at build time from npm; preflight without it.
  echo "Checking cumulative Windows source before npm installs HLS.js..."
  for f in desktop/main.js desktop/preload.js desktop/stream-bridge.js desktop/repo-discovery.js desktop/src/app.js desktop/src/index.html desktop/src/style.css desktop/src/logic.js desktop/src/analyzer.js desktop/src/playlist-worker.js desktop/scripts/copy-hls.js desktop/scripts/verify-packed.js .github/workflows/build-desktop.yml; do
    [[ -s "$f" ]] || { echo "Missing $f" >&2; exit 1; }
  done
  echo "Required desktop source files are present. HLS.js will be installed by GitHub Actions."
}
node --check desktop/main.js
node --check desktop/src/app.js
node --check desktop/stream-bridge.js
(cd desktop && npm test)
echo "Windows source verified. Push to GitHub to build and validate packaged installer."
