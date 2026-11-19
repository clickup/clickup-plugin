// node --test ci/   Runs the checks on the repo's real manifests, then on each fixture in ci/fixtures.
// A fixture is { description, expect: "pass" | "fail", error?, quirk?, patch }. The patch is a JSON merge patch (RFC 7386)
// over the repo's manifests, by path: null deletes a file, a string is the raw file text, an object merges.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { MANIFEST_PATHS, validate } from "./validate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf-8"));

const mergePatch = (target, patch) => {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const base = target !== null && typeof target === "object" && !Array.isArray(target) ? target : {};
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete out[key];
    else out[key] = mergePatch(base[key], value);
  }
  return out;
};

const withFixture = (patch, run) => {
  const dir = mkdtempSync(join(tmpdir(), "manifests-"));
  try {
    for (const path of MANIFEST_PATHS.filter((p) => existsSync(join(repo, p)))) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      cpSync(join(repo, path), join(dir, path));
    }
    for (const [path, change] of Object.entries(patch)) {
      const file = join(dir, path);
      if (change === null) rmSync(file, { force: true });
      else {
        mkdirSync(dirname(file), { recursive: true });
        const text = typeof change === "string" ? change : JSON.stringify(mergePatch(existsSync(file) ? readJson(file) : {}, change), null, 2);
        writeFileSync(file, text);
      }
    }
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("the repo's real manifests pass", () => {
  assert.deepEqual(validate(repo), []);
});

test("each vendored schema matches its sha256 in sources.json", () => {
  const sources = readJson(join(here, "schemas/sources.json"));
  for (const [file, { sha256 }] of Object.entries(sources)) {
    assert.equal(createHash("sha256").update(readFileSync(join(here, "schemas", file))).digest("hex"), sha256, file);
  }
});

const fixtureDir = join(here, "fixtures");
const fixtures = readdirSync(fixtureDir).filter((f) => f.endsWith(".json")).sort();

for (const file of fixtures) {
  const { description, expect, error, quirk, patch } = readJson(join(fixtureDir, file));
  test(`${file}: ${description} -> ${expect}`, () => {
    const problems = withFixture(patch, (dir) => validate(dir));
    if (expect === "pass") assert.deepEqual(problems, []);
    else assert.ok(problems.some((p) => p.includes(error)), `want "${error}" in:\n${problems.join("\n")}`);
    // Positive control: a quirk fixture passes without the quirks, so the quirk rule alone makes it fail.
    if (quirk) assert.deepEqual(withFixture(patch, (dir) => validate(dir, { quirks: false })), [], `${file} fails without quirks`);
  });
}

test("every quirk has a failing fixture", () => {
  const quirks = readJson(join(here, "schemas/quirks.schema.json")).allOf.map((q) => q.title);
  const covered = fixtures.map((f) => readJson(join(fixtureDir, f))).filter((f) => f.expect === "fail").map((f) => f.quirk);
  for (const id of quirks) assert.ok(covered.includes(id), `quirk ${id} has no failing fixture`);
});
