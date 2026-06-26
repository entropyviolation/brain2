#!/usr/bin/env bash
#
# scripts/update-tree.sh — Regenerate docs/tree.txt
#
# Single source of truth for the raw repository tree. Run after any large
# structural change (new top-level dirs, moved/added modules) to keep
# docs/tree.txt accurate. The annotated docs/tree.md is maintained by hand.
#
# Usage:  ./scripts/update-tree.sh   (or: npm run tree)
#
# Notes:
#  - Requires `tree` (brew install tree).
#  - Deps, build output, and VCS dirs are excluded.
#  - Huge generated asset folders (e.g. public/orbs-removebackground, hundreds
#    of PNGs) are excluded from descent and shown as a single collapsed line so
#    the file stays small and regeneration stays cheap.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v tree >/dev/null 2>&1; then
  echo "error: 'tree' is not installed. Install with: brew install tree" >&2
  exit 1
fi

# Dirs excluded entirely (deps / build output / VCS / heavy asset dumps).
IGNORE='node_modules|.git|.next|out|dist|build|coverage|test-results|playwright-report|.turbo|.vercel|orbs-removebackground'
OUT="docs/tree.txt"

tree -I "$IGNORE" --charset=UTF-8 --noreport -n . > "$OUT"

# Re-insert a single collapsed placeholder for the excluded orb-photo folder so
# readers know it exists without listing hundreds of hashed PNGs. Match on the
# filename only (the box-drawing prefix is locale-dependent and unreliable in awk).
if grep -q "velvetscrolltile.png" "$OUT"; then
  tmp="docs/.tree.tmp"
  awk '
    index($0, "velvetscrolltile.png") {
      prefix = $0
      sub(/velvetscrolltile\.png.*/, "", prefix)         # leading tree glyphs/indent
      sub(/└/, "├", prefix)                               # this is no longer the last child
      print prefix "orbs-removebackground   [collapsed: hundreds of generated orb PNGs]"
    }
    { print }
  ' "$OUT" > "$tmp" && mv "$tmp" "$OUT"
fi

echo "Wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') lines)."
