#!/usr/bin/env bash
# Portulan workspace — verify recipe: every .json file in the tree parses; doctor checks the schema.
#
# Exit 0 green · 1 red · 2 could not run.

set -uo pipefail

for need in dirname git grep mktemp node rm sed tr wc; do
    command -v "$need" >/dev/null 2>&1 || {
        printf 'verify: %s not found — this recipe needs it; see .portulan/verify/README.md\n' "$need" >&2
        exit 2
    }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd -- "$root" || exit 2

tmp=$(mktemp -d) || exit 2
trap 'rm -rf -- "$tmp"' EXIT
status=0

fail() { status=1; printf 'FAIL  %s\n' "$1"; }
pass() { printf 'ok    %s\n' "$1"; }

# -z: git C-quotes a non-ASCII name otherwise, and that file would go unparsed without a word.
manifest="$tmp/manifest"
if ! git ls-files --cached --others --exclude-standard -z >"$manifest"; then
    printf 'verify: git ls-files failed — cannot enumerate the tree\n' >&2
    exit 2
fi

# ---------------------------------------------------------------------- 1. parse
node -e '
    const fs = require("fs");
    const buf = fs.readFileSync(0);
    const names = [];
    const undecodable = [];
    let start = 0;
    for (let i = 0; i <= buf.length; i += 1) {
        if (i !== buf.length && buf[i] !== 0) continue;
        if (i > start) {
            const chunk = buf.subarray(start, i);
            const text = chunk.toString("utf8");
            // A round trip, not a search for U+FFFD, which a name may legitimately contain.
            if (Buffer.from(text, "utf8").equals(chunk)) names.push(text);
            else undecodable.push(chunk);
        }
        start = i + 1;
    }
    // The backslash is escaped too, so a name holding the text \xff prints unlike the byte 0xff.
    const show = (c) => Array.from(c).map((b) => (b === 0x5c ? "\\\\" : b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "\\x" + b.toString(16).padStart(2, "0"))).join("");
    const displayPath = (f) => show(Buffer.from(f, "utf8"));
    if (undecodable.length) {
        for (const chunk of undecodable) process.stderr.write("a tracked pathname is not valid UTF-8: " + show(chunk) + "\n");
        process.stderr.write("refusing to report on " + names.length + " file(s) beside " + undecodable.length + " pathname(s) this recipe cannot name\n");
        process.exit(2);
    }
    const files = names.filter((f) => f.endsWith(".json"));
    process.stderr.write(String(files.length));
    for (const file of files) {
        if (!fs.existsSync(file)) continue;   // tracked but deleted in the working tree
        try {
            JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (e) {
            // Escaped: the shell counts this report in lines, and a name may hold a newline.
            process.stdout.write(displayPath(file) + " -> " + String(e.message).split("\n")[0] + "\n");
        }
    }
' <"$manifest" >"$tmp/bad" 2>"$tmp/count"

# On success stderr holds the count alone, so anything else there is node failing: exit 2.
count=$(cat "$tmp/count")
case "$count" in
    '' | *[!0-9]*)
        printf 'verify: node wrote no count — it failed while parsing, or refused the file list\n' >&2
        sed 's/^/        /' "$tmp/count" >&2
        exit 2
        ;;
esac

if [ -s "$tmp/bad" ]; then
    fail "parse — $(wc -l <"$tmp/bad" | tr -d '[:space:]') malformed JSON file(s)"
    sed 's/^/        /' "$tmp/bad"
else
    pass "parse — $count JSON file(s) parse"
fi

printf '\n%s\n' "$([ "$status" -eq 0 ] && printf 'GREEN — verify recipe passed.' || printf 'RED — verify recipe failed; "done" is blocked.')"
exit "$status"
