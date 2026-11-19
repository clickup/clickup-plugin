# Manifest checks

`.github/workflows/manifest-checks.yml` runs on every PR:

1. Each manifest is validated with `ajv-cli` against the schema of the client that reads it:

   | File | Schema | Source |
   |---|---|---|
   | `plugin.json` | `schemas/plugin.schema.json` | https://agent-plugins.org/schemas/1.0.0/plugin.schema.json |
   | `mcp.json` | `schemas/mcp.schema.json` | https://agent-plugins.org/schemas/1.0.0/mcp.schema.json |
   | `.cursor-plugin/plugin.json` | `schemas/cursor-plugin.schema.json` | https://github.com/cursor/plugins/blob/e58dd043600587dbaf58ba315e7f2b38373eeb43/schemas/plugin.schema.json |
   | `.cursor-plugin/marketplace.json` | `schemas/cursor-marketplace.schema.json` and `schemas/quirks.schema.json` | https://github.com/cursor/plugins/blob/e58dd043600587dbaf58ba315e7f2b38373eeb43/schemas/marketplace.schema.json |

2. All manifests carry the same `version`.
3. `claude plugin validate . --strict` checks `.claude-plugin/`.

The schemas are pinned copies. `cursor-marketplace.schema.json` has one local change: a marketplace entry may have `version` and `homepage`, which Cursor accepts. `quirks.schema.json` holds runtime rules that no published schema states.

To update a schema, download the new upstream file over the copy and run the workflow's commands locally.
