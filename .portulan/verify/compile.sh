#!/usr/bin/env bash
# Compare repository settings/bindings and portable guidance.
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

for required in cli/compile.mjs .portulan/gates.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot judge whether the enforcement matches the policy\n' "$required" >&2
        exit 2
    fi
done

printf 'compile: checking repository settings/bindings and portable guidance exemplars\n'

# Pin root enforcement; compare exemplars through guidance-only compilation.
worst=0
for workspace in . cli/fixtures/guidance cli/fixtures/nested-guidance; do
    if [ "$workspace" = . ]; then
        node cli/compile.mjs --workspace "$workspace" --pack-root packs --check
    else
        node -e 'import("./cli/compile.mjs").then(({compileGuidance}) => { const r = compileGuidance(process.argv[1], {check:true}); process.exitCode = r.declared ? (r.drifted ? 1 : 0) : 2; }).catch(e => { console.error(e.message); process.exitCode = 2; });' "$workspace"
    fi
    status=$?
    case "$status" in
        0) ;;
        1) [ "$worst" -eq 0 ] && worst=1 ;;
        2) worst=2 ;;
        *)
            printf 'verify: compile exited %s, which is not a verdict it documents\n' "$status" >&2
            exit 2
            ;;
    esac
done
exit "$worst"
