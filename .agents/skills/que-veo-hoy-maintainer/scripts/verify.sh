#!/usr/bin/env bash
set -euo pipefail

echo "== ¿Qué veo hoy? verification =="

if [ ! -f package.json ]; then
  echo "ERROR: run this script from the repository root."
  exit 1
fi

echo "1/4 Running tests..."
npm test

echo "2/4 Building..."
npm run build

echo "3/4 Checking client-side sources for obvious TMDB secret exposure..."
if grep -R --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  -nE 'VITE_TMDB_TOKEN|TMDB_BEARER_TOKEN[[:space:]]*=' src public index.html 2>/dev/null; then
  echo "ERROR: possible secret exposure in client-side files."
  exit 1
else
  echo "OK: no obvious client-side TMDB secret assignment."
fi

echo "4/4 Checking dist/..."
[ -d dist ] || { echo "ERROR: dist/ missing"; exit 1; }

echo "Verification completed successfully."
