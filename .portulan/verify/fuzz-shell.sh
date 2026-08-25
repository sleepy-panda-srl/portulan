#!/usr/bin/env bash
# Portulan workspace — verify recipe: both shell segmenters answer one grammar, one way.
#
# One check:
#   fuzz-shell   a gated force-push and two shapes of constitution write are generated in every
#                position ../../cli/fuzz-shell.mjs's grammar knows, in many spellings each, and both
#                segmenters are held to the answer recorded for that position.
#
# Milestone 8, clause (b), second half: *grammar-aware fuzzing over the shell segmenter.* The argument
# for the clause is in ../../docs/milestones/m08.md and the mechanism is in ../../cli/fuzz-shell.mjs;
# what belongs here is why the recipe exists at all.
#
# **The segmenter is two functions and they differ**, which is the fact this recipe exists to keep
# visible. `shellSegments` folds words into a head, arguments and redirections and knows a table of
# segment leaders; `commandSegments` splits raw source on separators and knows none. A `then` leader
# is therefore CAUGHT on the write matcher and ESCAPES on the shell one — an asymmetry a reader meets
# as a contradiction unless something states it. Here it is a recorded cell rather than a surprise.
#
# **The oracle is exact because the generator composes rather than mutates.** It knows by construction
# whether the payload it embedded sits where bash would execute it or where bash would only print it,
# so a disagreement is a gate bypass or a false red rather than a difference somebody must adjudicate.
# That declaration is itself measured: ../../cli/fuzz-shell.ground.test.mjs runs every position under
# real bash with a NEUTRAL payload and fails if the grammar lied about itself. It caught two — a `..`
# hop through a directory nothing had created, and a harness fooled by `echo` printing its own payload.
#
# It found a live bypass of every Gated shell action on its first full run: one wrapper plus one
# separator — `bash -c "ls; git push --force origin main"` — closed 2026-08-25.
#
# **What this recipe CANNOT establish:** what a gate OUGHT to cover. Every escape it reports as
# expected cites a record, and whether that record should stay open is a policy question for the
# maintainer rather than a verdict for this rail.
#
# The seed and the case budget are pinned here and printed on every run, green included, so a green is
# as reproducible as a red. A verify recipe whose verdict moves between runs is not a rail.
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

for required in cli/fuzz-shell.mjs cli/goldens.mjs cli/compile.mjs .portulan/gates.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot fuzz the segmenters\n' "$required" >&2
        exit 2
    fi
done

printf 'fuzz-shell: generating a gated command and a constitution write in every position the grammar knows, on both segmenters\n'

# The resolution root is PINNED, for the reason ./compile.sh states at length and ./goldens.sh
# repeats: a required check answers about the TREE, never about the machine running it.
node cli/fuzz-shell.mjs --workspace . --pack-root packs --check
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    2) exit 2 ;;
    *)
        printf 'verify: fuzz-shell exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
