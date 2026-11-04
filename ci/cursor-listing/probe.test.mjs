// Fixture-driven test of the listing parser. Run: node --test ci/cursor-listing/
// listing-ok.html holds the clickup entry split across two flight chunks, plus a published and approved
// decoy plugin and a "clickup" fork with another repositoryUrl. Mutated copies are the positive controls:
// each one must fail the probe, and the decoys must not rescue it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractClickupEntry, assertListing } from "./probe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(join(here, "fixtures", "listing-ok.html"), "utf-8");

// The clickup entry is the first object in the fixture, so the first match is the clickup field.
const mutate = (from, to) => {
  assert.ok(fixture.includes(from), `fixture lacks ${from}`);
  return fixture.replace(from, to);
};

test("the unmodified fixture passes", () => {
  const entry = extractClickupEntry(fixture);
  assert.equal(entry?.id, "5069");
  assert.deepEqual(assertListing(entry), []);
});

test("the entry is scoped to clickup, not the first isPublished on the page", () => {
  const entry = extractClickupEntry(fixture);
  assert.equal(entry.repositoryUrl, "https://github.com/clickup/clickup-plugin");
  assert.equal(entry.gitRef, "1f40631e03a8d3b393ad67a39eaae599fe9669c9");
});

const mutations = [
  { name: "status not approved", from: '\\"status\\":\\"PLUGIN_STATUS_APPROVED\\"', to: '\\"status\\":\\"PLUGIN_STATUS_PENDING\\"', message: "status" },
  { name: "not published", from: '\\"isPublished\\":true', to: '\\"isPublished\\":false', message: "isPublished" },
  { name: "wrong gitPath", from: '\\"gitPath\\":\\".\\"', to: '\\"gitPath\\":\\"plugins/clickup\\"', message: "gitPath" },
];
for (const { name, from, to, message } of mutations) {
  test(`positive control: ${name} fails`, () => {
    const failures = assertListing(extractClickupEntry(mutate(from, to)));
    assert.equal(failures.length, 1);
    assert.match(failures[0], new RegExp(message));
  });
}

test("positive control: clickup entry removed fails even with approved decoys", () => {
  const failures = assertListing(extractClickupEntry(mutate('\\"name\\":\\"clickup\\",\\"displayName\\":\\"ClickUp\\"', '\\"name\\":\\"gone\\",\\"displayName\\":\\"ClickUp\\"')));
  assert.match(failures[0], /no plugin entry/);
});

test("CLI exit codes: ok fixture exits 0, mutated payload exits 1", async () => {
  const { writeFile, mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "listing-"));
  const bad = join(dir, "bad.html");
  await writeFile(bad, mutate('\\"isPublished\\":true', '\\"isPublished\\":false'));
  const probe = join(here, "probe.mjs");
  const ok = spawnSync(process.execPath, [probe, "--file", join(here, "fixtures", "listing-ok.html")], { encoding: "utf-8" });
  const fail = spawnSync(process.execPath, [probe, "--file", bad], { encoding: "utf-8" });
  assert.equal(ok.status, 0);
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /FAIL isPublished is false, want true/);
});

test("the workflow sets shell: bash, so a pipe to tee keeps the probe exit code", async () => {
  const { writeFile, mkdtemp, readFile: read } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const workflow = await read(join(here, "..", "..", ".github", "workflows", "cursor-listing.yml"), "utf-8");
  assert.match(workflow, /defaults:\s*\n\s+run:\s*\n\s+shell: bash\b/);
  // GitHub runs `shell: bash` as `bash --noprofile --norc -eo pipefail {0}`. Same pipe as the listing step.
  const dir = await mkdtemp(join(tmpdir(), "listing-"));
  const bad = join(dir, "bad.html");
  await writeFile(bad, mutate('\\"isPublished\\":true', '\\"isPublished\\":false'));
  const probe = join(here, "probe.mjs");
  const run = (flags) => spawnSync("bash", ["--noprofile", "--norc", ...flags, "-c", `node "${probe}" --file "${bad}" | tee /dev/null`], { encoding: "utf-8" });
  assert.equal(run(["-eo", "pipefail"]).status, 1, "with pipefail the step must fail");
  assert.equal(run(["-e"]).status, 0, "control: bash -e alone hides the failure, which is why pipefail is needed");
});
