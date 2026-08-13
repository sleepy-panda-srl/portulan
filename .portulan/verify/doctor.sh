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

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
# Guarding only `node` left this recipe exiting GREEN with `sort` or `tr` absent, because the
# workspace list it compares is built by them and two empty lists compare equal.
for need in dirname git grep node sed sort tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

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

# An empty list is a configuration error, not a workspace verdict, and it is checked before anything
# else uses the array: on bash 3.2 — the system bash on macOS — expanding an empty array under
# `set -u` aborts mid-script, which would surface as exit 1, a red that judged nothing.
if [ "${#WORKSPACES[@]}" -eq 0 ]; then
    printf 'verify: WORKSPACES is empty — this recipe would validate nothing\n' >&2
    exit 2
fi

# Tracked plus new-and-not-ignored, so a workspace is audited before it is committed rather than
# after — the same manifest rule ./docs.sh and ./json.sh use.
#
# Its failure is guarded for the diagnosis rather than for a false green: with a non-empty list an
# unchecked failure yields an empty `present`, which mismatches and exits 2 anyway — but it would
# blame the LIST for git's failure and send a reader to edit a file that is correct. (The green case
# needs `WORKSPACES` empty as well, which the guard above has already refused.)
#
# The pathspec is two patterns rather than `*workspace.json`, which matches any path merely *ending*
# in that string: `docs/x-workspace.json` would have been reported as an unlisted workspace, with
# advice to add a stray file to the list. Fail-closed, but a false block is still the failure this
# repository says gets a recipe switched off.
if ! manifests=$(git ls-files --cached --others --exclude-standard -- 'workspace.json' '*/workspace.json'); then
    printf 'verify: git ls-files failed — cannot audit the workspace list\n' >&2
    exit 2
fi

present=$(printf '%s\n' "$manifests" | grep -v "^${FIXTURE_PREFIX}" | sed 's|/workspace\.json$||' | sort -u)
named=$(printf '%s\n' "${WORKSPACES[@]}" | sort -u)

if [ "$present" != "$named" ]; then
    printf 'verify: the workspaces this recipe validates are not the workspaces in the tree.\n' >&2
    # Quoted, and newlines flattened with `tr` rather than by leaving the expansion bare. An unquoted
    # expansion here would word-split and glob-expand: a workspace directory containing `*` or `[`
    # would print something other than its name, in the one message whose whole job is to name it.
    printf '  validated : %s\n' "$(printf '%s' "$named" | tr '\n' ' ')" >&2
    printf '  in tree   : %s\n' "$(printf '%s' "$present" | tr '\n' ' ')" >&2
    printf 'Add the missing workspace to WORKSPACES in this file, or remove the stale entry.\n' >&2
    exit 2
fi


# ---------------------------------------------------------------------------------------------
# **The resolution root is PINNED, and that is what keeps this recipe's verdict about the tree.**
#
# A required check answers *does this tree hold its own claims*, so its answer may not move with what
# happens to be installed on the machine running it. Naming the root is how that is guaranteed: it
# replaces every other source, so nothing here consults the host's plugin cache whatever the default
# becomes.
#
# It is the same argument this file already makes one noun over — the workspaces below are NAMED
# rather than discovered, so adding one is a visible edit here rather than a silent omission.
# ---------------------------------------------------------------------------------------------
node cli/doctor.mjs --pack-root packs "${WORKSPACES[@]}"
