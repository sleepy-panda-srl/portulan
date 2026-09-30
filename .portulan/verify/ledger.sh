#!/usr/bin/env bash
# Portulan workspace — verify recipe: the spend ledger reproduces a fixture's known totals, and the restart
# advisory speaks once.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in cat dirname grep mkdir mktemp node rm; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

FIXTURE=cli/fixtures/ledger
PAST_THRESHOLD="$FIXTURE/projects/-work-demo--claude-worktrees-w1/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jsonl"
BELOW_THRESHOLD="$FIXTURE/projects/-work-demo/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jsonl"

# node exits 1 on a missing file, which would read as a red verdict.
for file in cli/ledger.mjs cli/advisory.mjs "$FIXTURE/fixture.json" "$PAST_THRESHOLD" "$BELOW_THRESHOLD"; do
    [ -f "$file" ] || {
        printf 'verify: %s not found — this recipe cannot run\n' "$file" >&2
        exit 2
    }
done

# An empty temporary home, so neither tool reads this machine's records or writes beside a real session's.
tmp=$(mktemp -d) || exit 2
trap 'rm -rf -- "$tmp"' EXIT
mkdir -p -- "$tmp/home/.claude" "$tmp/state" || exit 2
export HOME="$tmp/home" CLAUDE_CONFIG_DIR="$tmp/home/.claude" TMPDIR="$tmp/state"

node cli/ledger.mjs --fixture "$FIXTURE"
fixture=$?
printf '\n'

# Built by node, so a JSON encoder escapes any quote or backslash in a path.
hook_payload() {
    node -e 'const [session_id, transcript_path, hook_event_name, agent_id] = process.argv.slice(1);
        process.stdout.write(JSON.stringify({ session_id, transcript_path, hook_event_name, ...(agent_id ? { agent_id } : {}) }))' \
        "$1" "$root/$2" "$3" "${4:-}"
}

advisory=0
# Output goes to a file, never a command substitution, whose subshell would lose advisory=1.
call_hook() {
    local mode=$1 event=$2 session=$3 transcript=$4 out=$5 agent=${6:-}
    hook_payload "$session" "$transcript" "$event" "$agent" | node cli/advisory.mjs "$mode" >"$tmp/$out"
    local status=$?
    if [ "$status" -ne 0 ]; then
        printf '  ✗ advisory: exited %s on %s — a hook must exit 0 on every path, or a UserPromptSubmit blocks the prompt\n' "$status" "$transcript"
        advisory=1
    fi
}
prompt() { call_hook prompt UserPromptSubmit "$@"; }
tool() { call_hook tool PostToolUse "$@"; }
stop() { call_hook stop Stop "$@"; }

prompt recipe-past "$PAST_THRESHOLD" first
prompt recipe-past "$PAST_THRESHOLD" second
prompt recipe-below "$BELOW_THRESHOLD" below
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

tool tool-past "$PAST_THRESHOLD" subagent agent-sub1
tool tool-past "$PAST_THRESHOLD" tool
prompt tool-past "$PAST_THRESHOLD" after
tool tool-below "$BELOW_THRESHOLD" tool-below
if [ -s "$tmp/subagent" ]; then
    printf '  ✗ advisory: a subagent'"'"'s tool result was told the session'"'"'s line: %s\n' "$(cat -- "$tmp/subagent")"
    advisory=1
fi
if ! grep -q '"hookEventName":"PostToolUse","additionalContext":"Portulan restart advisory: after [0-9][0-9,]* requests, .*80,004.*finish the current step' "$tmp/tool"; then
    printf '  ✗ advisory: the session past its threshold was not told with its first tool result, with its requests and to finish the step; it printed: %s\n' "$(cat -- "$tmp/tool")"
    advisory=1
fi
if [ -s "$tmp/after" ]; then
    printf '  ✗ advisory: the prompt after the tool result said the line again: %s\n' "$(cat -- "$tmp/after")"
    advisory=1
fi
if [ -s "$tmp/tool-below" ]; then
    printf '  ✗ advisory: a session below its threshold was told with a tool result: %s\n' "$(cat -- "$tmp/tool-below")"
    advisory=1
fi
stop stop-past "$PAST_THRESHOLD" stop-first
stop stop-past "$PAST_THRESHOLD" stop-second
tool stop-past "$PAST_THRESHOLD" stop-after
tool stop-told "$PAST_THRESHOLD" stop-told-line
stop stop-told "$PAST_THRESHOLD" stop-told
stop stop-below "$BELOW_THRESHOLD" stop-below
if ! grep -q '^{"decision":"block","reason":"Portulan restart advisory: after [0-9][0-9,]* requests, .*80,004.*: write the handoff and end the session\. Said once\."}$' "$tmp/stop-first" || grep -q 'finish' "$tmp/stop-first"; then
    printf '  ✗ advisory: the session past its threshold was not held at its first stop with the line and its Stop ending; it printed: %s\n' "$(cat -- "$tmp/stop-first")"
    advisory=1
fi
if [ -s "$tmp/stop-second" ] || [ -s "$tmp/stop-after" ]; then
    printf '  ✗ advisory: after the block the line came again, at the next stop (%s) or with a tool result (%s)\n' "$(cat -- "$tmp/stop-second")" "$(cat -- "$tmp/stop-after")"
    advisory=1
fi
if ! grep -q '"additionalContext":"Portulan restart advisory' "$tmp/stop-told-line" || ! grep -q '^{"decision":"block"' "$tmp/stop-told"; then
    printf '  ✗ advisory: a line said with a tool result spared the block at the next stop; it printed: %s\n' "$(cat -- "$tmp/stop-told")"
    advisory=1
fi
if [ -s "$tmp/stop-below" ]; then
    printf '  ✗ advisory: a session below its threshold was held at a stop: %s\n' "$(cat -- "$tmp/stop-below")"
    advisory=1
fi
[ "$advisory" -eq 0 ] && printf '  ok advisory: the session past its threshold is told once, at its first prompt or with its first tool result, and never twice; a subagent'"'"'s tool result and a session below the threshold are not; where declared, it is held once at a stop, a line said first spares no block, and nothing is said after one\n'

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
