#!/usr/bin/env bash
# Portulan workspace — verify recipe: no more comment lines record a change's history than LIMIT, and
# the tree's comments weigh no more than BYTES.
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

[ -f cli/comments.mjs ] || {
    printf 'verify: cli/comments.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# LIMIT is only ever lowered, to the count a change leaves. BYTES rails every comment byte at the figure
# plus 2%, as ./context.sh rails a boot: lowered when comments are cut, raised only with its reason here.
LIMIT=1800
BYTES=2448404             # 2,400,396 B

node cli/comments.mjs --limit "$LIMIT" --bytes "$BYTES"
status=$?

case "$status" in
    0) printf '\nGREEN — verify recipe passed.\n'; exit 0 ;;
    1) printf '\nRED — verify recipe failed; "done" is blocked.\n'; exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: comments exited %s, which is not a verdict it documents\n' "$status" >&2
        exit 2
        ;;
esac
