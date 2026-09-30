#!/usr/bin/env bash
# Portulan workspace — verify recipe: every *.test.mjs under cli/ passes.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in awk dirname find mktemp node rm tee tr wc; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

# Not piped into `wc`: on an unreadable directory `find` exits 1 yet still lists a plausible subset.
tmp=$(mktemp) || exit 2
trap 'rm -f -- "$tmp"' EXIT

if ! find cli -name '*.test.mjs' -type f >"$tmp"; then
    printf 'verify: find failed while enumerating test files — cannot establish what would run\n' >&2
    exit 2
fi

count=$(wc -l <"$tmp" | tr -d '[:space:]')
case "$count" in
    '' | *[!0-9]*)
        printf 'verify: could not count test files (got "%s") — refusing to guess\n' "$count" >&2
        exit 2
        ;;
esac
# `node --test` exits 0 on a glob that matches nothing.
if [ "$count" -eq 0 ]; then
    printf 'verify: no test files found under cli/ — refusing to report green having run nothing\n' >&2
    exit 2
fi
printf 'tests: %s test file(s) found\n' "$count"

out=$(mktemp) || exit 2
trap 'rm -f -- "$tmp" "$out"' EXIT
# Quoted so node, not bash, expands `**`; recursive to run the same files `find` counted.
node --test "cli/**/*.test.mjs" 2>&1 | tee -- "$out"
codes=("${PIPESTATUS[@]}")
status=${codes[0]}
if [ "${codes[1]}" -ne 0 ]; then
    printf 'verify: tee exited %s, so the runner'"'"'s output was not all kept or shown — could not run rather than a verdict\n' "${codes[1]}" >&2
    exit 2
fi
if [ "$status" -ne 0 ]; then
    failed=$(awk -v root="$(pwd -P)/" '
        /^[ \t]*not ok [0-9]+ - / { if (pending != "") print "  " pending; line = $0; sub(/^[ \t]*not ok [0-9]+ - /, "", line); pending = line; next }
        pending != "" && /^[ \t]*type: \047suite\047/ { pending = ""; next }
        pending != "" && /^[ \t]*location: / {
            loc = $0; sub(/^[ \t]*location: \047/, "", loc); sub(/\047$/, "", loc)
            if (index(loc, root) == 1) loc = substr(loc, length(root) + 1)
            print "  " loc " — " pending; pending = ""; next
        }
        pending != "" && /^[ \t]*(ok|not ok) [0-9]+ / { print "  " pending; pending = "" }
        END { if (pending != "") print "  " pending }
    ' "$out")
    if [ -z "$failed" ]; then
        printf '\ntests: the runner exited %s and named no failing test; its own lines above say why\n' "$status"
    else
        n=$(printf '%s\n' "$failed" | wc -l | tr -d '[:space:]')
        # The count again after the list, so it survives a 25-line tail that more than 23 names would overflow.
        printf '\ntests: %s failing test(s), where each is and its name:\n%s\ntests: %s failing\n' "$n" "$failed" "$n"
    fi
fi
exit "$status"
