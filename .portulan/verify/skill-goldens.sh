#!/usr/bin/env bash
# Portulan workspace — verify recipe: every core skill's mandates are accounted for, and each binding holds.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

for required in cli/skill-goldens.mjs cli/doctor.mjs core/skills .portulan/workspace.json; do
    if [ ! -e "$required" ]; then
        printf 'verify: %s is missing — cannot grade the core-skill corpus\n' "$required" >&2
        exit 2
    fi
done

if [ ! -d evals/goldens/skills ]; then
    printf 'verify: evals/goldens/skills/ is missing — the corpus is what this recipe grades\n' >&2
    exit 2
fi

printf 'skill-goldens: grading evals/goldens/skills/ against core/skills/ and the live artifacts the declared slots hold\n'

node cli/skill-goldens.mjs --repo-root . --workspace .portulan
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: skill-goldens exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
