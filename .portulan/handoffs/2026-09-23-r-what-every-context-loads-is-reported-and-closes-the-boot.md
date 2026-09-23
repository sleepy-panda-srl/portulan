# Handoff — 2026-09-23: what every context loads is reported, and closes the boot

**What landed.** Item 4 of proposal `0036`'s order of work: the `doctor` report and the boot's closing
figure. [`cli/doctor.mjs`](../../cli/doctor.mjs) gives every workspace a `context` finding: Claude Code's
always tier in the repository the manifest's `tree` names, in bytes and in tokens at the declared ratio or
`0036`'s estimate, its three largest files and what each is (the instructions, an import and its depth, a
rule, a description), how many path-scoped rules sit on-path beside it, how many imports or links out of the
repository load uncounted, the Portulan plugin's descriptions, and the budget. It is a note by default. It
fails only over a declared `context.always.budget.tokens`, or where a declared budget cannot be judged (no
tree, a file it cannot read, a malformed key), because a budget nothing measured must not read as met. The
line is [`cli/context.mjs`](../../cli/context.mjs)'s `alwaysLine`, and `context --brief` prints the same
line for the boot: step 5 of the [boot skill](../../plugin/skills/portulan/SKILL.md) asks for it, run with
step 3's reads so it costs no request of its own, and its reason is under step 5 in the skill's on-read
[`rationale.md`](../../plugin/skills/portulan/rationale.md). One judgement of the budget, `judgeBudget`,
serves the full report and the line, and the full report's output is byte for byte what it was.

**Measured on `457b0b6`, before and after.** The skill went 8,917 → 9,111 bytes (+194), so the engine half
is 12,019 of its 12,062 rail, 43 bytes of headroom; this repository's boot read-set went 88,947 → 89,141
(82,086 without the manifest), 1,585 bytes under its rail, and the demo's 35,393 → 35,587 (33,785). The
line the boot prints here is 501 bytes. **No rail moved**: this change adds what `0036` asks the boot to
say, and demotes nothing, so nothing was raised and nothing is owed a lower line. The context drill put
510 bytes on the kernel, which would have left the demo's boot rail 4 bytes clear of firing beside the
engine rail; it puts 408 now, so the one rail that owns the kernel is still the one that fires, checked
by applying it.

**Five calls, the coordinator session's.** Drafted as this change's defaults and confirmed by the
coordinator session at 19:42 UTC as its delegated calls, made on the maintainer's delegation on the
criterion of the better performance enhancement. `--brief` is a flag on the measurement module and not a
ninth subcommand: `0036` reaches the measurement through `doctor` and a recipe, step 2a of the boot
already runs a module from the bundle, and the line is 501 bytes here where `doctor`'s whole output would
be several kilobytes on every boot. Only the always tier is in the line: the boot read-set is the boot's
own on-invoke cost, and the full report's. Nothing in the line waits on the boot read-set, so a slot
naming nothing, which `doctor` fails on its own, withholds no figure. A pointer is said and not measured,
#441's limit: it declares no tree, so the repository it sits in has no declared root, and `doctor`'s
pointer report now names the always tier's report, and the legibility score it also omitted, among the
checks that did not run. A failure over a declared budget is not a MAJOR: 2.9 defined the key as a rail,
`0036` has `doctor` fail only where one is declared, no manifest shape changes, and no workspace in this
tree declares one. And the engine rail stays at 12,062 with 43 bytes of headroom: a rail is raised only
with a reason and lowered on a demotion, so the next byte on the skill or the kernel must demote one.

**Records it corrects.** [`core/operating/context.md`](../../core/operating/context.md) said nothing
measures the always tier; its *What is machinery today* now says what does, and what is still to land.
[`spec/slots.md`](../../spec/slots.md) said nothing checks the budget, and keeps those words in a dated
note beside what checks it now. The comment on `doctor`'s budget check said nothing consumes the key.
[`cli/payload.mjs`](../../cli/payload.mjs) drops `context.mjs` from `PRODUCT`, since `doctor` imports it
and it classifies as `imported`, which the `payload` rail would otherwise have failed as a stale entry; so
[`cli/README.md`](../../cli/README.md) counts fourteen modules reachable from nothing, not fifteen.

**How it was checked.** Ten new cases in [`cli/context.test.mjs`](../../cli/context.test.mjs): the largest
files in order and what each is, what sits on-path and what loads uncounted, a line that does not move with
the directory it runs from, the full report judging the same budget in the same words, exit 2 only where a
declared budget cannot be judged, a malformed key, a pointer, a slot naming nothing, a plugin it cannot
read, and `--rail`, `--repo` or a second `--brief` refused. Six in
[`cli/doctor.test.mjs`](../../cli/doctor.test.mjs), among them row 12's first demonstration in miniature (a
declared budget forced over is red, and the same words moved into a rule `paths:` scopes return it green
with nothing raised) and `doctor`'s finding equal to the boot's line on one fixture.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38 (no fresh-context runs unless he asks).
The coordinator session reviewed the diff before the commit; his review is on the pull request.

**Green in this container needs a non-root run.** As root, `tests` fails its permission cases, because a
chmod-000 fixture never denies root. All 28 recipes ran green as a non-root user on a copy of this tree.

**Next action.** His review of the pull request. Then `0036`'s item 5, the Claude Code compile targets and
the degradation report. The exact mode, and measuring the repository a pointer sits in, stay open.
