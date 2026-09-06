#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARTS="$ROOT/artifacts/v0.2/parts"
OUT="$ROOT/dist/MIDI-Stage-v0.2.html"
TMP="$(mktemp)"
trap 'rm -f "$TMP" "$TMP.gz"' EXIT

mkdir -p "$ROOT/dist"
cat "$PARTS"/MIDI-Stage-v0.2.html.gz.b64.part* > "$TMP"
base64 --decode "$TMP" > "$TMP.gz" 2>/dev/null || base64 -D "$TMP" > "$TMP.gz"
gzip -dc "$TMP.gz" > "$OUT"

echo "Wrote $OUT"
