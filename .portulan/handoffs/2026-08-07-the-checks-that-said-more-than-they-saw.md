# Handoff — the checks that said more than they saw

**State.** Three items off the board's **Now** column, one pull request each, all open and none merged:
[#165](https://github.com/sleepy-panda-srl/portulan/pull/165) (issue #92),
[#166](https://github.com/sleepy-panda-srl/portulan/pull/166) (issue #91),
[#167](https://github.com/sleepy-panda-srl/portulan/pull/167) (issue #68). Each branches from `main`
at `d2d8f2a` independently, so they merge in any order; #165 and #166 touch
[`../../cli/index.mjs`](../../cli/index.mjs) in different functions and do not overlap textually. Suite
983 → 986 · 987 · 1014 respectively. All nine recipes green on #167, all eight on the other two.

**Decisions + why.**

- **#92 counts budgets JUDGED, never budgets declared** — because `lines` and `columns` are measured
  against the rendered index, so a manifest declaring them under no `index.path` has neither judged.
  Counting declarations would have fixed the sentence in one shape and left the identical false green
  standing in the other. Reachable only from a manifest `doctor` rejects, and `index` does not require
  `doctor` to have run — the two tools have no ordering, which this file already relies on elsewhere.
- **#91 fixed its sibling in the same stroke** (ruling of 2026-07-27, PR #43). `judgeScopes` guarded a
  location check with `fs.existsSync`, which is a `stat` that answers false for **every** failure. A
  persona layer at mode `0400` is readable and not searchable, so every declared location under it
  stat-ed false and was skipped as absent — and the refusal three lines below, whose comment promises
  *empty means readable-and-zero, never could-not-look*, was unreachable. Measured on a scratch tree
  before it was fixed: `readdir` lists the child, `existsSync` on it returns false, `readdir` on it is
  `EACCES`. The neighbour at `cli/index.mjs:498` was checked and deliberately left — every way it can
  fail makes the read below it fail too, which is already an `IndexError`.
- **#68's binary sniff is REFUSED, and the incident is the argument** — every binary test in general
  use is keyed on NUL, which is why `file` called the defective source *binary data*. A check that
  skipped what `file` and `git` call binary would have skipped the one file it exists to catch. The
  exemption is therefore a **named path** in [`../verify/control-chars.sh`](../verify/control-chars.sh),
  audited both ways at exit 2: an entry naming nothing scanned is stale, an entry over a clean file is
  dead. The array is empty and that is the live state — this tree tracks no binary file.
- **CR is refused too**, which is a decision rather than an oversight: no tracked file carries one, so
  the rail costs nothing today and stops CRLF arriving unnoticed in a tree that is uniformly LF.
- **The scanner lives in [`../../cli/control-chars.mjs`](../../cli/control-chars.mjs) with a suite**,
  not in the wrapper, so it is not in `workflow-filters.sh`'s position of being verified only by being
  run. Its fixtures build forbidden bytes with `String.fromCharCode`: one carried literally would be a
  tracked file the check must red on, and a rail red on its own tests is a rail somebody switches off.

**What was measured rather than reasoned.** The original incident reproduces: `grep -n "identity = "`
exits **1** against a line that plainly contains that text, `file` says `data`, and the new recipe reds
naming the byte offset, the line, the byte column and `NUL`. Forced red four ways — that NUL, a CRLF, a
dead exemption, a stale one — under bash 3.2 as well as 5, because an empty array under `set -u` aborts
on the system bash macOS ships. **None of the three has been seen red in CI**, and the register in
[`../verify/README.md`](../verify/README.md) says so rather than implying otherwise.

**Open questions.** Whether `control-chars` ever joins the eight subcommands
[`../../docs/vision.md`](../../docs/vision.md) names is the maintainer's call, so it is not wired behind
the entry point — `plugin-lint`'s position, for `plugin-lint`'s reason. Whether the `EXEMPT` array
should instead be carried by `.gitattributes`, so git's own binary declaration and this check's have one
carrier rather than two, was considered and deferred: this tree has no `.gitattributes` and introducing
one changes diff, merge and eol behaviour for a file that does not exist yet.

**Next action.** The three pull requests are the maintainer's gate. No supervisor checkpoint was run
this session — a gap, not a scale-down.

**Recoverability.** Nothing is left partial. No branch is merged, `main` is untouched, and each branch
stands alone.
