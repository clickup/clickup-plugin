// Positive and negative controls. Runs the Cursor emulation and the Codex check on the repo tree
// and on each fixture, and compares the exit code and the failure reason.
// Usage: node ci/test-fixtures.mjs [--skip-codex]
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const skipCodex = process.argv.includes("--skip-codex");
const fixture = (name) => join(here, "fixtures", name);

// exit: expected exit code. reason: text that must appear in the output. null tool result = not run.
const cases = [
  { name: "repo tree", dir: join(here, ".."), cursor: { exit: 0 }, codex: { exit: 0 } },
  { name: "inc-3645", dir: fixture("inc-3645"), cursor: { exit: 1, reason: "unresolved or unsafe source path" }, codex: { exit: 1, reason: "No plugins found" } },
  { name: "codex-mcp-type-http", dir: fixture("codex-mcp-type-http"), cursor: { exit: 0 }, codex: { exit: 1, reason: "mcp list does not show clickup" } },
  { name: "wrong-client-description", dir: fixture("wrong-client-description"), cursor: { exit: 1, reason: 'description names another client ("Claude Code")' }, codex: null },
  { name: "bad-plugin-root", dir: fixture("bad-plugin-root"), cursor: { exit: 1, reason: "${PLUGIN_ROOT}" }, codex: null },
];

const tools = {
  cursor: (dir) => spawnSync(process.execPath, [join(here, "cursor-resolve.mjs"), dir], { encoding: "utf-8" }),
  codex: (dir) => spawnSync("bash", [join(here, "codex-check.sh"), dir], { encoding: "utf-8" }),
};

let failed = 0;
for (const { name, dir, ...expected } of cases) {
  for (const [tool, want] of Object.entries(expected)) {
    if (!want || (tool === "codex" && skipCodex)) continue;
    const run = tools[tool](dir);
    const output = `${run.stdout}${run.stderr}`;
    const problems = [];
    if (run.status !== want.exit) problems.push(`exit ${run.status}, want ${want.exit}`);
    if (want.reason && !output.includes(want.reason)) problems.push(`missing reason "${want.reason}"`);
    const label = `${tool.padEnd(6)} ${name}`;
    if (problems.length > 0) {
      failed += 1;
      console.error(`FAIL ${label}: ${problems.join("; ")}\n${output}`);
    } else {
      const verdict = want.exit === 0 ? "passes as expected" : "fails as expected";
      console.log(`PASS ${label} (${verdict}: exit ${run.status})`);
    }
  }
}
// cursor-markers.sh must check the newest version only: an old retained version must not satisfy a marker.
const markerCases = [
  { name: "markers: newest version has them", versions: { "2026.10.19-a": true, "2026.10.22-b": true }, exit: 0 },
  { name: "markers: only an old version has them", versions: { "2026.10.19-a": true, "2026.10.22-b": false }, exit: 1 },
];
const markerText = [
  '[".cursor-plugin/plugin.json",".claude-plugin/plugin.json","plugin.json"]',
  '[".cursor-plugin/marketplace.json",".claude-plugin/marketplace.json"]',
  "has unresolved or unsafe source path",
  "without gitPath",
  '[".mcp.json","mcp.json"]',
].join("\n");
for (const { name, versions, exit } of markerCases) {
  const root = mkdtempSync(join(tmpdir(), "cursor-agent-"));
  for (const [version, hasMarkers] of Object.entries(versions)) {
    mkdirSync(join(root, "versions", version), { recursive: true });
    writeFileSync(join(root, "versions", version, "index.js"), hasMarkers ? markerText : "// nothing");
  }
  const run = spawnSync("bash", [join(here, "cursor-markers.sh"), root], { encoding: "utf-8" });
  if (run.status === exit) console.log(`PASS ${name} (exit ${run.status})`);
  else {
    failed += 1;
    console.error(`FAIL ${name}: exit ${run.status}, want ${exit}\n${run.stdout}${run.stderr}`);
  }
}

process.exit(failed === 0 ? 0 : 1);
