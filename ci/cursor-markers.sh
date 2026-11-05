#!/usr/bin/env bash
# Checks that the installed Cursor agent still contains the string literals that ci/cursor-resolve.mjs relies on.
# Usage: ci/cursor-markers.sh [cursor-agent-dir]   (default: ~/.local/share/cursor-agent)
# Matches string literals only. Minified identifiers change in every release.
set -uo pipefail

root="${1:-$HOME/.local/share/cursor-agent}"
[ -d "$root/versions" ] || { echo "FAIL no $root/versions directory (is cursor-agent installed?)" >&2; exit 1; }
# Check only the newest version. A retained old version must not satisfy a marker.
newest="$(ls "$root/versions" | grep -v '^\.' | sort -V | tail -n 1)"
[ -n "$newest" ] || { echo "FAIL no version directory under $root/versions" >&2; exit 1; }
echo "cursor-agent versions: $(ls "$root/versions" | grep -v '^\.' | tr '\n' ' ')(checking $newest)"

markers=(
  '[".cursor-plugin/plugin.json",".claude-plugin/plugin.json","plugin.json"]'
  '[".cursor-plugin/marketplace.json",".claude-plugin/marketplace.json"]'
  'has unresolved or unsafe source path'
  'without gitPath'
  '[".mcp.json","mcp.json"]'
)

status=0
for marker in "${markers[@]}"; do
  if grep -rqF --include='*.js' --include='*.mjs' --include='*.cjs' -- "$marker" "$root/versions/$newest"; then
    echo "PASS $marker"
  else
    echo "FAIL marker missing: $marker" >&2
    status=1
  fi
done
exit "$status"
