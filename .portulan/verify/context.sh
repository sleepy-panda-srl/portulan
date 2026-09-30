#!/usr/bin/env bash
# Portulan workspace — verify recipe: what a boot reads and the host loads, measured, with Portulan's own footprint railed.
#
# A rail is its figure plus 2%, rounded up. A demotion lowers its line; a raise writes its reason there,
# and never comes in a change the rail refused.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname git grep mkdir mktemp node rm sed sort tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# node exits 1 on a missing script, which would read as a red verdict.
[ -f cli/context.mjs ] || {
    printf 'verify: cli/context.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# The rails, one line each, in bytes.
RAIL_OWN_BOOT=15893       # .portulan's boot read-set, 15,581 B: the skill, and the boot card with its two
                          # imports; the card carries every rule on reading and the cache, the one on
                          # comments included
RAIL_DEMO_BOOT=36975      # examples' boot read-set with the combcount card, 36,250 B: with no card loaded, a
                          # boot reads the skill, which routes, and then its steps
RAIL_ENGINE=12936         # the boot skill, its steps and the kernel, 12,682 B
RAIL_STEPS=10944          # the skill's step files, pointer-manifest.md and packs.md, 10,729 B
RAIL_DESCRIPTIONS=3454    # the plugin's 7 skill and 3 agent descriptions, 3,386 B; 3,405 B since the boot
                          # card, whose skill description now names the card
RAIL_ADOPTER_BOOT=8208    # a consumer `init` drafts, 8,047 B: the skill, the plugin's kernel, and the card
                          # `init` compiles, with the identity it imports; the card carries every rule on
                          # reading and the cache, the one on comments included, since a consumer is owed them

WORKSPACES=(.portulan examples)
FIXTURE_PREFIX="cli/fixtures/"
if ! manifests=$(git -c core.quotePath=false ls-files --cached --others --exclude-standard -- 'workspace.json' '*/workspace.json'); then
    printf 'verify: git ls-files failed — cannot audit the workspace list\n' >&2
    exit 2
fi
present=$(printf '%s\n' "$manifests" | grep -v "^${FIXTURE_PREFIX}" | sed 's|/workspace\.json$||' | sort -u)
named=$(printf '%s\n' "${WORKSPACES[@]}" | sort -u)
if [ "$present" != "$named" ]; then
    printf 'verify: the workspaces this recipe measures are not the workspaces in the tree.\n' >&2
    printf '  measured : %s\n' "$(printf '%s' "$named" | tr '\n' ' ')" >&2
    printf '  in tree  : %s\n' "$(printf '%s' "$present" | tr '\n' ' ')" >&2
    printf 'Add the missing workspace to WORKSPACES and a run below, with its rail, or remove the stale entry.\n' >&2
    exit 2
fi

node cli/context.mjs --workspace .portulan \
    --rail "boot=$RAIL_OWN_BOOT" --rail "engine=$RAIL_ENGINE" --rail "steps=$RAIL_STEPS" \
    --rail "descriptions=$RAIL_DESCRIPTIONS"
own=$?
printf '\n'
# The demo has no repository of its own, so its card is named.
node cli/context.mjs --workspace examples --repo combcount --rail "boot=$RAIL_DEMO_BOOT"
demo=$?
printf '\n'

drafts=$(mktemp -d) || {
    printf 'verify: mktemp could not make a directory to draft a consumer in\n' >&2
    exit 2
}
trap 'rm -rf -- "$drafts"' EXIT
# A fixed name, since `init` writes it into the identity whose bytes are railed.
mkdir -- "$drafts/consumer" || exit 2
if ! drafted=$(node cli/init.mjs --residence in-repo --no-interview --pack-root packs "$drafts/consumer" 2>&1); then
    printf 'verify: init could not draft the consumer this recipe measures:\n%s\n' "$drafted" >&2
    exit 2
fi
node cli/context.mjs --workspace "$drafts/consumer/.portulan" --rail "boot=$RAIL_ADOPTER_BOOT"
adopter=$?

# Could-not-run outranks red: a run that judged nothing cannot vouch for the one that did.
worst=0
for status in "$own" "$demo" "$adopter"; do
    case "$status" in
        0) ;;
        1) [ "$worst" -eq 0 ] && worst=1 ;;
        2) worst=2 ;;
        *)
            printf 'verify: context exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
            exit 2
            ;;
    esac
done

case "$worst" in
    0) printf '\nGREEN — verify recipe passed.\n'; exit 0 ;;
    1) printf '\nRED — verify recipe failed; "done" is blocked.\n'; exit 1 ;;
    *) exit 2 ;;
esac
