#!/usr/bin/env bash
set -euo pipefail
# Isolated WATCH demo bundle, NEVER deploys or touches the production Pages site.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/watch-preview-dist"
rm -rf -- "$OUT"
mkdir -p "$OUT/backtest"
cp "$ROOT/index.html" "$OUT/index.html"
for name in vector-watch-browser vector-watch-shadow vector-v14-hysteresis vector-ait-v1; do
  cp "$ROOT/backtest/$name.mjs" "$OUT/backtest/$name.mjs"
done
# Extra read-only browser data connector. The research engine is SHA-locked
# and only its Node CLI/metadata are transformed for browser compatibility.
for name in vector-exit-selection quarantine quality-gate cryptojuju-adapter vector-forward-live; do
  cp "$ROOT/backtest/$name.mjs" "$OUT/backtest/$name.mjs"
done
cd "$ROOT"
node scripts/build-vector-dashboard.mjs
node scripts/build-forward-live-dashboard.mjs
cat > "$OUT/robots.txt" <<'ROBOTS'
User-agent: *
Disallow: /
ROBOTS
# Restrict build output to the needed static site, never source/CI docs/secrets.
test "$(find "$OUT" -type f | wc -l | tr -d ' ')" = 13
grep -q "Retournement possible" "$OUT/index.html" || { echo 'WATCH UI missing' >&2; exit 1; }
grep -q 'visibleByDefault:false' "$OUT/backtest/vector-watch-browser.mjs" || { echo 'WATCH must default OFF' >&2; exit 1; }
echo 'WATCH and read-only Vector dashboard isolated Render preview: 13 static files ready'
