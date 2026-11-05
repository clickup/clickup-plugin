// Emulates how Cursor finds and loads the "clickup" plugin from this repo.
// Usage: node ci/cursor-resolve.mjs [repo-dir]   (default: current directory)
// Exit 0 when every check passes, exit 1 with one line per failure.
//
// Lookup rules come from the Cursor plugin loader (cursor-agent 2026.10.19-6bbf2c4,
// module cursor-plugins/dist/index.js). See .github/workflows/latest-clients.yml for
// the weekly check that the same string literals still exist in the newest Cursor.
//   manifest lookup  N: .cursor-plugin/plugin.json, .claude-plugin/plugin.json, plugin.json (first valid wins)
//   marketplace      q: .cursor-plugin/marketplace.json, .claude-plugin/marketplace.json (first existing wins)
//   source           only a string resolves ("./" and "." mean the repo root); an object has no gitPath
//   mcp files        .mcp.json then mcp.json, merged by server name (first definition wins),
//                    then mcpServers of the winning manifest (override)
// Simplified: JSON.parse replaces Cursor's zod parser, and symlink/size checks are skipped.
import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_NAME = "clickup";
export const MANIFEST_LOOKUP_ORDER = [".cursor-plugin/plugin.json", ".claude-plugin/plugin.json", "plugin.json"];
export const MARKETPLACE_LOOKUP_ORDER = [".cursor-plugin/marketplace.json", ".claude-plugin/marketplace.json"];
const MCP_FILES = [".mcp.json", "mcp.json"];
const NAME_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const COMPONENT_OR_METADATA_FIELDS = [
  "commands", "agents", "skills", "rules", "hooks", "mcpServers",
  "displayName", "description", "author", "logo", "variables", "capabilities",
];
const NOT_A_SERVER_KEYS = new Set(["author", "owner", "source", "metadata", "$schema"]);
const OTHER_CLIENT_NAMES = ["Claude Code", "Codex", "Antigravity"];
const UNEXPANDED_VARIABLES = ["${PLUGIN_ROOT}", "${PLUGIN_DATA}"];

const readText = async (path) => {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
};

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// Cursor ft(): only a string source resolves. "./" and "." both become ".".
function sourceToGitPath(source, pluginRoot) {
  if (typeof source !== "string") return null;
  let path = source.startsWith("./") ? source.slice(2) : source;
  if (pluginRoot !== undefined) {
    let root = pluginRoot.startsWith("./") ? pluginRoot.slice(2) : pluginRoot;
    if (root.endsWith("/")) root = root.slice(0, -1);
    path = `${root}/${path}`;
  }
  return path || ".";
}

// Cursor gt()
const isSafePath = (path) => !path.includes("..") && !isAbsolute(path) && !path.includes("://");

export async function resolveMarketplace(dir, name) {
  for (const file of MARKETPLACE_LOOKUP_ORDER) {
    const text = await readText(join(dir, file));
    if (text === null) continue;
    const marketplace = parseJson(text);
    if (!marketplace || !Array.isArray(marketplace.plugins)) {
      return { type: "manifest-unresolved", file, reason: `${file} is not valid JSON with a plugins array` };
    }
    const plugin = marketplace.plugins.find((entry) => entry.name === name.toLowerCase());
    if (!plugin) return { type: "manifest-unresolved", file, reason: `Plugin ${JSON.stringify(name)} not found in ${file}` };
    if (typeof plugin.source !== "string" && plugin.source?.source === "git-subdir") {
      return { type: "manifest-unresolved", file, reason: `Plugin ${JSON.stringify(name)} uses unsupported git-subdir source` };
    }
    const gitPath = sourceToGitPath(plugin.source, marketplace.metadata?.pluginRoot);
    if (gitPath && isSafePath(gitPath)) return { type: "resolved", file, gitPath };
    return { type: "manifest-unresolved", file, reason: `Plugin ${JSON.stringify(name)} has unresolved or unsafe source path` };
  }
  return { type: "no-manifest" };
}

