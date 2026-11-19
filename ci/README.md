# Manifest checks

`ci/validate.mjs` checks the plugin manifests with ajv against JSON Schemas pinned in `ci/schemas/`. It needs no network.
`node --test ci/validate.test.mjs` runs the real manifests and the fixtures in `ci/fixtures/`.

## What runs

The `Manifest checks` workflow runs on every pull request and on pushes to `main`:

1. `node ci/validate.mjs`: one `FAIL <path> [<schema>] <where> <message>` line per problem, or `PASS`.
2. `node --test ci/validate.test.mjs`: the repo's manifests, each vendored schema against its sha256, and every fixture.
3. `claude plugin validate . --strict`: Claude Code's own check of `.claude-plugin/*`, `.mcp.json` and the skills.

The `Schema drift` workflow is not a PR check. On weekdays at 06:00 UTC it compares each pinned schema with upstream
(`ci/schema-drift.sh --report`) and opens or updates one issue per changed file. It never blocks a PR.

Run locally: `npm ci --prefix ci && node ci/validate.mjs && node --test ci/validate.test.mjs`.

## Path to schemas

Each manifest is checked against every schema of a client that reads it. Cursor reads the first file that exists:
`.cursor-plugin/plugin.json`, `.claude-plugin/plugin.json`, `plugin.json`, and `.cursor-plugin/marketplace.json`,
`.claude-plugin/marketplace.json`. So a `.claude-plugin` file must pass the Cursor schemas when no `.cursor-plugin`
file shadows it.

| Path | Schemas |
|---|---|
| `.cursor-plugin/plugin.json` | `cursor-plugin` |
| `.cursor-plugin/marketplace.json` | `cursor-marketplace`, `quirks` |
| `.claude-plugin/plugin.json` (required) | `claude plugin validate`; `cursor-plugin` when `.cursor-plugin/plugin.json` is missing |
| `.claude-plugin/marketplace.json` (required) | `claude plugin validate`; `cursor-marketplace`, `quirks` when `.cursor-plugin/marketplace.json` is missing |
| `plugin.json` | `agent-plugin`; `cursor-plugin` when both files above are missing |
| `mcp.json` | `agent-mcp` |
| `.antigravity-plugin/plugin.json`, `.mcp.json`, `mcp_config.json` | none published: they must parse |

Checks no schema can state: every file parses, `name` and `version` are the same in every manifest and marketplace
entry, and a relative Cursor `source` names a directory with a plugin manifest.

## Quirks

`schemas/quirks.schema.json` holds runtime rules that no published schema states. Each rule is one `allOf` entry with a
`title` (its id) and a `description`. Today: `cursor-source-relative`.

Add a quirk:
1. Add an `allOf` entry to `quirks.schema.json` with a `title` and a `description`.
2. Add a fixture with `"quirk": "<id>"` and `"expect": "fail"`. The test also runs it without the quirks and wants a pass,
   so the quirk alone makes it fail.

One published schema is stricter than the runtime: Cursor accepts `version` and `homepage` on a marketplace entry.
`relaxCursorMarketplace` in `validate.mjs` allows both. It is the only place that loosens a pinned schema.

## Fixtures

A fixture is a JSON file `{ description, expect, error?, quirk?, patch }`. The `patch` is a JSON merge patch over the
repo's manifests, by path: `null` deletes a file, a string replaces its text, an object merges. A `fail` fixture needs
`error`, a text that must appear in a problem line.

## Update a pinned schema

1. Download it: `curl -fsSL <upstream URL from schemas/sources.json> -o ci/schemas/<file>`.
2. Put `shasum -a 256 ci/schemas/<file>` and the new URL, if it changed, in `ci/schemas/sources.json`.
3. Run `node ci/validate.mjs && node --test ci/validate.test.mjs`. Fix the manifests or the quirks the new schema breaks.

Agent Plugins files were fetched on 2026-11-17. Cursor files on 2026-11-19 from `cursor/plugins` commit `e58dd04`.
`.antigravity-plugin/plugin.json` has no published schema that we know of.
