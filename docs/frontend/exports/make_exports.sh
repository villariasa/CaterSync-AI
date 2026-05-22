#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/catersync-design-exports.zip"

rm -f "$OUT"
zip -r "$OUT" icons tokens README.md
echo "Created $OUT"
