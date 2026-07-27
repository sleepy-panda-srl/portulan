#!/usr/bin/env bash
# Portulan workspace — verify recipe: the compiled enforcement matches the policy.
#
# One check:
#   compile   ../.claude/settings.json is exactly what ../gates.json compiles to
#
# This is the drift rail for generated enforcement. The artifact is committed on purpose — an
# uncommitted gate file is invisible to review, and the hook wiring is precisely the thing that
# should be readable in a diff — but a committed generated file invites the one edit that defeats
# it: a hand-fix that works until the next compile silently reverts it. So the recipe recompiles in
# memory and byte-compares.
#
# It never writes. A verify recipe that repairs what it is checking always passes, which is a
# fail-open dressed as a convenience.
#
# What this recipe CANNOT establish, and the reason it is worth saying inside the file rather than
# only in the README: that Claude Code honours the artifact. CI installs nothing by stated doctrine,
# so no recipe here runs the host. Emission fidelity is what a pull request can prove; only a
# running host proves loading — measured at the supervised checkpoints, exactly as
# `claude plugin validate --strict` is (../memory/a-manifest-field-can-validate-and-load-nothing.md).
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
# This recipe invokes only `node` and `dirname`, and was already correct; the guard is here for
# uniformity, so a later edit reaching for `grep` inherits the rule instead of rediscovering it.
for need in dirname node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The validator's own presence is a precondition, not a red. `node cli/compile.mjs` on a missing file
# exits 1, and passing that through would report "the enforcement has drifted" about an artifact
# nothing had looked at — the exact defect a reviewer found in doctor.sh, one dependency over from
# the node guard written to prevent it.
for required in cli/compile.mjs .portulan/gates.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot judge whether the enforcement matches the policy\n' "$required" >&2
        exit 2
    fi
done

printf 'compile: checking .claude/settings.json against .portulan/gates.json\n'

node cli/compile.mjs --workspace . --check
status=$?

case "$status" in
    0) exit 0 ;;
    1) exit 1 ;;
    # `compile` reserves 2 for "could not judge" and so does this recipe — passed through rather than
    # translated. This arm was missing for one checkpoint, so a genuine exit 2 fell to the catch-all
    # below and printed "not a verdict it documents" about a code the compiler documents plainly.
    # Right outcome, false sentence: the recipe still exited 2, while telling the reader the tool had
    # misbehaved. Found at the pre-commit checkpoint.
    2) exit 2 ;;
    # Anything else is a code the compiler does not document, and mapping an unknown status onto a
    # verdict is how a crash starts reading as a clean bill of health.
    *)
        printf 'verify: compile exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
        exit 2
        ;;
esac