// First manifest in N that parses, has a valid name, and holds components or metadata.
export async function resolveManifest(pluginDir) {
  for (const file of MANIFEST_LOOKUP_ORDER) {
    const text = await readText(join(pluginDir, file));
    if (text === null) continue;
    const manifest = parseJson(text);
    if (!manifest || typeof manifest.name !== "string" || !NAME_PATTERN.test(manifest.name)) continue;
    if (!COMPONENT_OR_METADATA_FIELDS.some((field) => manifest[field] !== undefined)) continue;
    return { file, manifest };
  }
  return null;
}

const serversOf = (json) => {
  if (!json || typeof json !== "object") return {};
  if (json.mcpServers && typeof json.mcpServers === "object") return json.mcpServers;
  const flat = {};
  for (const [key, value] of Object.entries(json)) {
    if (NOT_A_SERVER_KEYS.has(key) || !value || typeof value !== "object") continue;
    if (value.command || value.url) flat[key] = value;
  }
  return flat;
};

export async function loadMcpServers(pluginDir, manifest) {
  const servers = {};
  for (const file of MCP_FILES) {
    const text = await readText(join(pluginDir, file));
    if (text === null) continue;
    for (const [name, server] of Object.entries(serversOf(parseJson(text)))) {
      if (servers[name] === undefined) servers[name] = server;
    }
  }
  const declared = manifest?.mcpServers;
  if (declared && typeof declared === "object" && !Array.isArray(declared)) Object.assign(servers, declared);
  return servers;
}

async function checkMcpVariables(dir) {
  const failures = [];
  for (const file of MCP_FILES) {
    const text = await readText(join(dir, file));
    if (text === null) continue;
    for (const variable of UNEXPANDED_VARIABLES) {
      if (text.includes(variable)) failures.push(`${file} uses ${variable}, which Cursor does not expand`);
    }
  }
  return failures;
}

export async function check(dir) {
  const result = await resolveMarketplace(dir, PLUGIN_NAME);
  if (result.type === "manifest-unresolved") return [`manifest-unresolved (${result.file}): ${result.reason}`];
  if (result.type === "no-manifest") {
    return [`no-manifest: neither ${MARKETPLACE_LOOKUP_ORDER.join(" nor ")} found`];
  }
  const pluginDir = join(dir, result.gitPath);
  const failures = [];
  const loaded = await resolveManifest(pluginDir);
  if (!loaded) {
    failures.push(`${result.file} source "${result.gitPath}": no valid manifest in ${MANIFEST_LOOKUP_ORDER.join(", ")}`);
  }
  for (const name of OTHER_CLIENT_NAMES) {
    if (loaded && String(loaded.manifest.description ?? "").includes(name)) {
      failures.push(`${loaded.file} description names another client ("${name}"); Cursor shows this manifest: ${JSON.stringify(loaded.manifest.description)}`);
    }
  }
  const servers = await loadMcpServers(pluginDir, loaded?.manifest);
  const server = servers[PLUGIN_NAME];
  if (!server || (!server.url && !server.command)) {
    failures.push(`no MCP server "${PLUGIN_NAME}" with a url or command in ${MCP_FILES.join(", ")} or the manifest`);
  }
  failures.push(...(await checkMcpVariables(pluginDir)));
  if (loaded && failures.length > 0) console.error(`  manifest that won: ${loaded.file}`);
  if (failures.length === 0) {
    console.log(`  marketplace: ${result.file} -> gitPath "${result.gitPath}"`);
    console.log(`  manifest:    ${loaded.file} (name ${loaded.manifest.name}, description ${JSON.stringify(loaded.manifest.description)})`);
    console.log(`  mcp server:  ${PLUGIN_NAME} -> ${server.url ?? server.command}`);
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? ".";
  const failures = await check(dir);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length === 0) console.log(`OK Cursor resolves plugin "${PLUGIN_NAME}" in ${dir}`);
  process.exit(failures.length === 0 ? 0 : 1);
}
