#!/usr/bin/env bash
# Portulan workspace — verify recipe: the packaging validator.
#
# One check, run against every plugin root this repository ships:
#   plugin  both manifests parse and agree, every declared component path resolves inside the tree,
#           every skill behind those paths is a real artifact with a description, and so is every
#           agent at `./agents/`, which nothing declares and which therefore nothing else covers
#
# Exit 0 green · 1 red · 2 could not run. The wrapper exists for the third code: `bash -c "node …"`
# on a machine without node exits 127, which is neither a verdict nor "could not run".
#
# ## What this recipe does NOT check, stated here because a reader will assume otherwise
#
# It does not check the Claude Code plugin contract. `claude plugin validate --strict` is the authority
# for that and is deliberately NOT run here: CI installs nothing by stated doctrine
# (../../.github/workflows/verify.yml), so declaring the `claude` binary as a dependency would exit 2 —
# could not run — on every pull request, which is permanently red. It runs at the supervised checkpoints
# and before any release instead.
#
# The two are not nested, and neither is a superset: the first-party validator refused a manifest this
# lint passed, and passed three broken skills this lint fails. Measured, not assumed — see
# ../memory/a-checkers-coverage-is-measured-not-named.md.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
# Guarding only `node` left this recipe exiting GREEN with `sort` or `tr` absent.
for need in dirname git node sed sort tr; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# The validator's own presence is a precondition. `node cli/plugin-lint.mjs` on a missing file exits 1,
# which this recipe would pass through as "the packaging does not validate" — a red verdict about a tree
# nothing looked at. The same defect a reviewer found in ./doctor.sh.
[ -f cli/plugin-lint.mjs ] || {
    printf 'verify: cli/plugin-lint.mjs not found — this recipe cannot run\n' >&2
    exit 2
}

# The list of plugin roots. Named rather than discovered, and then audited against the tree — the
# ordering ./doctor.sh establishes: discovery cross-checks and never decides, so a scan that finds
# nothing fails loudly instead of running nothing and reporting green.
PLUGIN_ROOTS=(.)

if [ "${#PLUGIN_ROOTS[@]}" -eq 0 ]; then
    printf 'verify: PLUGIN_ROOTS is empty — this recipe would validate nothing\n' >&2
    exit 2
fi

# Tracked plus new-and-not-ignored, so a plugin is audited before it is committed rather than after.
#
# `*/.claude-plugin/plugin.json` reaches ANY depth, not one directory. Git's default pathspec magic
# does not set pathname mode, so `*` crosses `/`; that only stops being true under `:(glob)` magic,
# where `**` would be required. Raised in review on the assumption it matched one level, and
# measured rather than argued: a manifest planted at `packs/rituals/deep/nested/.claude-plugin/` was
# listed by this command and the audit exited 2 naming it. Worth the comment because the "fix" —
# adding `:(glob)` or a second `**` pattern — would be a change made in the belief it closed a hole
# that was never open, and under the wrong magic it would open one.
if ! manifests=$(git ls-files --cached --others --exclude-standard \
    -- '.claude-plugin/plugin.json' '*/.claude-plugin/plugin.json'); then
    printf 'verify: git ls-files failed — cannot audit the plugin-root list\n' >&2
    exit 2
fi

# `.claude-plugin/plugin.json` at the repository root has no directory prefix, so it maps to `.`.
present=$(printf '%s\n' "$manifests" | sed -e 's|/\{0,1\}\.claude-plugin/plugin\.json$||' -e 's|^$|.|' | sort -u)
named=$(printf '%s\n' "${PLUGIN_ROOTS[@]}" | sort -u)

if [ "$present" != "$named" ]; then
    printf 'verify: the plugin roots this recipe validates are not the plugin roots in the tree.\n' >&2
    printf '  validated : %s\n' "$(printf '%s' "$named" | tr '\n' ' ')" >&2
    printf '  in tree   : %s\n' "$(printf '%s' "$present" | tr '\n' ' ')" >&2
    printf 'Add the missing plugin root to PLUGIN_ROOTS in this file, or remove the stale entry.\n' >&2
    exit 2
fi

node cli/plugin-lint.mjs "${PLUGIN_ROOTS[@]}"
