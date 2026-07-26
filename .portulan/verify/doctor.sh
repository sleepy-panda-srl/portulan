#!/usr/bin/env bash
# Portulan workspace — verify recipe: the Workspace Definition validator.
#
# One check, run against both workspaces this repository owns:
#   doctor  every manifest conforms, every path resolves, every claim matches the tree,
#           and every rule carries provenance a machine can check
#
# The workspaces are named rather than discovered. A scan that finds no manifests would run nothing
# and exit 0 — the enumeration fail-open this repository has now fixed three times
# (../memory/verify-preconditions-fail-closed.md). Naming them means adding a workspace is a visible
# edit to this file, not a silent omission.
#
# Naming closes one hole and opens its mirror: a workspace ADDED to the tree and not added to the
# list is validated by nothing, and nothing says so. Demonstrated before it was fixed — a third
# manifest dropped into the tree, and this recipe exited 0 having ignored it.
#
# So the named list is what RUNS and a discovery pass AUDITS it; the two must agree or the recipe
# exits 2. That ordering is the whole point. Discovery cross-checks and never decides, so it cannot
# reintroduce the fail-open it was avoided for: a scan finding nothing now disagrees with a non-empty
# list and fails loudly, where a scan that DROVE the run would have passed in silence.
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

# The validator's own presence is a precondition, and checking it here is not belt-and-braces.
# `node cli/doctor.mjs` on a missing file exits **1** — demonstrated — which this recipe would pass
# through as "the workspaces do not validate", a verdict about two workspaces nothing looked at. The
# guards above turn a missing dependency into a 2; without this one, a missing *tool* still becomes a
# red. Found by a reviewer on the pull request, in the recipe that has no tests.
[ -f cli/doctor.mjs ] || {
    printf 'verify: cli/doctor.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# The list. Adding a workspace to this repository means adding it here — and the audit below is what
# makes forgetting it loud instead of invisible.
WORKSPACES=(.portulan examples)

# Deliberately excluded: the fixtures are broken on purpose — a manifest that violates the schema, a
# card whose claims are false — and validating them would fail by design. Excluding them by prefix
# rather than by listing them keeps a new fixture from tripping the audit.
FIXTURE_PREFIX="cli/fixtures/"

# Tracked plus new-and-not-ignored, so a workspace is audited before it is committed rather than
# after — the same manifest rule ./docs.sh and ./json.sh use. Its failure is a precondition: an
# unchecked `git ls-files` here would return nothing, and nothing matches nothing, so a silent
# failure would report the list as correct precisely when it could not be verified.
if ! manifests=$(git ls-files --cached --others --exclude-standard -- '*workspace.json'); then
    printf 'verify: git ls-files failed — cannot audit the workspace list\n' >&2
    exit 2
fi

present=$(printf '%s\n' "$manifests" | grep -v "^${FIXTURE_PREFIX}" | sed 's|/workspace\.json$||' | sort -u)
named=$(printf '%s\n' "${WORKSPACES[@]}" | sort -u)

if [ "$present" != "$named" ]; then
    printf 'verify: the workspaces this recipe validates are not the workspaces in the tree.\n' >&2
    printf '  validated : %s\n' "$(printf '%s ' $named)" >&2
    printf '  in tree   : %s\n' "$(printf '%s ' $present)" >&2
    printf 'Add the missing workspace to WORKSPACES in this file, or remove the stale entry.\n' >&2
    exit 2
fi

node cli/doctor.mjs "${WORKSPACES[@]}"
