// Checks the plugin manifests of a repository against pinned JSON Schemas.
// Usage: node ci/validate.mjs [repo-dir]   Exit 1 when any check fails. No network.
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const loadSchema = (file) => JSON.parse(readFileSync(join(here, "schemas", file), "utf-8"));

// Where each client reads a plugin manifest and a marketplace. Cursor takes the first file that exists.
const CURSOR_READS = {
  plugin: [".cursor-plugin/plugin.json", ".claude-plugin/plugin.json", "plugin.json"],
  marketplace: [".cursor-plugin/marketplace.json", ".claude-plugin/marketplace.json"],
};

// Relaxation: Cursor accepts version and homepage on a marketplace entry, but the published schema forbids them.
// This is the only place that loosens a published schema.
const relaxCursorMarketplace = (schema) => {
  schema.$defs.pluginEntry.properties.version = { type: "string" };
  schema.$defs.pluginEntry.properties.homepage = { type: "string", format: "uri" };
  return schema;
};

// The schemas. draft7 is Ajv's default dialect, 2020 is the dialect of the Agent Plugins schemas.
const SCHEMAS = {
  "cursor-plugin": { file: "cursor-plugin.schema.json" },
  "cursor-marketplace": { file: "cursor-marketplace.schema.json", relax: relaxCursorMarketplace },
  "quirks": { file: "quirks.schema.json", isQuirk: true },
  "agent-plugin": { file: "plugin.schema.json", draft2020: true },
  "agent-mcp": { file: "mcp.schema.json", draft2020: true },
};

// The core: path -> the schemas that read it. A path with `cursor` is also read by Cursor, as that kind of file.
// Cursor schemas apply to the first existing file in CURSOR_READS, so a .claude-plugin file must pass them when no
// .cursor-plugin file shadows it. Claude Code reads .claude-plugin/*: `claude plugin validate` checks it in the workflow.
const MANIFESTS = {
  ".cursor-plugin/plugin.json": { cursor: "plugin" },
  ".cursor-plugin/marketplace.json": { cursor: "marketplace" },
  ".claude-plugin/plugin.json": { required: true, cursor: "plugin" },
  ".claude-plugin/marketplace.json": { required: true, cursor: "marketplace" },
  "plugin.json": { schemas: ["agent-plugin"], cursor: "plugin" },
  "mcp.json": { schemas: ["agent-mcp"] },
  ".mcp.json": {},
  "mcp_config.json": {},
  ".antigravity-plugin/plugin.json": {},
};
const CURSOR_SCHEMAS = { plugin: ["cursor-plugin"], marketplace: ["cursor-marketplace", "quirks"] };

export const MANIFEST_PATHS = Object.keys(MANIFESTS);

export const schemasFor = (path, exists) => {
  const { schemas = [], cursor } = MANIFESTS[path];
  const firstRead = cursor && CURSOR_READS[cursor].find(exists) === path;
  return [...schemas, ...(firstRead ? CURSOR_SCHEMAS[cursor] : [])];
};

const compile = (name, { quirks }) => {
  const { file, relax, draft2020, isQuirk } = SCHEMAS[name];
  if (isQuirk && !quirks) return undefined;
  const ajv = new (draft2020 ? Ajv2020 : Ajv)({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(relax ? relax(loadSchema(file)) : loadSchema(file));
};

// Returns a list of problem lines. `quirks: false` leaves out quirks.schema.json (the fixtures use it as a control).
export const validate = (root, { quirks = true } = {}) => {
  const problems = [];
  const exists = (rel) => existsSync(join(root, rel));
  const docs = {};
  for (const [path, { required }] of Object.entries(MANIFESTS)) {
    if (!exists(path)) {
      if (required) problems.push(`${path}: missing`);
      continue;
    }
    try {
      docs[path] = JSON.parse(readFileSync(join(root, path), "utf-8"));
    } catch (error) {
      problems.push(`${path}: invalid JSON (${error.message})`);
    }
  }
  const validators = {};
  for (const path of Object.keys(docs)) {
    for (const name of schemasFor(path, exists)) {
      validators[name] ??= compile(name, { quirks });
      const run = validators[name];
      if (run && !run(docs[path])) {
        for (const e of run.errors) problems.push(`${path} [${name}] ${e.instancePath || "/"} ${e.message}${(e.params?.additionalProperty ?? e.params?.propertyName) ? `: ${e.params.additionalProperty ?? e.params.propertyName}` : ""}`);
      }
    }
  }

  // Checks no schema can state: one file against another, or a file against the directory.
  const agree = (field) => {
    const seen = [];
    for (const [path, doc] of Object.entries(docs)) {
      if (MANIFESTS[path].cursor === "plugin" || path === ".antigravity-plugin/plugin.json") seen.push([path, doc?.[field]]);
      if (Array.isArray(doc?.plugins)) doc.plugins.forEach((entry, i) => seen.push([`${path} entry ${i}`, entry?.[field]]));
    }
    const values = new Set(seen.map(([, v]) => v).filter((v) => v !== undefined));
    if (values.size > 1) problems.push(`${field} differs: ${seen.map(([p, v]) => `${p}=${JSON.stringify(v)}`).join(", ")}`);
  };
  agree("name");
  agree("version");
  // A relative Cursor source names a directory that holds a plugin manifest. quirks.schema.json rejects the other sources.
  const cursorMarketplace = CURSOR_READS.marketplace.find((p) => docs[p]);
  for (const [i, { source }] of (docs[cursorMarketplace]?.plugins ?? []).entries()) {
    if (typeof source !== "string" || /^([a-zA-Z][a-zA-Z0-9+.-]*:|[/\\])/.test(source)) continue;
    const dir = resolve(root, source);
    if (!CURSOR_READS.plugin.some((f) => existsSync(join(dir, f)))) problems.push(`${cursorMarketplace} entry ${i}: source "${source}" has no plugin manifest`);
  }
  return problems;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = validate(resolve(process.argv[2] ?? "."));
  console.log(problems.length ? problems.map((p) => `FAIL ${p}`).join("\n") : "PASS all manifests");
  process.exitCode = problems.length ? 1 : 0;
}
