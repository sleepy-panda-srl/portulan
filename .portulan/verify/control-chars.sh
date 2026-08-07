#!/usr/bin/env bash
# Portulan workspace — verify recipe: no tracked file carries a control character nobody can see.
#
# One check, over every tracked file plus everything new and not ignored:
#   chars   no file carries a byte in the C0 range other than TAB and LF, nor DEL
#
# ## Why this is a recipe and not a paragraph
#
# A raw NUL shipped inside ./workflow-filters.mjs as the separator in a template literal, where the
# escape `\^@` was meant. A reviewer caught it; nothing here did — and the reason is the whole point
# (issue #68):
#
#   * `file` classified the source as *binary data*.
#   * `grep -n "identity = "` against the line that plainly contains that text exited 1 — a silent
#     false negative. **Every recipe in this directory but this one is built out of `grep`**, so the
#     one tool that would have shown it is the tool the byte silences. That is why the scan is in
#     ../../cli/control-chars.mjs and reads bytes rather than being another `grep` here.
#   * `git` rendered the diff as text only because the byte sat past its first 8000 bytes. A few
#     hundred lines earlier and a 660-line instrument would have arrived in review as `Binary files
#     differ` — a file nobody could read, in a pull request that looked complete.
#
# It reproduced twice more while being fixed, in the README paragraph describing it and in the shell
# command carrying the commit message. Three tools noticed across the incident; none was ours.
#
# ## Red, not a note
#
# An invisible byte is not a matter of taste, so it is exit 1 rather than one of `doctor`'s notes —
# that channel is for things nothing legislates, and this is now legislated. Issue #68 settles it.
#
# ## The exemption, and why there is no binary SNIFF
#
# A repository that later carries a real binary asset must not go permanently red. The escape is a
# NAMED PATH in EXEMPT below — never a content test, and never an extension pattern.
#
# A content test is refused because every binary sniff in general use is keyed on NUL, which is
# exactly the byte that motivated this check: `file` called the defective source binary, and git's own
# heuristic reads the first 8000 bytes for one. A check that skipped what those call binary would have
# skipped the single file it exists to catch — a fail-open by construction
# (../memory/a-checkers-coverage-is-measured-not-named.md). An extension allow-list is refused for the
# reason this repository always refuses one: it is a door every future file type walks through in
# silence.
#
# The list is AUDITED by the scanner three ways, each exit 2: an entry naming nothing in the list is
# stale; an entry over a file that is tracked and NOT ON DISK was never read, so the run cannot say
# whether the exemption is live; and an entry over a file carrying no control character is dead. The
# middle one was reported as *dead* until a reviewer separated them — a specific claim about a file
# nothing opened, which would send a maintainer to delete an exemption still doing its job. That is the
# allow-list defect this project has already paid for once — ../../cli/vendor.mjs, round 13 of #164,
# where a carve-out could permit a thing that was not a file.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
for need in dirname git mktemp node rm; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The scanner's own presence is a precondition, not a red. `node` on a missing file exits 1, and
# passing that through would report "a tracked file carries a control character" about a tree nothing
# had looked at — the defect a reviewer found in ./doctor.sh.
[ -f cli/control-chars.mjs ] || {
    printf 'verify: cli/control-chars.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# Paths this repository declares BINARY. **Empty, and that is the live state rather than a placeholder:
# the tree tracks no binary file at all today.** Adding one costs a line here, in a pull request where
# somebody sees it, which is the whole difference between a declaration and a sniff.
EXEMPT=()

# `${arr[@]+"${arr[@]}"}` rather than `"${arr[@]}"`: on bash 3.2 — the system bash on macOS —
# expanding an EMPTY array under `set -u` aborts mid-script, which would surface as exit 1, a red that
# judged nothing. ./index.sh guards the same trap from the other side, where an empty list is itself
# the error; here empty is the ordinary state, so it has to expand rather than fail.
flags=()
for p in ${EXEMPT[@]+"${EXEMPT[@]}"}; do
    flags+=(--exempt "$p")
done

# Tracked plus new-and-not-ignored, so a byte is caught before it is committed, not after — the same
# manifest rule ./docs.sh and ./json.sh use, for the same reason.
#
# `-z` rather than the newline-separated form those two use, and deliberately: a filename containing a
# newline would be mis-split by them, and this is the one check in the repository that must not be the
# tool that trusts an invisible byte in the input it was given to police. The scanner splits on NUL.
#
# The precondition is the same too. An unchecked failure here yields an empty list, zero files scanned,
# and a GREEN report from a recipe that examined nothing — see ./README.md, Provenance, and
# ../memory/verify-preconditions-fail-closed.md. The scanner refuses an empty list on its own account
# as well, so the fail-open is closed at both ends rather than trusted to one.
#
# Into a FILE rather than down a pipe, which is ./json.sh's shape and taken for its reason: a pipeline
# reports one status for two commands, so a `git` that died and a scanner that found nothing would be
# told apart by `pipefail`'s ordering rather than by a test anybody wrote.
tmp=$(mktemp -d) || exit 2
trap 'rm -rf -- "$tmp"' EXIT

manifest="$tmp/manifest"
if ! git ls-files --cached --others --exclude-standard -z >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree\n' >&2
    exit 2
fi

printf 'chars: scanning every tracked file for control characters outside TAB and LF\n'

node cli/control-chars.mjs ${flags[@]+"${flags[@]}"} <"$manifest"
status=$?

case "$status" in
    0) printf '\nGREEN — verify recipe passed.\n'; exit 0 ;;
    1) printf '\nRED — verify recipe failed; "done" is blocked.\n'; exit 1 ;;
    # The scanner reserves 2 for "could not judge" and so does this recipe — passed through rather than
    # translated. ./compile.sh shipped for one checkpoint missing this arm and printed "not a verdict it
    # documents" about a code the tool documents plainly: the right outcome with a false sentence.
    2) exit 2 ;;
    *)
        printf 'verify: control-chars exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
