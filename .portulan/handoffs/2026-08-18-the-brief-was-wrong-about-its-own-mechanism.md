# Handoff — the brief was wrong about its own mechanism

**Post-M7 hardening, session 21. Full lane.** No milestone row moves. Two pull requests merged, eight
issues closed, one issue filed. `main` `e43d3c5` → `4f9fa4d`, suite **1691 → 1706**, twelve workspace
recipes plus the pack recipe green on the merged tree rather than on either branch.

**The arrangement, and where it did not hold — stated first because it qualifies everything below.**
The implementer ran as **`claude-fable-5`** where the arrangement names Opus 5. `/model claude-opus-5`
was issued at boot, printed *"Set model to claude-opus-5"*, and the next turn's context still read
fable — the 2026-07-30 failure mode, now a **second sighting**, and the recorded ruling for it is
restart. It was surfaced to the maintainer before any outward act; he restated the contract and then
instructed the session to proceed. **So no valid pre-commit checkpoint stands behind either pull
request** — a Fable-supervised one would be same-model, which the record already treats as void, so
none was run rather than one being run for the look of it. Both pull request bodies say so. The
compensation was measurement: every claim below is something the tree was made to demonstrate.

## The subject: three of the four briefs in batch two were wrong about their own mechanism

Not wrong that a defect existed — wrong about *what it was*. A fix written to the stated reason would
have been justified by something that does not happen, and in one case would have introduced a defect.

