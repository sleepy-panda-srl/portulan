**type:** rule
**scope:** workspace — Portulan's build sessions
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/blob/main/.portulan/handoffs/2026-07-25-ci-runs-declared-recipes.md`

**Never read `$?` after a pipe.** In `bash` and `zsh`, `cmd | sed …; echo $?` reports **`sed`'s** status,
not `cmd`'s — and `sed` almost always succeeds, so every forced-red measurement taken that way prints `0`
and reads as a green. Measure the command alone, redirect its output if it is in the way, and read the code
on its own line:

```sh
cmd >/dev/null 2>&1; printf 'exit %s\n' "$?"
```

`set -o pipefail` fixes it only inside a script that sets it, and `PIPESTATUS`/`pipestatus` differ between
the two shells — so the rule is the shape above rather than a flag to remember.

**Why this is a rule and not a note.** It has now produced a wrong measurement **twice**. On 2026-07-25 a
verify step's exit code was read through `tail` and reported `tail`'s status, in the change whose whole
subject was a check that must fail closed. On 2026-07-30 it happened again while forcing the three controls
of milestone 6's landing clause red: all three printed `exit 0` beside their own correct red *messages*, and
the only reason it was caught is that a red message next to a zero is visibly incoherent. A control that
reports success is worse than no control, because the transcript then reads as evidence.

**What makes it dangerous rather than merely wrong:** the failure is silent and it is biased toward the
answer the author wants. A red misread as green ends the investigation; a green misread as red does not.
Every forced-red demonstration in this repository is exactly this shape, so the class touches the one
practice the build relies on most.

**Retire when:** every measurement of an exit code in this repository's records and recipes runs through a
helper that cannot be piped — at which point the mistake is unavailable rather than merely known. Grep-able
part: no line in `.portulan/verify/` or a session record should contain `| ` and `$?` together.
