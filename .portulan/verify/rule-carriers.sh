#!/usr/bin/env bash
# Portulan workspace — verify recipe: a registered rule is restated outside its carrier only beside a citation.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in git node dirname mktemp rm; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

[ -f cli/rule-carriers.mjs ] || {
    printf 'verify: cli/rule-carriers.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

REGISTRY=".portulan/rule-carriers.json"
[ -f "$REGISTRY" ] || {
    printf 'verify: %s not found — this recipe cannot run\n' "$REGISTRY" >&2
    exit 2
}

manifest=$(mktemp) || exit 2
trap 'rm -f "$manifest"' EXIT

if ! git ls-files --cached --others --exclude-standard -z >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree to scan\n' >&2
    exit 2
fi

if [ ! -s "$manifest" ]; then
    printf 'verify: the file list is empty — refusing to report green over nothing\n' >&2
    exit 2
fi

node cli/rule-carriers.mjs --registry "$REGISTRY" <"$manifest"
status=$?

case "$status" in
    0) printf 'GREEN — verify recipe passed.\n' ;;
    1) printf '\nRED — verify recipe failed; "done" is blocked.\n' ;;
    2) printf '\nCOULD NOT RUN — the registry or its audit refused; this is not a pass.\n' >&2 ;;
    *)
        printf 'verify: rule-carriers exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac

exit "$status"
