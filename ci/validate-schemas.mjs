// Validates each client manifest against its schema. Unknown fields fail.
// Usage: node ci/validate-schemas.mjs [repo-dir]   (default: current directory)
// Needs ajv and ajv-formats (installed by the workflow).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2] ?? ".";
const AGENT_SCHEMAS = "https://agent-plugins.org/schemas/1.0.0";

const readJson = async (path) => JSON.parse(await readFile(path, "utf-8"));
const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} returned ${response.status}`);
  return response.json();
};

// Cursor's runtime accepts extra plugin-entry fields (such as version and homepage)
// that its published schema forbids. Cursor 3.25.9 resolves main 1f40631 with them.
// Relax only that level, in memory, so the vendored file stays identical to upstream.
const allowExtraPluginEntryFields = (schema) => {
  schema.$defs.pluginEntry.additionalProperties = true;
  return schema;
};

// Agent Plugins schemas use draft 2020-12. Cursor schemas use draft-07.
const checks = [
  { manifest: "plugin.json", draft: "2020", schema: () => fetchJson(`${AGENT_SCHEMAS}/plugin.schema.json`) },
  { manifest: "mcp.json", draft: "2020", schema: () => fetchJson(`${AGENT_SCHEMAS}/mcp.schema.json`) },
  { manifest: ".cursor-plugin/plugin.json", draft: "07", schema: () => readJson(join(here, "schemas/cursor/plugin.schema.json")) },
  { manifest: ".cursor-plugin/marketplace.json", draft: "07", schema: async () => allowExtraPluginEntryFields(await readJson(join(here, "schemas/cursor/marketplace.schema.json"))) },
];

let failed = 0;
for (const { manifest, draft, schema } of checks) {
  const ajv = draft === "2020" ? new Ajv2020({ allErrors: true, strict: false }) : new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(await schema());
  if (validate(await readJson(join(dir, manifest)))) {
    console.log(`PASS ${manifest}`);
  } else {
    failed += 1;
    console.error(`FAIL ${manifest}`);
    for (const error of validate.errors) console.error(`  ${error.instancePath || "/"} ${error.message} ${JSON.stringify(error.params)}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
