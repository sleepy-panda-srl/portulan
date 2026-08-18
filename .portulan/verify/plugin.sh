#!/usr/bin/env bash
# Portulan workspace — verify recipe: the packaging validator.
#
# Two checks. The first runs against every plugin root this repository ships:
#   plugin      both manifests parse and agree, every declared component path resolves inside the tree,
#               every skill behind those paths is a real artifact with a description, and so is every
#               agent at `./agents/`, which nothing declares and which therefore nothing else covers
#   skills-set  the governing workspace's `packs` and this bundle's declared `skills` are one fact:
#               every skills root a composed pack NOMINATES is a root the manifest declares. Milestone
#               7 session 8, row 7 clause (b)'s adopter half
#               ([#184](https://github.com/sleepy-panda-srl/portulan/issues/184)) — until it landed,
#               registration was a property of `.claude-plugin/plugin.json` alone and a composed pack's
#               skill was invocable by coincidence of a hand-written path.
#
# It is a second INVOCATION rather than a second recipe on purpose: this recipe already owns packaging,
# and a new recipe would be a manifest change and a CI job for one comparison. `plugin-lint` asks the
# same question of the tree from the other side; the two are different evidence about one rule, and the
# note in `cli/plugin-lint.mjs`'s compose check argues why neither replaces the other.
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

# A PAYLOAD root is a plugin a **feed** ships without being a marketplace itself: no `marketplace.json`
# here, and none owed, because the feed carries the entry. Declared as its own list so the exemption is
# named rather than inferred from an absent file — a lint that quietly relaxed on a missing manifest
# would be narrower every time someone deleted one.
#
# `packs` became one on 2026-08-09, and this recipe found it before anyone declared it: the audit below
# reported `in tree: . packs` against `validated: .` and exited 2 rather than going green over a root
# nobody had named. It is a payload because the private feed's `portulan-checkpoints` entry is a
# `git-subdir` source rooted there — so a host installs the contents of `packs/` and reads
# `packs/.claude-plugin/plugin.json`, which did not exist until that day, which is why that install
# reported `Skills (0)` for a milestone ([#134](https://github.com/sleepy-panda-srl/portulan/issues/134)).
PAYLOAD_ROOTS=(packs)

if [ "${#PLUGIN_ROOTS[@]}" -eq 0 ]; then
    printf 'verify: PLUGIN_ROOTS is empty — this recipe would validate nothing\n' >&2
    exit 2
fi

# The same guard for the second list, and it is not decoration: under `set -u` on bash 3.2 an empty
# array expands to an unbound-variable error, `named` comes out blank, and the audit below reports a
# blank `validated:` line — fail-closed with a false diagnosis, which is the shape this recipe exists
# to refuse. Found at the pre-commit checkpoint by emptying it.
if [ "${#PAYLOAD_ROOTS[@]}" -eq 0 ]; then
    printf 'verify: PAYLOAD_ROOTS is empty — remove the second invocation rather than passing nothing\n' >&2
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
# `core.quotePath=false` for the reason ../verify/docs.sh states beside its own enumeration: a C-quoted
# path defeats the `$`-anchored strip below and refuses a legal tree. Same defect, same repair, swept
# together rather than left as the next site someone rediscovers.
if ! manifests=$(git -c core.quotePath=false ls-files --cached --others --exclude-standard \
    -- '.claude-plugin/plugin.json' '*/.claude-plugin/plugin.json'); then
    printf 'verify: git ls-files failed — cannot audit the plugin-root list\n' >&2
    exit 2
fi

# `.claude-plugin/plugin.json` at the repository root has no directory prefix, so it maps to `.`.
present=$(printf '%s\n' "$manifests" | sed -e 's|/\{0,1\}\.claude-plugin/plugin\.json$||' -e 's|^$|.|' | sort -u)
named=$(printf '%s\n' "${PLUGIN_ROOTS[@]}" "${PAYLOAD_ROOTS[@]}" | sort -u)

if [ "$present" != "$named" ]; then
    printf 'verify: the plugin roots this recipe validates are not the plugin roots in the tree.\n' >&2
    printf '  validated : %s\n' "$(printf '%s' "$named" | tr '\n' ' ')" >&2
    printf '  in tree   : %s\n' "$(printf '%s' "$present" | tr '\n' ' ')" >&2
    printf 'Add the missing plugin root to the list it belongs in — PLUGIN_ROOTS for a root that\n' >&2
    printf 'carries its own marketplace.json, PAYLOAD_ROOTS for one a feed publishes — or remove the\n' >&2
    printf 'stale entry.\n' >&2
    exit 2
fi

# Two invocations now, and the tail has to keep THREE codes apart rather than two. `|| status=1`
# flattened a could-not-run into a red — 2 read as a verdict about the tree, which `cli/stop-gate.mjs`
# names as the way a runner manufactures false reds. Third instance in this repository: `./compile.sh`
# and `./index.sh` both carry the same `case` after the same finding at a pre-commit checkpoint, and
# both were caught the same way. 2 outranks 1, because *nobody looked* outranks *we looked and it was
# bad*.
status=0
node cli/plugin-lint.mjs "${PLUGIN_ROOTS[@]}"
case $? in
    0) ;;
    2) exit 2 ;;
    *) status=1 ;;
esac
node cli/plugin-lint.mjs --payload "${PAYLOAD_ROOTS[@]}"
case $? in
    0) ;;
    2) exit 2 ;;
    *) status=1 ;;
esac

# The registrable set, against the governing workspace and this repository's own plugin root. Only
# PLUGIN_ROOTS are asked: a payload root ships packs rather than composing them, so it has no `packs`
# array to derive from and the question does not apply to it — stated here rather than left to be
# inferred from an absent invocation.
#
# The same three codes, kept apart for the same reason: a drifted `skills` key is 1, and anything that
# could not be read — the workspace manifest, a pack, the plugin manifest — is 2. Flattening 2 into 1
# would report a verdict about a tree nothing looked at.
[ -f cli/skills-set.mjs ] || {
    printf 'verify: cli/skills-set.mjs not found — this recipe cannot run\n' >&2
    exit 2
}
for root in "${PLUGIN_ROOTS[@]}"; do
    node cli/skills-set.mjs --workspace .portulan --repo-root . --pack-root packs --plugin-root "$root" --check
    case $? in
        0) ;;
        2) exit 2 ;;
        *) status=1 ;;
    esac
done
exit "$status"
