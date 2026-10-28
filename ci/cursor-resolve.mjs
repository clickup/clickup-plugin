// Checks that Cursor can resolve and install the "clickup" plugin from this repo.
// Usage: node ci/cursor-resolve.mjs [repo-dir]   (default: current directory)
// Exit 0 when every check passes, exit 1 with one line per failure.
//
// The lookup logic (q, he, ge, resolve) is copied from Cursor 3.25.9
// (cursor-agent-exec/dist/main.js). Only change: JSON.parse replaces Cursor's zod parser.
import { readFile, access } from "node:fs/promises";
import { join, isAbsolute } from "node:path";

const PLUGIN_NAME = "clickup";
const MARKETPLACE_LOOKUP_ORDER = [".cursor-plugin/marketplace.json", ".claude-plugin/marketplace.json"];
const UNEXPANDED_VARIABLES = ["${PLUGIN_ROOT}", "${PLUGIN_DATA}"];
const MCP_FILES = ["mcp.json", ".mcp.json"];

// copied from Cursor 3.25.9
function joinPluginRoot(source, pluginRoot) {
  if (typeof source !== "string") return null;
  let path = source;
  if (path.startsWith("./")) path = path.slice(2);
  if (pluginRoot !== undefined) {
    let root = pluginRoot;
    if (root.startsWith("./")) root = root.slice(2);
    if (root.endsWith("/")) root = root.slice(0, -1);
    path = `${root}/${path}`;
  }
  return path || ".";
}

// copied from Cursor 3.25.9
function isSafePath(path) {
  return !path.includes("..") && !isAbsolute(path) && !path.includes("://");
}

// copied from Cursor 3.25.9 (resolver)
export async function resolve(dir, name) {
  for (const file of MARKETPLACE_LOOKUP_ORDER) {
    let text;
    try {
      text = await readFile(join(dir, file), "utf-8");
    } catch {
      continue;
    }
    const marketplace = JSON.parse(text);
    const plugin = marketplace.plugins.find((entry) => entry.name === name.toLowerCase());
    if (!plugin) {
      return { type: "manifest-unresolved", file, reason: `Plugin ${JSON.stringify(name)} not found in ${file}` };
    }
    if (typeof plugin.source !== "string" && plugin.source.source === "git-subdir") {
      return { type: "manifest-unresolved", file, reason: `Plugin ${JSON.stringify(name)} uses unsupported git-subdir source` };
    }
    const gitPath = joinPluginRoot(plugin.source, marketplace.metadata?.pluginRoot);
    if (gitPath && isSafePath(gitPath)) return { type: "resolved", file, gitPath };
    return { type: "manifest-unresolved", file, reason: `Plugin ${JSON.stringify(name)} has unresolved or unsafe source path` };
  }
  return { type: "no-manifest" };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function checkMcpVariables(dir) {
  const failures = [];
  for (const file of MCP_FILES) {
    let text;
    try {
      text = await readFile(join(dir, file), "utf-8");
    } catch {
      continue;
    }
    for (const variable of UNEXPANDED_VARIABLES) {
      if (text.includes(variable)) {
        failures.push(`${file} uses ${variable}, which Cursor does not expand`);
      }
    }
  }
  return failures;
}

export async function check(dir) {
  const failures = [];
  const result = await resolve(dir, PLUGIN_NAME);
  if (result.type === "manifest-unresolved") {
    failures.push(`manifest-unresolved (${result.file}): ${result.reason}`);
  } else if (result.type === "no-manifest") {
    failures.push(`no-manifest: neither ${MARKETPLACE_LOOKUP_ORDER.join(" nor ")} found`);
  } else {
    const pluginJson = join(dir, result.gitPath, ".cursor-plugin/plugin.json");
    if (!(await exists(pluginJson))) {
      failures.push(`${result.file} source "${result.gitPath}" has no .cursor-plugin/plugin.json`);
    }
  }
  return [...failures, ...(await checkMcpVariables(dir))];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? ".";
  const failures = await check(dir);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length === 0) console.log(`OK Cursor resolves plugin "${PLUGIN_NAME}" in ${dir}`);
  process.exit(failures.length === 0 ? 0 : 1);
}
