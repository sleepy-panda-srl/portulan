#!/usr/bin/env bash
# Portulan workspace — verify recipe: prose states the version package.json declares.
#
# One check:
#   version-carriers  every current-version claim in LIVE prose equals `package.json`'s version, and
#                     every file that must carry one still does
#
# The rail for a defect this repository shipped TWICE with the sibling pairing already written down:
# `README.md` and `.portulan/products/portulan/product.md` said `0.2.0` while everything machine-read
# said `0.1.0`; one release later `README.md` said `0.1.0` inside the change that cut `0.1.1`. It
# matters beyond tidiness because `README.md` is in `package.json`'s `files` and npm freezes a README
# per version — a wrong sentence that reaches a publish needs another release to correct.
#
# The record layer is excluded BY PATH, and that is the design rather than a convenience: this
# repository quotes retired sentences in the files recording their repair, so a matcher over
# everything reds on the account of the fix. See cli/version-carriers.mjs for the argument and for the
# residual it does not close.
#
# Exits 2 — could not run, never a green — when git or package.json cannot be read, per
# ../memory/verify-preconditions-fail-closed.md.
set -uo pipefail
cd "$(dirname "$0")/../.." || { printf 'verify: version-carriers could not reach the repository root\n' >&2; exit 2; }
for need in git node; do
    command -v "$need" >/dev/null 2>&1 || { printf 'verify: version-carriers could not run — %s is not on PATH\n' "$need" >&2; exit 2; }
done
node cli/version-carriers.mjs .
rc=$?
if [ "$rc" -eq 2 ]; then printf 'verify: version-carriers could not run (exit 2)\n' >&2; fi
exit "$rc"
