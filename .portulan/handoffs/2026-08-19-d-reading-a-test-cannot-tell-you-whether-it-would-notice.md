# Handoff — reading a test cannot tell you whether it would notice

**Session:** 2026-08-18 into 2026-08-19, a verification-and-close commission in a context that did not
implement the work. Verbatim scope: *"verify that issue #284's ruling has fully landed on `main`, then
close #284 with the evidence"*, then *"get the gotchas file down to 60 lines, if it can't be helped then
let's consider increasing the budget"*, then *"update the lessons artifact with today's ledger entry"*,
*"open the artifact and check the render"*, *"fix the §XII overflow too"*.
**No milestone row moves. No repository change was made and nothing was merged** — the only commit this
session produced is this record: the handoff, the regenerated index, and the Session log entry.

## State

[#284](https://github.com/sleepy-panda-srl/portulan/issues/284) is **CLOSED/COMPLETED**, closed
2026-08-18T15:38:26Z on evidence re-derived here rather than read from
[#288](https://github.com/sleepy-panda-srl/portulan/pull/288) (merged `f1a8c11`; 15 commits, 4 files,
+293/−218, 59 review objects). Verified against `main` at **`48ece93`**, where the repository-wide suite
was **1714/1714** and **fourteen** recipes green; `main` has since moved several times and those figures
are stamped, not current. The lessons artifact carries a new **§XVIII** and its narrow-viewport overflow
is repaired. Session memory's per-file budget is now stated in **words**.

## The five clauses, and why they were cheap to settle

The ruling of 2026-08-18 06:04 stated its acceptance criterion **before a line was written** — five
clauses, each decidable. That is the whole reason a fresh context could close the issue in an afternoon:
cut a real bundle from `origin/main` and inspect the bytes, never once trusting the pull request's
description of itself.

- **`LICENSE` ships** — present in the cut at 11,346 bytes, sha256 `de418176…`, **byte-identical** to
  `git show origin/main:LICENSE`.
- **Every machine-read `license` reads `Apache-2.0`** — a walk written *here*, not imported from the
  module: all 21 `.json` in the cut, every depth, every type. Four fields, all Apache, zero others.
- **The guard refuses anything else** — hostile fixtures: a rostered manifest flipped to each of five
  value types (string, npm's historic object, array, null, number), a `license` nested at depth in an
  unrostered file, and all three `SELF_EXCLUDED` paths planted. Every one refused, each with its own
  diagnosis. End-to-end through the CLI: **exit 1**, never a crash-as-verdict at 2.
- **`EVAL-STAMP.json` records Apache** — plus `license_file` pointing at the terms, with the issuance
  record kept as its own field.
- **The refusal is proven positively** — see below; this is the one that could not be read.

**One fidelity note, kept rather than rounded up:** end-to-end, a *rostered* manifest drifting off Apache
is caught by `assertCensus` **before** `auditCut` runs. Both are exit 1, so the clause holds either way —
but the refusal on that path is the cut's, not the guard's, and the close said so.

## The finding worth carrying

**Whether a test would notice a defect is not visible in the test.**

The fifth clause asked that the suite prove the refusal *positively rather than by absence*. A suite
asserting *no non-Apache field survives a clean cut* and a suite asserting *a planted field is refused,
named, with the value it saw* read almost identically on the page. They differ in exactly one respect:
what happens when the guard stops working. Reading the assertions cannot distinguish them — so the check
is not to read them.

Neutering `auditCut` with an early `return` turned **exactly six** tests red: precisely the block named
*"the guard, fed cuts built to deserve refusal"* — whose two pass-path tests stay green by design.
Proof-by-absence would have stayed green. Two controls
confirmed the other clauses are pinned rather than vacuously so — removing `LICENSE` from `PAYLOAD` →
**23** red; flipping the stamp to MIT → **17** red. The tree was restored and re-measured clean after
each.

**The general rule: when a criterion is about the strength of a check, break the thing under check and
watch.** This is the sibling of the four instruments recorded in *the instrument that could not see the
thing it was asked about* — there the instrument could not see its subject; here the instrument is
perfectly able to see it and still cannot tell you whether it is load-bearing.

## Four instruments that lied, in one session

- **`cp -R .` in a worktree does not isolate a repository.** `.git` is a **pointer file**, so every git
  command in the "copy" drove the real gitdir: three fixture commits landed on the live branch and the
  real index was mutated. Nothing was pushed; `git reset --hard` recovered it. **What surfaced it was
  `verify/eval-bundle.sh` going red about a planted `spec/planted.json` — the guard under audit caught
  the auditor's own contamination**, and only because `--check` reads the INDEX, the limit that recipe
  names about itself in its own header. Isolation was assumed, not measured.
- **A cached page reported a working fix as failed.** After editing the stylesheet the reloaded CSSOM
  still showed the old rule; the file, the preview and `curl` all had the edit. Browser cache. A
  cache-busting query string settled it. Worse, the reading I had taken as *evidence the fix applied* —
  a `1fr` track computing to 206px — is what that track computes to anyway.
- **A word count read off a file another session was still writing.** `portulan-gotchas.md` measured 850
  words at one moment and 797 minutes later, with no edit of mine between. A number read off a moving
  target is not a measurement.
- **Injected CSS lost to the document's own stylesheet.** A `.chip` rule added to `<head>` was beaten on
  document order by the artifact's `<style>`, which sits in `<body>` at equal specificity — so the
  experiment reported the approach wrong when only the delivery was.

## Decisions + why

- **A line budget was replaced with a word budget.** The standing per-file memory cap was **~60 lines**.
  Lines charge a file for its **wrap width**, not its cost: the index passed at 127 characters per line
  while the gotchas file failed at 99 — identical tax per token. Worse, the cheapest way to pass was a
  rewrap, and one such squeeze **split a shell command across a line break**, making it uncopyable and
  ungreppable in a file whose entire value is copy-pasteable measured facts. The rule is now **≤ ~800
  words**, carrying that measurement. *A budget you can satisfy by reflowing is not a budget.*
- **The §XII overflow was fixed in the stylesheet, not the record.** Dated sections stand as written, so
  the repair changed three CSS rules and **no section's content**. Root cause: a grid item defaults to
  `min-width: auto`, so a `nowrap` pill forced its track wider than the page. Measured at 320px:
  **21 overflowing elements across six sections → 0**; unchanged at 753px and 1265px, where all 122 chips
  still render on one line. Fixing only §XII — the reported symptom — would have left four other sections
  broken, and the first attempt did exactly that.
- **The incident is inside the record rather than omitted.** Lesson 13 in §XVIII is the `cp -R`
  contamination. A verification that hides its own incident is worth less than the incident costs.

## Instruments and rounds

- **No checkpoint or review round during the verification itself**, correctly — it changed no repository
  file. The one diff it produced is this record, and that **was** graded at pre-commit; the verdict is in the
  Session log entry. The grading the session itself did was of *someone else's merged work*, and the
  instrument was re-derivation — own walk, own fixtures, own mutations — not a reading of #288.
- **The render was judged by measurement, not by eye.** The in-app browser is not signed in to claude.ai
  (a private artifact 404s) and Claude in Chrome was not connected, so the page was served locally; its
  screenshot paints backgrounds but not text. Computed styles, `getBoundingClientRect` and an overflow
  sweep answered what a screenshot could not.
- **Memory was consolidated to the new budget**: eight files, all within ~800 words, zero split code
  spans, every command contiguous. Two stale facts fell out on the way — an installations endpoint still
  naming the pre-rename org, and a recipe count from before the set reached fourteen.

## Open questions

- **Does the §XVIII repair want a rail?** Nothing in the verify set looks at the lessons artifact, so the
  next section added can reintroduce the same overflow and no check will say so. Whether that artifact
  deserves a rail at all is a product call, not an obvious yes.
- **The filename letter is unwritten, unread — and it went stale between the checkpoint and the push.** No
  tool or document defines it: `docs.sh` checks only the leading `YYYY-MM-DD`, and `cli/index.mjs` sorts
  same-date files in reverse slug order while explicitly disclaiming any claim about which was written first.
  The checkpoint measured `-c` as the day's next unused letter and passed it. **By the time this branch was
  pushed, another session had landed its own `2026-08-19-c-` on `main`**, so this file is `-d` — a fifth
  instance of the session's own subject, and the cheapest one: a letter measured against a tree that moved.
  **Whether the series wants a defined convention at all is open**, and it is a naming question for whoever
  writes the records — but *unwritten and read by nothing* is exactly the condition under which two sessions
  pick the same letter.
