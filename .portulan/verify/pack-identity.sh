#!/usr/bin/env bash
# Portulan workspace — verify recipe: the package installs the tree's bytes.
#
# One check:
#   pack-identity  every file `npm pack` would emit is byte-identical to its staged blob (`git show :<path>`),
#                  and every one of them is tracked at all
#
# The rail #149 asked for. `.portulan/identity.md` claims the `npx` path installs the SAME BYTES, and
# until 2026-08-18 nothing checked it — the count in that claim was re-measured by hand three times and
# was wrong in the tree twice between measurements.
#
# It compares against the TREE rather than the registry deliberately: the registry comparison needs the
# network and a published version, so it cannot run before a first publish or on a machine offline, and
# a recipe that cannot run stops being run. This owns the half that can drift silently on any commit.
# The registry half stays a hand measurement taken at each publish and recorded on #149.
#
# Exits 2 — could not run, never a green — when `npm pack` is unusable or HEAD does not resolve, per
# ../memory/verify-preconditions-fail-closed.md. A rail reporting "the bytes differ" when what happened
# is "npm did not run" sends someone hunting a drift that does not exist.
set -uo pipefail
cd "$(dirname "$0")/../.." || { printf 'verify: pack-identity could not reach the repository root\n' >&2; exit 2; }
node cli/pack-identity.mjs .
rc=$?
if [ "$rc" -eq 2 ]; then printf 'verify: pack-identity could not run (exit 2)\n' >&2; fi
exit "$rc"
