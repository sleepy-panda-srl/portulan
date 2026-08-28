#!/usr/bin/env bash
# Portulan workspace — verify recipe: the telemetry payload says what its snapshot says, and no
# recipe in this workspace can reach the network.
#
# Two checks:
#   golden   ../../evals/telemetry/review-loop.otlp.json is regenerated from the committed opt-in
#            config and ../../evals/review-loop/snapshot.json, and compared BYTE FOR BYTE through the
#            same renderer that wrote it. Reading the config is how it gets validated: a malformed
#            config is exit 2 before any comparison happens.
#   offline  no recipe the workspace YIELDS can reach a network mode.
#
# Milestone 8, the *OTel opt-in config* clause. The argument is in ../../docs/milestones/m08.md and
# the mechanism in ../../cli/telemetry.mjs; what belongs here is why the recipe exists at all.
#
# ## Why a committed golden rather than render-twice-and-compare
#
# Those are two different checks and only one of them is worth running. Rendering twice and comparing
# passes even if the renderer's entire output shape changed this morning — it proves the function is
# deterministic, which nobody doubted. Comparing against a COMMITTED artifact proves the payload this
# repository would actually send is the payload a reviewer read.
#
# It is held the way ./index.sh holds the memory index and ./review-loop.sh holds its register:
# generated, byte-compared, and a hand-edit survives until the next run and no longer.
#
# **The version rides in the payload, so a release cut reds this recipe.** `telemetry.sdk.version` and
# the scope version both come from package.json, which means bumping the package makes the golden
# stale and this check go red until somebody runs `--write`. That is deliberate and it is the rail
# working rather than a defect: the alternative is a payload that silently misreports which version
# produced it. Regenerating is one command and it belongs in the release, beside the other
# version-carrier work ./version-carriers.sh already forces.
#
# ## Why the export arm is NOT checked here, and it is this recipe's own rule that forbids it
#
# The obvious third check — run `--export` against the opted-out config and require the refusal —
# cannot live in this file. The `offline` check below reds any yielded recipe whose script names
# `cli/telemetry.mjs --export`, and this recipe is a yielded recipe. So the rail forbids its own
# author the cheapest way to test the thing it guards.
#
# That is the right outcome and it is stated rather than worked around: the refusal arms, the
# transport parsing and the send itself are exercised in ../../cli/telemetry.test.mjs against an
# INJECTED transport — never a real socket, because ./tests.sh runs that suite and a test opening a
# socket would be the network call inside a verify recipe that this very check exists to forbid. The
# real socket is exercised once, by a person, in the session's recorded demonstration.
#
# ## What it does NOT establish
#
# **It cannot tell a current snapshot from a stale one.** It checks the payload against the snapshot,
# never the snapshot against the world — the same cost ./review-loop.sh states, inherited one step
# down, and tracked as https://github.com/sleepy-panda-srl/portulan/issues/356. What this layer adds
# is that the snapshot's capture stamp travels INSIDE the payload, so a stale export arrives labelled
# stale rather than looking fresh.
#
# **The class is DERIVED, not enumerated — since round 10 of this pull request's review.** The table
# claimed to rail the class of network-capable modes and listed two of three: `cli/feedback.mjs` files a
# GitHub issue through `gh issue create` and had been network-capable longer than either. A suite case
# now derives the set from the tree — every `cli/` module reaching `fetch` or `gh` must have a row — so
# a new network-capable module reddens instead of being quietly uncovered.
#
# What is still uncovered, and it is narrower than the sentence this replaces: a module reaching the
# network some way that derivation does not see, and a mode reached INDIRECTLY through another script
# or a flag built at runtime.
#
# **What it now recognises, and what it still cannot.** A module is matched as a path SUFFIX on a
# separator boundary, so `cli/x.mjs`, `./cli/x.mjs` and an absolute spelling all name it, and a flag is
# matched as a token in both `--flag` and `--flag=value` forms. The first version compared against one
# literal string, which made `./` a bypass of an enforcement rail — the class clauses (a) and (b) of
# this milestone exist for. What it still cannot see is a mode reached INDIRECTLY: a recipe that shells
# out to another script, or builds the flag at runtime. That is a matcher's standing limit and not a
# thing a wider pattern fixes.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
for need in dirname node; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The runner's own presence is a precondition, not a red — `node` on a missing file exits 1, and
# passing that through would print a finding about a payload nothing had read. The defect this
# repository has now met four times, in doctor.sh first.
for required in cli/telemetry.mjs evals/telemetry/config.json evals/telemetry/review-loop.otlp.json evals/review-loop/snapshot.json; do
    if [ ! -f "$required" ]; then
        printf 'verify: %s is missing — cannot check the telemetry payload against its snapshot\n' "$required" >&2
        exit 2
    fi
done

status=0

printf 'telemetry: regenerating evals/telemetry/review-loop.otlp.json and comparing byte for byte\n'
# **Both roots are named ON THIS LINE**, and the pack root is named on a mode that does not use it.
# ../../cli/pinned-roots.live.test.mjs matches per line and cannot tell one mode of a tool from
# another, so a root sitting on a continuation — or omitted because this particular mode resolves no
# packs — reads as a check with no root, inheriting the machine it runs on. Naming it here costs one
# unused flag; teaching that rail to understand modes would cost it the property that makes it a rail.
node cli/telemetry.mjs --config evals/telemetry/config.json --repo-root . --pack-root packs --check evals/telemetry/review-loop.otlp.json
golden=$?

printf 'telemetry: auditing every recipe the workspace yields for a reachable network mode\n'
node cli/telemetry.mjs --audit-recipes --workspace .portulan --repo-root . --pack-root packs
offline=$?

# **A could-not-run anywhere wins**, because a check that could not judge has not judged and a green
# computed over it would be a green about nothing. The precedence is stated rather than left to the
# order the checks happen to run in: ./compile.sh was missing this arm for one checkpoint, and a
# genuine exit 2 fell through to a catch-all that printed a sentence about the tool misbehaving.
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
