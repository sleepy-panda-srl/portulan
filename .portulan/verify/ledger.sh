#!/usr/bin/env bash
# Portulan workspace — verify recipe: the spend ledger reproduces a fixture's known totals, and the
# restart advisory says its line once. (Proposal 0038, items 2 and 5 of its order of work.)
#
# Two checks, over committed synthetic host records and nothing of this machine's:
#   fixture   ../../cli/ledger.mjs --fixture over ../../cli/fixtures/ledger/: every figure the fixture pins —
#             requests and tokens by class, sessions and subagents apart; contexts opened; compactions;
#             the largest context; rebuilds and their causes; the difference from the host's own totals;
#             the restart threshold — equals the known total it carries. The records carry per-block
#             duplicates, a request copied into a second transcript, a torn line, a host-written record
#             with no request behind it, and a sibling directory whose key shares the repository's prefix
#   advisory  ../../cli/advisory.mjs prompt over two of the fixture's sessions: the one past its threshold
#             is told once and its second prompt nothing, the one below it nothing, and every run exits 0,
#             because a UserPromptSubmit hook exiting 2 would erase the person's prompt
#
# ## Why a fixture, and never this machine's records
#
# Proposal 0038, ruling 4: the ledger reads the host's records on demand and never inside a recipe. They
# differ per machine, so a rail on them would be red on one machine and green on the next. This recipe
# points HOME, CLAUDE_CONFIG_DIR and TMPDIR at an empty temporary directory, so a change that made either
# tool fall back to the host's own records would find nothing there, and the advisory's told-once records
# never land beside a real session's.
#
# A host format change is recorded by a new fixture, dated and read from a real transcript's shape, never
# by editing the known totals until they match what the reader now says.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

# Every external command this recipe runs — see ./docs.sh for the measurement behind the shape.
for need in cat dirname grep mkdir mktemp node rm; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

FIXTURE=cli/fixtures/ledger
# The fixture's session past its threshold, and one below it — see its fixture.json and ../../cli/fixtures/README.md.
PAST="$FIXTURE/projects/-work-demo--claude-worktrees-w1/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jsonl"
BELOW="$FIXTURE/projects/-work-demo/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jsonl"

# The tools and the fixture are preconditions, not reds: node on a missing file exits 1, which would
# read as a ledger that stopped reproducing its totals about a tree nothing measured.
for file in cli/ledger.mjs cli/advisory.mjs "$FIXTURE/fixture.json" "$PAST" "$BELOW"; do
    [ -f "$file" ] || {
        printf 'verify: %s not found — this recipe cannot run\n' "$file" >&2
        exit 2
    }
done

tmp=$(mktemp -d) || exit 2
trap 'rm -rf -- "$tmp"' EXIT
mkdir -p -- "$tmp/home/.claude" "$tmp/state" || exit 2
export HOME="$tmp/home" CLAUDE_CONFIG_DIR="$tmp/home/.claude" TMPDIR="$tmp/state"

node cli/ledger.mjs --fixture "$FIXTURE"
fixture=$?
printf '\n'

# The payload the host sends a UserPromptSubmit hook, as far as the advisory reads it. Built by node so a
# path holding a quote or a backslash is escaped by a JSON encoder rather than by this script.
payload() {
    node -e 'process.stdout.write(JSON.stringify({ session_id: process.argv[1], transcript_path: process.argv[2], hook_event_name: "UserPromptSubmit" }))' "$1" "$root/$2"
}

advisory=0
# One prompt: its output lands in a file, and its exit status is judged here, in this shell, where a red
# can be recorded — a command substitution would judge it in a subshell and lose the verdict.
prompt() {
    payload "$1" "$2" | node cli/advisory.mjs prompt >"$tmp/$3"
    local status=$?
    if [ "$status" -ne 0 ]; then
        printf '  ✗ advisory: exited %s on %s — a UserPromptSubmit hook must exit 0 on every path, or it blocks the prompt\n' "$status" "$2"
        advisory=1
    fi
}

prompt recipe-past "$PAST" first
prompt recipe-past "$PAST" second
prompt recipe-below "$BELOW" below
if ! grep -q '"additionalContext":"Portulan restart advisory: .*80,004' "$tmp/first"; then
    printf '  ✗ advisory: the session past its threshold of 80,004 was not told at its first prompt; it printed: %s\n' "$(cat -- "$tmp/first")"
    advisory=1
fi
if [ -s "$tmp/second" ]; then
    printf '  ✗ advisory: the line was said again at the second prompt, which is the echo proposal 0038 rule 5 forbids: %s\n' "$(cat -- "$tmp/second")"
    advisory=1
fi
if [ -s "$tmp/below" ]; then
    printf '  ✗ advisory: a session below its threshold was told: %s\n' "$(cat -- "$tmp/below")"
    advisory=1
fi
[ "$advisory" -eq 0 ] && printf '  ok advisory: the session past its threshold is told once, at its first prompt; its second prompt and a session below the threshold are not\n'

# Could-not-run outranks red: a run that judged nothing cannot vouch for the one that did.
worst=$advisory
case "$fixture" in
    0) ;;
    1) worst=1 ;;
    2) worst=2 ;;
    *)
        printf 'verify: the ledger exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$fixture" >&2
        exit 2
        ;;
esac

case "$worst" in
    0) printf '\nGREEN — verify recipe passed.\n'; exit 0 ;;
    1) printf '\nRED — verify recipe failed; "done" is blocked.\n'; exit 1 ;;
    *) exit 2 ;;
esac
