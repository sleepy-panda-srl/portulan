#!/usr/bin/env bash
#
# verify: a reduced rule stays reduced.
#
# Proposal `.portulan/proposals/0027-a-reduced-rule-stays-reduced.md`. A rule an incident has reduced
# to ONE carrier is registered in `.portulan/rule-carriers.json` with the spellings its other carriers
# used; those spellings may then appear only in the carrier, or beside a citation of it.
#
# This wrapper is thin ON PURPOSE, in the shape `index.sh` and `control-chars.sh` already set: the
# things that can be subtly wrong live in ../../cli/rule-carriers.mjs, which the suite covers. What
# stays here is the part a suite cannot cover — the dependency guard, the enumeration precondition,
# and exit-code passthrough, which are the three things every recipe in this directory has had a
# defect in.
#
# Exit 0 clean · 1 a registered rule is restated without a citation · 2 could not run.
#
# WHAT THIS DOES NOT DO, because a recipe that overclaims is worse than none: it covers only the rules
# the registry lists. Every unregistered rule in this repository is uncovered and nothing can audit
# that — a rule has no token, which is proposal 0020's theorem and is untouched by this.

set -uo pipefail

for need in git node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The instrument's presence is a precondition rather than a red, the same argument index.sh makes:
# `node` on a missing file exits 1, and passing that through would report "a rule is restated" about a
# tree nothing had read.
[ -f cli/rule-carriers.mjs ] || {
    printf 'verify: cli/rule-carriers.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

REGISTRY=".portulan/rule-carriers.json"
[ -f "$REGISTRY" ] || {
    printf 'verify: %s not found — this recipe cannot run\n' "$REGISTRY" >&2
    exit 2
}

# Enumerating the tree is a precondition exactly as it is inside every other recipe here — see
# ../memory/verify-preconditions-fail-closed.md. A `git ls-files` that fails must never become an
# empty list and a green over nothing; the instrument refuses an empty list for the same reason, so
# this is belt and braces rather than the only guard.
manifest=$(mktemp) || exit 2
trap 'rm -f "$manifest"' EXIT

if ! git ls-files --cached --others --exclude-standard -z >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree to scan\n' >&2
    exit 2
fi

if [ ! -s "$manifest" ]; then
    printf 'verify: the tracked set is empty — refusing to report green over nothing\n' >&2
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
