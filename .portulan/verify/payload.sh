#!/usr/bin/env bash
# Portulan workspace — verify recipe: nothing joins the npm payload unclassified.
#
# One check:
#   payload  every `cli/*.mjs` the package would ship falls in exactly one class — the `bin`, a
#            `SUBCOMMANDS` module, a module one of those imports, a compiled-hook runner, a module
#            ruled into `PRODUCT`, or the frozen `UNRULED` set — the three registers are pairwise
#            disjoint, and every declared exclusion agrees with what npm actually packs
#
# #383's first half. `package.json`'s `files` array governs the payload and nothing derived or checked
# its membership: `pack-identity` holds every packed file byte-identical to its source and is silent on
# WHICH files those are. That is how `cli/ab.mjs`, `ab-run.mjs` and `ab-grade.mjs` shipped for three
# sessions unnoticed, and it was demonstrated live on the change that filed #383 — a `cli/` module
# staged into a scratch clone joined the tarball with `pack-identity` green over 84 files.
#
# This is `cli/eval-bundle.mjs`'s `assertPartition` one level down: a new module fails every pull
# request until somebody decides whether it ships.
#
# **A green here is not a ruling on the thirteen `UNRULED` modules.** That class records the ABSENCE of
# a decision and links #383, which stays open; the rail is its first half, never its discharge. It is
# frozen at thirteen BY A NUMBER THIS RAIL CHECKS: entries may leave, one at a time, as #383 is
# answered and each moves to `PRODUCT` or the exclusions — and none may join.
#
# Exits 2 — could not run, never a green — when `npm pack` or `git` is unusable, per
# ../memory/verify-preconditions-fail-closed.md: reporting "a module is unclassified" when what
# happened is "npm did not run" sends someone hunting a defect that does not exist.
set -uo pipefail
cd "$(dirname "$0")/../.." || { printf 'verify: payload could not reach the repository root\n' >&2; exit 2; }
for need in node npm git; do
    command -v "$need" >/dev/null 2>&1 || { printf 'verify: payload could not run — %s is not on PATH\n' "$need" >&2; exit 2; }
done
node cli/payload.mjs .
rc=$?
if [ "$rc" -eq 2 ]; then printf 'verify: payload could not run (exit 2)\n' >&2; fi
exit "$rc"
