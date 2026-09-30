#!/usr/bin/env bash
# Portulan workspace — verify recipe: the telemetry payload matches its snapshot; no recipe reaches the network.
#
# It cannot see a network mode reached through another script, or through a flag built at runtime.
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

for required in cli/telemetry.mjs evals/telemetry/config.json evals/telemetry/review-loop.otlp.json evals/review-loop/snapshot.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the telemetry payload against its snapshot\n' "$required" >&2
        exit 2
    fi
done

status=0

printf 'telemetry: regenerating evals/telemetry/review-loop.otlp.json and comparing byte for byte\n'
# `--check` uses no pack root; cli/pinned-roots.live.test.mjs still wants one named on this line.
node cli/telemetry.mjs --config evals/telemetry/config.json --repo-root . --pack-root packs --check evals/telemetry/review-loop.otlp.json
golden=$?

printf 'telemetry: auditing every recipe the workspace yields for a reachable network mode\n'
node cli/telemetry.mjs --audit-recipes --workspace .portulan --repo-root . --pack-root packs
offline=$?

for code in "$golden" "$offline"; do
    case "$code" in
        0) ;;
        1) [ "$status" -eq 2 ] || status=1 ;;
        2) status=2 ;;
        *)
            printf 'verify: telemetry exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$code" >&2
            status=2
            ;;
    esac
done

exit "$status"
