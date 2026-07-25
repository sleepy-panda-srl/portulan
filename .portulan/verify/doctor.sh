#!/usr/bin/env bash
# Portulan workspace — verify recipe: the Workspace Definition validator.
#
# One check, run against both workspaces this repository owns:
#   doctor  every manifest conforms, every path resolves, every claim matches the tree,
#           and every rule carries provenance a machine can check
#
# The workspaces are named as arguments rather than discovered. A scan that finds no manifests
# would run nothing and exit 0 — the enumeration fail-open this repository has now fixed three
# times (../memory/verify-preconditions-fail-closed.md). Naming them means adding a workspace is
# a visible edit to this line, not a silent omission.
#
# Exit 0 green · 1 red · 2 could not run. The wrapper exists for the third code: `bash -c "node …"`
# on a machine without node exits 127, which is neither a verdict nor "could not run" — so the
# dependency is checked here and the code is set deliberately. ../../cli/doctor.mjs uses the same
# three codes internally, so this script passes its status through unchanged.

set -uo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2
command -v node >/dev/null 2>&1 || {
    printf 'verify: node not found — this recipe needs it; see .portulan/verify/README.md\n' >&2
    exit 2
}

node cli/doctor.mjs .portulan examples
