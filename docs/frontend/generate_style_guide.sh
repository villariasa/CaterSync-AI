#!/usr/bin/env bash
# Generate style_guide.pdf from Markdown using pandoc
# Requires: pandoc, wkhtmltopdf or a PDF engine supported by pandoc
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MD="$HERE/style_guide.md"
OUT="$HERE/style_guide.pdf"

if ! command -v pandoc &>/dev/null; then
  echo "pandoc not found. Install pandoc to generate PDF."
  exit 1
fi

pandoc "$MD" -o "$OUT" --pdf-engine=wkhtmltopdf || pandoc "$MD" -o "$OUT"
echo "Generated $OUT"
