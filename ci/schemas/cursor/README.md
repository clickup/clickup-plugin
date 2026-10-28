# Vendored Cursor schemas

Copied unmodified from https://github.com/cursor/plugins `schemas/` at commit 8b3326d99fd4b993cb33a24dad8af03175c642c5.

`.github/workflows/manifest-schema-drift.yml` diffs these files against `cursor/plugins` main every week.
To update: copy the new files, change the SHA above, and run `node ci/validate-schemas.mjs`.

`ci/validate-schemas.mjs` relaxes `pluginEntry.additionalProperties` in memory. Cursor's runtime accepts extra plugin-entry fields that the schema forbids.