**[#209](https://github.com/sleepy-panda-works/portulan/issues/209)** said the recipes "split file
lists on newlines" and would mis-split a filename containing one, "into two paths that do not exist."
Measured on a repository built to hold `we<LF>ird.md` and `café.md`: **git C-quotes a newline
regardless of `core.quotePath`** — both settings measured — so it arrives as the single line
`"we\nird.md"`. Nothing splits. The real defect is one layer along and strictly wider: **the quoted
form is not the path**, and its reachable case is an accented filename, not an exotic one. So the class
is `core.quotePath=false`, not `-z`. And **the issue's prescribed repair would have armed a
collision**: `docs.sh`'s links `awk` depends on a `\001` sentinel that is safe *precisely because* the
line-based form can never deliver that byte raw. `json.sh`, one of the two files named, was already
fixed by #251. The four that were not named were the broken ones — `doctor.sh`, `index.sh`,
`plugin.sh` turning a legal tree into a **false red**, and `docs.sh`'s cli-table enumeration silently
dropping the file and passing, **the only false green of the class and the least conspicuous line in
the sweep**.

**[#254](https://github.com/sleepy-panda-works/portulan/issues/254)** swept for the NAME
`fs.*Sync = `, so it structurally could not see the same shape wearing another. By SHAPE the class is
**fourteen sites, not six** — `process.stdout.write` and `process.stderr.write` too. Eleven converted;
**three deliberately not**, because `t.mock.method` scopes a mock to the TEST and those mean a helper
call, a loop iteration, and a `process.env` restore. That last one is the measurement worth keeping:
**`t.mock.property` exists on Node 26.7.0 and throws on `process.env`** —
`ERR_INVALID_OBJECT_DEFINE_PROPERTY: 'process.env' does not accept an accessor(getter/setter)
descriptor` — because it installs the mock as a getter/setter pair. This session's own planning note
had claimed that API made the env sites convertible, reasoning from the API existing to it applying.

**[#170](https://github.com/sleepy-panda-works/portulan/issues/170)** named two carriers. There were
**seven**, including the recipe's **runtime output**, printed on every run of a required check and
named by nobody. And one of the seven was `cli/control-chars.mjs:10` — written by `0ec9cfb`, **this
session's own #208 fix, three commits earlier**. A change closing one issue added a fresh carrier of a
narrowing already sitting on the roster it was working from. Called out rather than folded in.

**[#257](https://github.com/sleepy-panda-works/portulan/issues/257)** was the one whose brief held, and
it left the arm choice open. **Arm 1**, and the reason is the neighbouring line: `README.md:204` does
not merely list dependencies, it makes `docs.sh` the REASON something else is safe; and #255 hit this
same choice on the cli-table extraction *in this same file* and chose POSIX `sed`. Arm 2 would have
reversed that decision one screen from where it was made. Equivalence of the POSIX `awk` replacement
was **measured, not argued**: byte-identical output over all 288 tracked markdown files, 3064 lines,
plus the awkward cases by hand — including the nested-parenthesis truncation, a documented Known limit
preserved deliberately.

## The gate that guards the commission has the commission's own defect

Filed as [#286](https://github.com/sleepy-panda-works/portulan/issues/286). During a GitHub incident
Copilot returned a review whose entire body was *"encountered an error and was unable to review"*.
**`copilot-reviewed` went GREEN on it**, `mergeStateStatus` read `CLEAN`, and `portulan-agent` then
submitted a derived **APPROVED** reading *"Copilot's round … raised no inline comment"* — a positive
claim about a round that never happened.

The decisive evidence is the ordering, not the code: the approval was submitted at 05:55:08Z and the
only genuine round arrived at **05:59:44Z**, 4m36s later. It cannot have been derived from it. The
real round then found nothing, making the sentence true by coincidence — so nothing on that pull
request now distinguishes an earned approval from an unearned one.

`copilot-review.yml:354` tests *login matches* AND *commit == head* AND *state != DISMISSED*: that a
review OBJECT exists, never that a judgement happened. The adjacent case is guarded with care —
`notes_state` has an `unread` value precisely so an unreadable body never becomes a verdict — and that
guard cannot fire here, because an error notice is perfectly readable. It parses to `none`, and `none`
approves. **The guard for "I could not look" does not fire when the answer is "I looked, and it says
the reviewer could not look."**

## The lever, when a round is owed and absent

Measured while trying to obtain one. After an errored review, **`POST requested_reviewers` returns 200
with `requested_reviewers: []` in its own response body and never registers** — three attempts over
~40 minutes, nothing. A **draft→ready toggle re-ran the workflow but did not re-request.**
**`gh pr close` + `gh pr reopen` did: a real round in 200 seconds.** This is distinct from the
#248/#253 silence class, where the request *does* register and simply goes unanswered.

## Instruments that failed their own control

Six, each caught by forcing it rather than reading it, and every one cost a re-measurement.

1. **The seam grep matches SUBSTRINGS.** `SENT` matched inside "PRESENT" and "SENTENCE", `EVERY` inside
   "EVERYWHERE", `Code` inside `exitCode`. Every hit has to be adjudicated against both sides — and the
   real cost of the noise is that it is how a true positive gets waved through.
2. **A seam control that tested nothing.** The first one planted three invented company names and
   confirmed the grep did not find them — but they were never on the term list, so the control could
   only ever pass. Replaced with terms drawn from the list itself.
3. **A poll that could not tell silence from an outage.** It reported "no review after 500s" while the
   reads inside it were 404ing.
4. **`git log -1 <sha>` with a revision before it prints the TIP**, not that commit. It confirmed a
   memory-carried SHA that it had never actually looked at. `git blame --porcelain` is the honest form.
5. **A "real round arrived" filter that matched the workflow's own derived verdict** — the very
   artifact under investigation.
6. **A shape sweep too broad to be a roster**, catching local fixture mutation alongside shared-object
   patching. Narrowed to named shared objects before it was trusted.

## Also

**[#141](https://github.com/sleepy-panda-works/portulan/issues/141) closed by comment, no code.** The
guard it asks for is at `cli/doctor.mjs:1601`, blamed to **`6165218` (2026-08-09, the maintainer's own
hand)**, pinned by six variants plus a padded-slug boundary, all green. It outlived its fix by nine
days because that commit cites the issue in a **code comment and never in its message**, so nothing
linked them.

**`cli/README.md` owed rows for both new rails**, and the cli-table check caught it at
`52 file(s), 50 row(s)` the first time it ran *after* they were committed. The recipes had been run
before those commits, when the files were untracked and therefore invisible to `git ls-files`. **A
check that only sees committed state has to be run against committed state.**

## Where this leaves things

`main` = `4f9fa4d`. No pull request open. **#286 is the one thing filed and unanswered** — two repair
arms, the choice left to the maintainer because the trade is how much vendor-prose coupling the gate
should carry. The merge condition it undermines is unchanged in doctrine and now known to be
satisfiable by an artifact that judged nothing.

Both rails added here — `cli/list-quoting.live.test.mjs` and `cli/test-isolation.live.test.mjs` — were
red before their fix and named the exact sites, because in both cases a comment beside a fix is what
let the class survive to a second, third and fourth site.
