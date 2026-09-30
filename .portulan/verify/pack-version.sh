#!/usr/bin/env bash
# Portulan workspace — verify recipe: a change to a pack's `contributes` moves its `portulan.version`.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname git node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

base=${PORTULAN_BASE_REF:-origin/main}

# A base starting with `-` would read as a flag; `--` would make rev-parse read it as a path.
if ! git rev-parse --verify --end-of-options "${base}^{commit}" >/dev/null 2>&1; then
    printf 'verify: base ref %s is not in this repository — cannot ask what this change did.\n' "$base" >&2
    printf '        A shallow single-branch clone never fetches it. Set fetch-depth: 0, or name another\n' >&2
    printf '        base with PORTULAN_BASE_REF. Refusing to report green having compared nothing.\n' >&2
    exit 2
fi
if ! git merge-base --end-of-options "$base" HEAD >/dev/null 2>&1; then
    printf 'verify: no merge-base between %s and HEAD — the ref resolved but its history did not.\n' "$base" >&2
    printf '        This is a shallow clone, or genuinely unrelated histories. Set fetch-depth: 0.\n' >&2
    exit 2
fi

[ -f cli/pack-version.mjs ] || {
    printf 'verify: cli/pack-version.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

node cli/pack-version.mjs --base "$base"
code=$?

case "$code" in
    0) printf 'GREEN — verify recipe passed.\n' ;;
    1) printf 'RED — verify recipe failed; "done" is blocked.\n' ;;
    *) printf 'verify: pack-version could not run (exit %s)\n' "$code" >&2 ;;
esac
exit "$code"
