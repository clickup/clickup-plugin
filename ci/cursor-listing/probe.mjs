// Checks that the ClickUp plugin is live on the Cursor marketplace.
// Usage: node ci/cursor-listing/probe.mjs [--file page.html] [--main-ref origin/main]
//   Without --file it fetches https://cursor.com/marketplace/clickup.
// Exit 0 when the clickup entry has status PLUGIN_STATUS_APPROVED, isPublished true and gitPath ".".
// Exit 1 with one FAIL line per assertion miss. gitRef, updatedAt and commits-behind-main are info only.
//
// The page is a Next.js page. Its data sits in self.__next_f.push([1,"..."]) script chunks.
// The page embeds about 40 plugins, so the entry is picked by name and repositoryUrl, never by the first isPublished.
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const LISTING_URL = "https://cursor.com/marketplace/clickup";
export const REPOSITORY_URL = "https://github.com/clickup/clickup-plugin";
export const EXPECTED = { status: "PLUGIN_STATUS_APPROVED", isPublished: true, gitPath: "." };

// Joins the string payload of every self.__next_f.push([1,"..."]) chunk. Chunks can split an object.
export function flightText(html) {
  let text = "";
  for (const match of html.matchAll(/self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)/g)) {
    try {
      text += JSON.parse(match[1])[1];
    } catch {
      // A chunk that does not parse cannot hold the entry; skip it.
    }
  }
  return text;
}

// Returns the JSON object text that starts at text[start] === "{", or null. Respects strings and escapes.
function balancedObject(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

// Finds the plugin object with name "clickup" and our repositoryUrl. Returns null when there is none.
export function extractClickupEntry(html) {
  const text = flightText(html);
  for (const match of text.matchAll(/\{"id":"\d+","name":"clickup"/g)) {
    const raw = balancedObject(text, match.index);
    if (!raw) continue;
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      continue;
    }
    if (entry.repositoryUrl === REPOSITORY_URL) return entry;
  }
  return null;
}

export function assertListing(entry) {
  if (!entry) return [`no plugin entry with name "clickup" and repositoryUrl ${REPOSITORY_URL} on the page`];
  const failures = [];
  for (const [field, want] of Object.entries(EXPECTED)) {
    if (entry[field] !== want) failures.push(`${field} is ${JSON.stringify(entry[field])}, want ${JSON.stringify(want)}`);
  }
  return failures;
}

export function commitsBehind(gitRef, mainRef) {
  const run = spawnSync("git", ["rev-list", "--count", `${gitRef}..${mainRef}`], { encoding: "utf-8" });
  return run.status === 0 ? run.stdout.trim() : null;
}

async function fetchPage(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "clickup-plugin-listing-probe" }, signal: AbortSignal.timeout(30_000) });
      if (response.ok) return await response.text();
      lastError = new Error(`GET ${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function main(argv) {
  const option = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const file = option("--file");
  const mainRef = option("--main-ref") ?? "origin/main";
  const html = file ? await readFile(file, "utf-8") : await fetchPage(LISTING_URL);
  const entry = extractClickupEntry(html);
  const failures = assertListing(entry);
  if (entry) {
    const updated = Number.isFinite(Number(entry.updatedAt)) ? new Date(Number(entry.updatedAt)).toISOString() : "unknown";
    const behind = typeof entry.gitRef === "string" ? commitsBehind(entry.gitRef, mainRef) : null;
    console.log(`info gitRef=${entry.gitRef} updatedAt=${updated}`);
    console.log(`info commits behind ${mainRef}: ${behind ?? "unknown (gitRef or ref not in this clone)"}`);
    console.log(`info status=${entry.status} isPublished=${entry.isPublished} gitPath=${JSON.stringify(entry.gitPath)}`);
  }
  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length === 0) console.log("OK Cursor marketplace listing for clickup is live");
  return failures.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)).catch((error) => {
    console.error(`FAIL could not read the listing: ${error.message}`);
    return 1;
  }));
}
