#!/usr/bin/env bash
# Portulan workspace — verify recipe: the spend ledger reproduces its fixtures' known totals, reports a
# hybrid session's local receipts on their own line, and the restart advisory speaks once.
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
HYBRID=cli/fixtures/ledger-hybrid
REAL=cli/fixtures/ledger-real-session
HYBRID_SESSION="$HYBRID/projects/-work-hybrid/hybrid.jsonl"
HYBRID_SUBAGENT="$HYBRID/projects/-work-hybrid/hybrid/subagents/agent-local-worker.jsonl"
PAST_THRESHOLD="$FIXTURE/projects/-work-demo--claude-worktrees-w1/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jsonl"
BELOW_THRESHOLD="$FIXTURE/projects/-work-demo/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jsonl"

# node exits 1 on a missing file, which would read as a red verdict.
for file in cli/ledger.mjs cli/advisory.mjs "$FIXTURE/fixture.json" "$REAL/fixture.json" "$REAL/claude.json" "$REAL/capture.json" "$REAL/projects/-work-portulan-real-session/real-session.jsonl" "$HYBRID/fixture.json" "$HYBRID/claude.json" "$HYBRID_SESSION" "$HYBRID_SUBAGENT" "$PAST_THRESHOLD" "$BELOW_THRESHOLD"; do
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

node cli/ledger.mjs --fixture "$REAL"
real=$?
printf '\n'

node cli/ledger.mjs --fixture "$HYBRID" >"$tmp/hybrid"
hybrid=$?
cat -- "$tmp/hybrid"
printf '\n'
local_line=0
# The fixture's figures pin the counts; these pin the sentence a reader is shown.
if ! grep -q '^  local worker: 4 line(s) in the runner'"'"'s receipt format, from Bash results in 1 session(s), at \$0\.00, none of it in the host'"'"'s tokens or the restart threshold: in 5,017 tokens, ' "$tmp/hybrid"; then
    printf '  ✗ ledger: the hybrid session'"'"'s local receipts were not reported on their own line at $0.00\n'
    local_line=1
fi
if ! grep -q '^  restart: session hybrid is at 43,601 tokens and is below its threshold of 76,006 = ' "$tmp/hybrid"; then
    printf '  ✗ ledger: the hybrid session was not given the host'"'"'s finite restart threshold of 76,006\n'
    local_line=1
fi
[ "$local_line" -eq 0 ] && printf '  ok ledger: the hybrid session reports its local receipts on their own line at $0.00, beside the host'"'"'s tokens and its finite restart threshold\n\n'

# Built by node, so a JSON encoder escapes any quote or backslash in a path.
hook_payload() {
    node -e 'const [session_id, transcript_path, hook_event_name, agent_id, active] = process.argv.slice(1);
        process.stdout.write(JSON.stringify({ session_id, transcript_path, hook_event_name, ...(agent_id ? { agent_id } : {}), ...(active ? { stop_hook_active: active === "true" } : {}) }))' \
        "$1" "$root/$2" "$3" "${4:-}" "${5:-}"
}

advisory=0
# Output goes to a file, never a command substitution, whose subshell would lose advisory=1.
call_hook() {
    local mode=$1 event=$2 session=$3 transcript=$4 out=$5 agent=${6:-} active=${7:-}
    local figures=()
    [ "$mode" = stop ] && figures=(--horizon 20 --resume-tokens 0)
    hook_payload "$session" "$transcript" "$event" "$agent" "$active" | node cli/advisory.mjs "$mode" ${figures[@]+"${figures[@]}"} >"$tmp/$out"
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
if ! grep -q '"hookEventName":"PostToolUse","additionalContext":"Portulan restart advisory: after [0-9][0-9,]* requests, context .*threshold 80,004' "$tmp/tool"; then
    printf '  ✗ advisory: the session past its threshold was not told with its first tool result, with its requests and assumptions; it printed: %s\n' "$(cat -- "$tmp/tool")"
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
stop stop-provoked "$PAST_THRESHOLD" stop-provoked "" true
stop stop-provoked "$PAST_THRESHOLD" stop-unprovoked "" false
if [ -s "$tmp/stop-provoked" ] || ! grep -q '^{"decision":"block"' "$tmp/stop-unprovoked"; then
    printf '  ✗ advisory: a provoked stop was held (%s) or consumed the next ordinary stop (%s)\n' "$(cat -- "$tmp/stop-provoked")" "$(cat -- "$tmp/stop-unprovoked")"
    advisory=1
fi
stop stop-past "$PAST_THRESHOLD" stop-first
stop stop-past "$PAST_THRESHOLD" stop-second
tool stop-past "$PAST_THRESHOLD" stop-after
tool stop-told "$PAST_THRESHOLD" stop-told-line
stop stop-told "$PAST_THRESHOLD" stop-told
stop stop-below "$BELOW_THRESHOLD" stop-below
if ! grep -q '^{"decision":"block","reason":"Portulan restart advisory: after [0-9][0-9,]* requests, context .*threshold 80,004.*consider a handoff and restart if these estimates still fit the task\. Said once\."}$' "$tmp/stop-first" || grep -q 'finish' "$tmp/stop-first"; then
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
[ "$advisory" -eq 0 ] && printf '  ok advisory: the session past its threshold is told once, at its first prompt or with its first tool result, and never twice; a subagent'"'"'s tool result and a session below the threshold are not; with an explicit horizon and resume expense, it is held once at a profitable stop, a line said first spares no block, and nothing is said after one\n'

node cli/fixtures/advisory-crossing/verify.mjs
trace=$?
node cli/fixtures/ritual-cap/verify.mjs
cap_trace=$?

# Could-not-run outranks red: a run that judged nothing cannot vouch for the one that did.
worst=$advisory
[ "$local_line" -eq 1 ] && worst=1
could_not_run=0
for status in "$fixture" "$real" "$hybrid" "$trace" "$cap_trace"; do
    case "$status" in
        0) ;;
        1) worst=1 ;;
        2) could_not_run=1 ;;
        *)
            printf 'verify: the ledger exited %s, which is not a verdict it documents — refusing to translate it into one\n' "$status" >&2
            exit 2
            ;;
    esac
done
[ "$could_not_run" -eq 1 ] && worst=2

case "$worst" in
    0) printf '\nGREEN — verify recipe passed.\n'; exit 0 ;;
    1) printf '\nRED — verify recipe failed; "done" is blocked.\n'; exit 1 ;;
    *) exit 2 ;;
esac
