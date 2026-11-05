// Validates the Agent Plugins manifests against the 1.0.0 schemas (draft 2020-12). Unknown fields fail.
// Usage: node ci/validate-schemas.mjs [repo-dir]   (default: current directory)
// Needs ajv and ajv-formats (installed by the workflow).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const dir = process.argv[2] ?? ".";
const AGENT_SCHEMAS = "https://agent-plugins.org/schemas/1.0.0";

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} returned ${response.status}`);
  return response.json();
};

const checks = [
  { manifest: "plugin.json", schema: `${AGENT_SCHEMAS}/plugin.schema.json` },
  { manifest: "mcp.json", schema: `${AGENT_SCHEMAS}/mcp.schema.json` },
];

let failed = 0;
for (const { manifest, schema } of checks) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(await fetchJson(schema));
  if (validate(JSON.parse(await readFile(join(dir, manifest), "utf-8")))) {
    console.log(`PASS ${manifest}`);
  } else {
    failed += 1;
    console.error(`FAIL ${manifest}`);
    for (const error of validate.errors) console.error(`  ${error.instancePath || "/"} ${error.message} ${JSON.stringify(error.params)}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
