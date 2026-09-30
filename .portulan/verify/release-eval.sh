#!/usr/bin/env bash
# Portulan workspace — verify recipe: every governed release carries an eval result that matches its capture.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in cut dirname mktemp node rm tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

for required in cli/release-eval.mjs CHANGELOG.md package.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot grade the release records\n' "$required" >&2
        exit 2
    fi
done

# Imported before it runs, as node exits 1 on a parse error; via the environment, so its entry guard stays off.
probe=$(mktemp) || exit 2
if ! PORTULAN_RELEASE_EVAL_MODULE="$root/cli/release-eval.mjs" \
    node --input-type=module -e 'await import(process.env.PORTULAN_RELEASE_EVAL_MODULE);' 2>"$probe"; then
    printf 'verify: cli/release-eval.mjs could not be loaded — %s\n' "$(tr '\n' ' ' <"$probe" | cut -c1-300)" >&2
    rm -f -- "$probe"
    exit 2
fi
rm -f -- "$probe"

printf 'release-eval: checking that every release from milestone 8 onward carries an eval result that agrees with its capture\n'

node cli/release-eval.mjs --verify --repo-root .
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: release-eval exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
