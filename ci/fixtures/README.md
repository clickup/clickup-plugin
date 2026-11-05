# Fixtures

Each directory is a copy of the repo manifests with one defect. `ci/test-fixtures.mjs` runs the Cursor
emulation (`ci/cursor-resolve.mjs`) and the Codex check (`ci/codex-check.sh`) on each one and on the repo tree.

| Fixture | Defect | Cursor | Codex |
|---|---|---|---|
| (repo tree) | none | pass | pass |
| `inc-3645` | marketplace `source` is `{"source":"github"}` and there is no `.cursor-plugin/marketplace.json` (INC-3645) | fail | fail |
| `codex-mcp-type-http` | root `mcp.json` has `"type": "http"`; Codex drops the server without an error | pass | fail |
| `wrong-client-description` | winning Cursor manifest (`.claude-plugin/plugin.json`) says "Connect Claude Code…" | fail | not run |
| `bad-plugin-root` | MCP url uses `${PLUGIN_ROOT}`, which Cursor does not expand | fail | not run |
