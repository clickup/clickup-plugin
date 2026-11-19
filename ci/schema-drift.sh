#!/usr/bin/env bash
# Compares each vendored schema with its upstream copy (the "upstream" URL in ci/schemas/sources.json).
# Usage: ci/schema-drift.sh [--report]
#   --report: for each changed file, open or update one GitHub issue "Upstream schema changed: <file>" (needs gh, GH_TOKEN).
# Output: PASS <file> | CHANGED <file> + the diff | FAIL <file> (download failed).
# Exit 1 on a failed download, and on a change without --report. A reported change exits 0: the issue is the signal.
set -euo pipefail

report=false
if [ "${1:-}" = "--report" ]; then
  report=true
fi
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

sha256() {
  if command -v sha256sum > /dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

download() {
  for attempt in 1 2 3; do
    if curl --fail --silent --show-error --location --max-time 60 --output "$2" "$1"; then
      return 0
    fi
    echo "Download attempt ${attempt} of $1 failed" >&2
    if [ "${attempt}" -lt 3 ]; then
      sleep 5
    fi
  done
  return 1
}

report_issue() {
  local file=$1 url=$2 actual=$3 recorded=$4
  local title="Upstream schema changed: ${file}"
  local body="${work}/${file}.body"
  {
    echo "The upstream copy of \`ci/schemas/${file}\` no longer matches the vendored copy."
    echo
    echo "- Upstream: ${url}"
    echo "- Upstream sha256: \`${actual}\`"
    echo "- sha256 in \`ci/schemas/sources.json\`: \`${recorded}\`"
    echo
    echo "To take the change, follow \"Update a vendored schema\" in \`ci/README.md\`."
    echo
    echo '```diff'
    head -c 50000 "${work}/${file}.diff"
    echo '```'
  } > "${body}"
  local number
  number=$(gh issue list --state open --search "\"${title}\" in:title" --json number,title \
    --jq "map(select(.title == \"${title}\")) | .[0].number // empty")
  if [ -n "${number}" ]; then
    gh issue edit "${number}" --body-file "${body}"
    echo "Updated issue #${number}: ${title}"
  else
    gh issue create --title "${title}" --body-file "${body}"
  fi
}

failed=0
changed=0
while IFS=$'\t' read -r file url recorded; do
  if ! download "${url}" "${work}/${file}"; then
    echo "FAIL ${file}: could not download ${url}"
    failed=1
    continue
  fi
  actual=$(sha256 "${work}/${file}")
  if [ "${actual}" = "${recorded}" ]; then
    echo "PASS ${file}"
    continue
  fi
  changed=1
  echo "CHANGED ${file}: upstream sha256 ${actual}, ci/schemas/sources.json has ${recorded}"
  diff -u -L "ci/schemas/${file}" -L "${url}" "${here}/schemas/${file}" "${work}/${file}" > "${work}/${file}.diff" || true
  cat "${work}/${file}.diff"
  if ${report}; then
    report_issue "${file}" "${url}" "${actual}" "${recorded}"
  fi
done < <(jq -r 'to_entries[] | [.key, (.value.upstream // .value.source), .value.sha256] | @tsv' "${here}/schemas/sources.json")

if [ "${failed}" -ne 0 ]; then
  exit 1
fi
if [ "${changed}" -ne 0 ] && ! ${report}; then
  exit 1
fi
