// Runs ci/cursor-resolve.mjs against each fixture and checks exit code and reason.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cases = [
  { name: "good", exitCode: 0, reason: null },
  { name: "bad", exitCode: 1, reason: "unresolved or unsafe source path" },
  { name: "bad-plugin-root", exitCode: 1, reason: "${PLUGIN_ROOT}" },
];

let failed = 0;
for (const { name, exitCode, reason } of cases) {
  const run = spawnSync(
    process.execPath,
    [join(here, "cursor-resolve.mjs"), join(here, "fixtures", name)],
    { encoding: "utf-8" },
  );
  const output = `${run.stdout}${run.stderr}`;
  const problems = [];
  if (run.status !== exitCode) problems.push(`exit ${run.status}, want ${exitCode}`);
  if (reason && !output.includes(reason)) problems.push(`missing reason "${reason}"`);
  if (problems.length > 0) {
    failed += 1;
    console.error(`FAIL ${name}: ${problems.join("; ")}\n${output}`);
  } else {
    console.log(`PASS ${name}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
