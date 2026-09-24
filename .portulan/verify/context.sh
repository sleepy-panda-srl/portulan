#!/usr/bin/env bash
# Portulan workspace — verify recipe: what a boot reads and what the host loads, measured, with
# Portulan's own footprint railed. (Proposal 0036, items 3 and 6 of its order of work.)
#
# Two checks, over both workspaces in this tree and a consumer `init` drafts:
#   measure  every file a boot reads in full, and every file Claude Code loads into every context
#            here, printed with its size and why it counts — ../../cli/context.mjs, which is the
#            module an adopter runs, since what it reads is the manifest and not this repository
#   rails    Portulan's own footprint does not grow past the figures below
#
# ## Why the rails are here and not in a manifest
#
# 0036's rule 3: Portulan budgets its own contribution to every context by default, because it owns
# it, and the default is a rail in THIS repository rather than a budget in any adopter's manifest —
# so rule 2's "never defaulted" holds for the adopter. That contribution is the boot skill and the
# kernel, which every adopter's boot reads, the skill's step files, which a boot reads where its
# manifest is a pointer or names a pack, and the plugin's skill and agent descriptions, which every
# session with the plugin enabled loads. This workspace's own read-set and the demo's are railed
# beside them because they are the figures the day's demotions moved, and nothing else stops a later
# change quietly undoing one.
#
# ## How a rail is set, lowered and raised
#
# Each is the figure measured on the tree this recipe landed in, main at a534f15 with this change's own
# recipe entry in the manifest, plus 2%, rounded up (railFor in ../../cli/context.mjs), unless its line
# names the change that moved it since, on that change's own figure.
# At exactly today's figure every added byte in a file a boot reads would be red, and the memory index
# alone is 37 of its 40 lines. The report says when a rail's headroom passes 5%, and gives the figure
# to lower it to. **A change that demotes lowers its line here, in the same pull request**, or the gain
# is not locked in. A rail is raised only with the reason written on its line and in the commit of the
# change that raises it, and never in a change the rail refused — the repair for a breach is demotion, merge or
# retirement, as it is for memory's budgets (../../core/operating/memory.md).
#
# A boot with no card loaded reads the manifest whole at step 2, and its figure includes it; a carded
# boot, this repository's since the card, reads no manifest. The records of 2026-09-23 left it out, so
# theirs for the tree these rails were set on, 92,998 and 33,591, are the "without manifest" subtotals
# an uncarded boot prints above its total.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
for need in dirname git grep mkdir mktemp node rm sed sort tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The module's presence is a precondition, not a red: node on a missing file exits 1, which this recipe
# would otherwise report as a footprint over its rail about a tree nothing measured.
[ -f cli/context.mjs ] || {
    printf 'verify: cli/context.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# The rails, one line each, in bytes.
RAIL_OWN_BOOT=16037       # .portulan's boot read-set, 15,722 B: the skill, and the boot card with its two
                          # imports, lowered from 89,057 B by the boot card, then raised from 15,525 B by
                          # the card's line on reading code by symbol, which spends 197 B to spare reads
RAIL_DEMO_BOOT=37803      # examples' boot read-set with the combcount card, 37,061 B, raised by the boot
                          # card from 35,587 B: with no card loaded, a boot reads the skill, which routes,
                          # and then its steps
RAIL_ENGINE=13763         # the boot skill, its steps and the kernel, 13,493 B, raised by the boot card
                          # from 12,019 B for the same reason
RAIL_STEPS=10944          # the skill's step files, pointer-manifest.md and packs.md, 10,729 B
RAIL_DESCRIPTIONS=3454    # the plugin's 7 skill and 3 agent descriptions, 3,386 B; 3,405 B since the boot
                          # card, whose skill description now names the card
RAIL_ADOPTER_BOOT=8227    # a consumer `init` drafts, 8,081 B: the skill, the plugin's kernel, and the card
                          # `init` compiles, with the identity it imports; 26,759 B before `init` drafted one

# The workspaces measured, audited against the tree the way ./index.sh audits its own list: a workspace
# added and not measured would be a footprint nothing watches, reported as green.
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
# The demo is no repository of its own, so its card is named: combcount, the one the 2026-09-23 records
# measured it with.
node cli/context.mjs --workspace examples --repo combcount --rail "boot=$RAIL_DEMO_BOOT"
demo=$?
printf '\n'

# Every repository that installs Portulan boots from what `init` drafts, so that boot is railed too: a
# consumer drafted as `init` drafts one by default, into a directory of a fixed name, since the name is
# written into its identity, and measured with this bundle's skill and kernel.
drafts=$(mktemp -d) || {
    printf 'verify: mktemp could not make a directory to draft a consumer in\n' >&2
    exit 2
}
trap 'rm -rf -- "$drafts"' EXIT
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
