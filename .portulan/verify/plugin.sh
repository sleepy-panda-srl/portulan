#!/usr/bin/env bash
# Portulan workspace — verify recipe: the plugins validate and declare every composed pack's skills.
#
# Not Claude Code's plugin contract: `claude plugin validate --strict` checks that; neither covers the other.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname git node sed sort tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

[ -f cli/plugin-lint.mjs ] || {
    printf 'verify: cli/plugin-lint.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

PLUGIN_ROOTS=(.)
PAYLOAD_ROOTS=(packs)

if [ "${#PLUGIN_ROOTS[@]}" -eq 0 ]; then
    printf 'verify: PLUGIN_ROOTS is empty — this recipe would validate nothing\n' >&2
    exit 2
fi

# On bash 3.2, `set -u` makes expanding an empty array an error, which the audit below would misreport.
if [ "${#PAYLOAD_ROOTS[@]}" -eq 0 ]; then
    printf 'verify: PAYLOAD_ROOTS is empty — remove the second invocation rather than passing nothing\n' >&2
    exit 2
fi

# Git's default pathspec `*` crosses `/`, so this finds a manifest at any depth; `:(glob)` would stop that.
if ! manifests=$(git -c core.quotePath=false ls-files --cached --others --exclude-standard \
    -- '.claude-plugin/plugin.json' '*/.claude-plugin/plugin.json'); then
    printf 'verify: git ls-files failed — cannot audit the plugin-root list\n' >&2
    exit 2
fi

present=$(printf '%s\n' "$manifests" | sed -e 's|/\{0,1\}\.claude-plugin/plugin\.json$||' -e 's|^$|.|' | sort -u)
named=$(printf '%s\n' "${PLUGIN_ROOTS[@]}" "${PAYLOAD_ROOTS[@]}" | sort -u)

if [ "$present" != "$named" ]; then
    printf 'verify: the plugin roots this recipe validates are not the plugin roots in the tree.\n' >&2
    printf '  validated : %s\n' "$(printf '%s' "$named" | tr '\n' ' ')" >&2
    printf '  in tree   : %s\n' "$(printf '%s' "$present" | tr '\n' ' ')" >&2
    printf 'Add the missing plugin root to the list it belongs in — PLUGIN_ROOTS for a root that\n' >&2
    printf 'carries its own marketplace.json, PAYLOAD_ROOTS for one a feed publishes — or remove the\n' >&2
    printf 'stale entry.\n' >&2
    exit 2
fi

status=0
node cli/plugin-lint.mjs "${PLUGIN_ROOTS[@]}"
case $? in
    0) ;;
    2) exit 2 ;;
    *) status=1 ;;
esac
node cli/plugin-lint.mjs --payload "${PAYLOAD_ROOTS[@]}"
case $? in
    0) ;;
    2) exit 2 ;;
    *) status=1 ;;
esac

# A payload root ships packs and composes none, so only PLUGIN_ROOTS are asked.
[ -f cli/skills-set.mjs ] || {
    printf 'verify: cli/skills-set.mjs not found — this recipe cannot run\n' >&2
    exit 2
}
for root in "${PLUGIN_ROOTS[@]}"; do
    node cli/skills-set.mjs --workspace .portulan --repo-root . --pack-root packs --plugin-root "$root" --check
    case $? in
        0) ;;
        2) exit 2 ;;
        *) status=1 ;;
    esac
done
exit "$status"
