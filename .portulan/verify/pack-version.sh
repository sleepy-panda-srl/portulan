#!/usr/bin/env bash
# Portulan workspace — verify recipe: a change to a pack's `contributes` moves its `portulan.version`.
#
# One check:
#   pack-version   every pack whose `contributes` differs from the merge-base also moved its
#                  `portulan.version` — ruled on #265, arm 3, including a prose-only edit to a `reason`
#
# ## Why this recipe reads HISTORY, when the others read the tree
#
# Every other recipe here judges the tree as it stands. This one cannot: "did this change bump the
# version" is a question about a *diff*, and there is no way to ask it of a single commit. That makes it
# the second tool in this repository to read history — `../../cli/librarian.mjs` is the first — and its
# header carries the standing warning this recipe inherits: **a check that reads history is a false-red
# generator in a shallow checkout**, and `actions/checkout` is shallow by DEFAULT, so the degraded case
# is the normal one rather than an exotic one.
#
# The consequence is the shape below. The precondition is established FIRST and a failure to establish it
# is exit **2**, never exit 1 — see ../memory/verify-preconditions-fail-closed.md, and #208, which is
# open about exactly this distinction on the control-chars scanner. A red verdict is a claim about the
# work; "I could not look" is a claim about the check, and spending the second as the first is how a rail
# starts lying. `.github/workflows/verify.yml` sets `fetch-depth: 0` so that in CI this recipe can
# actually run rather than exiting 2 on every pull request.
#
# ## What it does NOT do
#
# It does not bump anything, and it does not judge which version number is right — only that one moved.
# It says nothing about `packs/.claude-plugin/plugin.json`, the packs *bundle* version: that is arm 4 of
# #265 and is deliberately a separate question, because the bundle is one field and the packs are many
# (measured: the bundle and `rituals/checkpoints` agree at `0.2.1` while `tools/github` is at `0.1.0`).
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs, checked before it runs any of them — see ./docs.sh for the
# measurement behind the shape. `git` is listed because this is the recipe that needs it most: without
# it there is no merge-base, and a missing merge-base must not read as "no packs changed".
for need in dirname git node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The base is overridable so a fork, a release branch or a local experiment can name its own — but it
# defaults to what the pull-request gate actually compares against. `PORTULAN_BASE_REF` rather than a
# flag, because a verify recipe is invoked by the runner with no arguments.
base=${PORTULAN_BASE_REF:-origin/main}

# **The precondition, established here rather than left to the checker's exit code.** The checker also
# refuses — it returns 2 on an unreadable base — and this block is not redundant with it: the recipe is
# what a human and the stop-gate run, so the sentence that names the repair belongs where they will see
# it. Both routes a shallow clone takes are covered, because they are different failures: the ref may be
# absent entirely (a `--depth 1` single-branch clone, the common CI shape) or present with its history
# truncated (`--no-single-branch`). Measured on both.
# `--end-of-options` on both, because `$base` is user-supplied through PORTULAN_BASE_REF and git reads a
# value beginning with `-` as a FLAG. Measured on git 2.50.1: `git merge-base --is-ancestor HEAD` is
# parsed as the option and exits 129 — the command stops being a merge-base lookup and becomes an
# ancestry test, so the precondition would be answering a different question than the one asked. Copilot
# proposed `--` for this on #274; measured, `--` is the PATH separator for rev-parse and breaks it (128).
if ! git rev-parse --verify --end-of-options "${base}^{commit}" >/dev/null 2>&1; then
    printf 'verify: base ref %s is not in this repository — cannot ask what this change did.\n' "$base" >&2
    printf '        A shallow single-branch clone never fetches it. Set fetch-depth: 0, or name another\n' >&2
    printf '        base with PORTULAN_BASE_REF. Refusing to report green having compared nothing.\n' >&2
    exit 2
fi
if ! git merge-base --end-of-options "$base" HEAD >/dev/null 2>&1; then
    printf 'verify: no merge-base between %s and HEAD — the ref resolved but its history did not.\n' "$base" >&2
    printf '        This is a shallow clone, or genuinely unrelated histories. Set fetch-depth: 0.\n' >&2
    exit 2
fi

# Exit read DIRECTLY, never through a pipe: a pipeline reports the LAST command's status, so `| tail`
# would report tail's 0 over a printed RED. Measured on this repository, 2026-08-14, on another recipe.
node cli/pack-version.mjs --base "$base"
code=$?

case "$code" in
    0) printf 'GREEN — verify recipe passed.\n' ;;
    1) printf 'RED — verify recipe failed; "done" is blocked.\n' ;;
    *) printf 'verify: pack-version could not run (exit %s)\n' "$code" >&2 ;;
esac
exit "$code"
