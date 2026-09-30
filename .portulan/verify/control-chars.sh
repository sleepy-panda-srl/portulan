#!/usr/bin/env bash
# Portulan workspace — verify recipe: no file in the tree carries a control byte other than TAB and LF.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname git mktemp node rm; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# node exits 1 on a missing script, which would read as a red verdict.
[ -f cli/control-chars.mjs ] || {
    printf 'verify: cli/control-chars.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# Binary paths, named: a content sniff keys on NUL, the very byte this check exists to find.
EXEMPT=()

# bash 3.2 aborts expanding an empty array under set -u; the inner quotes keep each element one word.
flags=()
for p in ${EXEMPT[@]+"${EXEMPT[@]}"}; do
    flags+=(--exempt "$p")
done

tmp=$(mktemp -d) || exit 2
trap 'rm -rf -- "$tmp"' EXIT

manifest="$tmp/manifest"
# -z: git C-quotes a control byte in a path even under core.quotePath=false.
if ! git ls-files --cached --others --exclude-standard -z >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree\n' >&2
    exit 2
fi

printf 'chars: scanning every tracked file, plus every new and not-ignored one, for control characters outside TAB and LF\n'

node cli/control-chars.mjs ${flags[@]+"${flags[@]}"} <"$manifest"
status=$?

case "$status" in
    0) printf '\nGREEN — verify recipe passed.\n'; exit 0 ;;
    1) printf '\nRED — verify recipe failed; "done" is blocked.\n'; exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: control-chars exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
