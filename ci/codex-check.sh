#!/usr/bin/env bash
# Installs the "clickup" plugin from a repo tree with the Codex CLI and checks that the MCP server loads.
# Usage: ci/codex-check.sh [repo-dir]   (default: current directory)
# Needs: codex (CI pins @openai/codex@0.152.0). Runs offline against a local marketplace.
# Exit 0 on success. Exit 1 with one FAIL line per problem.
#
# Why each step exists (Codex 0.152.0):
#   - "marketplace add" exits 0 even when every plugin entry is dropped (object source {"source":"github"}).
#   - "plugin list" prints "No plugins found" for that case.
#   - "plugin add" exits 0 when the MCP file is invalid (for example "type": "http" in mcp.json).
#   - "mcp list" is the only place that shows the dropped MCP server.
set -uo pipefail

dir="$(cd "${1:-.}" && pwd)"
marketplace="clickup-plugin-marketplace"
plugin_id="clickup@${marketplace}"

CODEX_HOME="$(mktemp -d)"
export CODEX_HOME
trap 'rm -rf -- "$CODEX_HOME"' EXIT

fail() {
  echo "FAIL $1" >&2
  exit 1
}

echo "codex $(codex --version)"
add_out="$(codex plugin marketplace add "$dir" 2>&1)" || fail "marketplace add exited non-zero: $add_out"

list_out="$(codex plugin list -m "$marketplace" 2>&1)" || fail "plugin list exited non-zero: $list_out"
if grep -q "No plugins found" <<<"$list_out"; then
  fail "plugin list: No plugins found in marketplace ${marketplace} (the entry was dropped, check the source shape)"
fi
grep -q "$plugin_id" <<<"$list_out" || fail "plugin list does not show ${plugin_id}: $list_out"

codex plugin add "$plugin_id" >/dev/null 2>&1 || fail "plugin add ${plugin_id} exited non-zero"

mcp_out="$(codex mcp list 2>&1)" || fail "mcp list exited non-zero: $mcp_out"
grep -Eq '^clickup[[:space:]]+https://mcp\.clickup\.com/mcp' <<<"$mcp_out" \
  || fail "mcp list does not show clickup https://mcp.clickup.com/mcp: $mcp_out"

echo "OK Codex installs ${plugin_id} and lists the clickup MCP server"
