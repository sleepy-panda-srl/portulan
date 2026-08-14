# Handoff — a measurement's authority is not its author

**Post-M7 hardening, session 17. Full lane.** No milestone row moves: M7 closed in session 15 and nothing
here claims a criterion. This is the hardening queue the close left behind — eight pull requests, six issues,
a scratch sweep, and the records.

**Written by a successor context.** The implementing session ran out of context mid-queue and handed over a
state document; this handoff is the successor's, and where the two disagreed the tree was trusted over the
handoff. Supervisor: a fresh-context Fable 5 on every gate, whose own two errors are in the tally below by
name — which is the subject this document is named for.

## Where `main` went

`330df2a` → **`8eacc88b`** (#246) → **`7f25dc3`** (#248) → **`f371753`** (#251) → **`5392a90`** (#250)
→ **`57ee27e`** (#249) → **`75e0b24`** (#258) → **`5f758a2`** (#255) → **`692eaff`** (#256).
**Eight pull requests merged; zero open.**

Suite baselines, each **re-measured on its own base** rather than carried: `330df2a` 1571 · `8eacc88b` 1571
· `7f25dc3` 1571 · `f371753` 1576 · `5392a90` 1579 · `57ee27e` 1585 · `692eaff` **1590**.

## Merged

| PR | Closes | Merged | By | Truth-read |
|---|---|---|---|---|
| #246 — proposal 0029 | — | 06:01:49Z | this session, on confirm | `MERGED`, `8eacc88b`, cherry zero `+` |
| #248 — four detached docblocks | #219 | 06:19:23Z | **Marius, his own hand** | `MERGED`, `7f25dc3`, `mergedBy=marius-cetanas` |
| #251 — C1 + json.sh `-z` | #207 | 06:59:40Z | this session | `MERGED`, `f371753`, cherry zero `+` |
| #250 — affordances read once | #228 | 07:37:25Z | this session | `MERGED`, `5392a90`, cherry zero `+` |
| #249 — carrier path identity | #225 | 08:07:53Z | this session | `MERGED`, `57ee27e`, cherry zero `+` |
| #258 — the `npx` claims | — | 09:58:09Z | this session | `MERGED`, `75e0b24`, cherry zero `+` |
| #255 — the `cli/` table rail | **#203** | 10:23:21Z | this session | `MERGED`, `5f758a2`, cherry zero `+` |
| #256 — the `none` reserved check | **#205** | 11:12:22Z | this session | `MERGED`, `692eaff`, cherry zero `+` |

Filed: **#252** (rule-4 triage of two apostrophes out of #251) · **#253** (a review's `commit_id` follows the
head across a force-push, and `copilot-reviewed` reads that field) · **#254** (six tests patch an `fs` method
by assignment; `t.mock.method` is the repaired pattern, never swept).

## The things worth keeping

### 1. The calibration caught the calibrator

The supervisor's pre-merge reading of #246 was **7 threads, all answered**. The tree said **10 threads, 2
unanswered** — two suppressed notes promoted at 19:50, after the state the supervisor had measured. It had
inferred answer-state from the predecessor's report instead of measuring it. **A supervisor's measurement is
a claim too** — the same lesson the predecessor recorded about a citation inside a verdict, arriving from
the other direction. The gate held because the implementer re-measured rather than trusting the verdict.

### 2. A refusal is worth more when it carries an instrument

#246's last two notes were **verbatim re-raises** (the suppressed channel re-raises until the code changes).
Rather than restate a reading of CommonMark, the refusal was measured against **GitHub's own GFM endpoint**
on the exact bytes, then **negative-controlled**: an unclosed span makes that endpoint emit a literal stray
backtick and no `<code>` element — the symptom the note predicted. The instrument can report the failure; on
this file it does not.

### 3. #248: a stranded PR, a dead lead, and a coax that worked

`copilot-reviewed` went **red on the 20-minute budget**: re-requested at 627s, **accepted**, then the request
vanished. Silence ran **10h32m** against a ~90s norm.

- The standing lead was **App-vs-user authorship**. #248 was opened by a **user** and drew nothing. **Dead.**
- Controlled rather than assumed: ruleset `19805871` was `active`, `review_on_push: true`, PR not a draft.
  **Armed, and it did not fire.**
- Stated as a non-claim: **not** the byte-identical case, so it says nothing about diff-similarity.
- **The rebase-as-coax worked.** The rebase was mandatory anyway (`strict: true`), so coaxing the old head
  would have measured a corpse. The force-push drew a round in **82 seconds**, which found nothing.
  **The 0023 override was never needed — the question dissolved rather than being answered.**

Posted to #161 as `issuecomment-5290088310`, with three explicit non-claims.

### 4. Instrument economics: proving the input did not move beats re-running

#248 published drift figures (7→3 over 47 files) from a detector not in the tree. Instead of re-running it,
the *input* was shown identical: `git diff 971d124 53026b9 -- '*.mjs'` **empty**. Same input, same output.
Ruled the correct economics: **the input-set proof IS the re-measurement.** Suite and recipes *were* re-run,
because their inputs did move.

### 5. A silent dependency in the merge gate — `commit_id` is not a record of what was reviewed

Review `4930790766` (submitted **2026-08-13T19:20:37Z**) now reports `commit_id=53026b99`, a commit authored
the following morning: **its `commit_id` followed the head across two force-pushes**, while Copilot's own
review, submitted **nine seconds earlier**, stayed pinned to `18e130c0`. `copilot-reviewed` decides the merge
gate by reading exactly that field, and is correct only because Copilot's reviews happen to pin — relied on,
nowhere stated. Falsifier: **a Copilot review observed to mutate.** Filed as its own issue.

### 6. Four findings, and the class that kept arriving inside its own repair

- **#251 `json.sh`** — cited `control-chars.mjs` as its model for `-z` and copied **half** of it. That model's
  docblock states the fault in one line: *"the split and the decode are two different fail-opens, and only
  the first was closed."*
- **#251 `.byte`** — `{offset, byte}` answered about two different bytes. **Nothing read the field**, which is
  why three C1 tests passed over it. *An unread field is where an untrue one survives.* Fixed with an
  **invariant over both branches**, not another instance.
- **#251 round 2** — the bad-file report still interpolated the pathname raw into a **line-based** report that
  `wc -l` counts: one malformed file became **2 lines**. Demonstrated on a real `two<LF>lines.json`. **And
  fixing it exposed a defect in round 1's own helper** — `escapeBytes` escapes the backslash FIRST, and says
  why; my helper copied its shape and not its rule. The same half-copy, one turn later, in my own hand.
- **#249** — a bare `catch {}` made every errno `"absent"`. `bytesOf` already had the rule on a sibling noun.
- **#249 round 2** — my own fix left `auditCarriers`' docstring listing three states while the caller returned
  four, **and falsified the test header's claim** *"nothing here chmods a directory, so the bare `rmSync` is
  correct."* Measured: a `0o000` subdir defeats `rmSync` with **ENOTEMPTY**, so that rationale was
  load-bearing and the cleanup now depends on a `t.after` restore the comment never mentioned — one of the
  24 unrailed scratch sites **#244** records. The docstring now states **the set it knows AND the rule it
  applies**, because a doc listing an unenforced set goes stale silently.
- **#250** — Copilot's citation was **true** and its framing wrong in the direction that makes the finding
  bigger: `t.mock.method` is **2 occurrences, both in one file**, against **6 hand-rolled sites**. Not the
  established pattern — the **repaired** one, fixed once by this very finding and never swept. The seventh
  site was new, so it shipped fixed; the six are filed.

### 7. Rule 4 held against a correct finding

Round 3 on #251 raised two **correct** notes — dropped apostrophes in prose round 2 had just added, sitting
inside the comment about copying a model's rule faithfully. Two fix-rounds were already spent. **Refused the
third**: the sibling exemption covers a sibling of the defect *class*, and a typo is not one; claiming it
would have been the session granting itself the round. Triaged to **#252**, precedent #211→#213.

### 8. The 529, and recovering by measuring rather than replaying

A server-side 529 killed the session **mid-outward-act**, immediately after "posting the two approved
replies". The recovery was not to re-post: the supervisor measured first, then had the implementer attribute
a **third unresolved thread** that had appeared. Attribution was decided by `in_reply_to_id` — both replies
carried theirs, so they had landed; the third had `in_reply_to=NONE`, the 0021 promoter's preamble and a
`crc=` marker, and postdated them by 2.5 minutes. **Option (a), promoter, no double-post, nothing owed.**
A blind replay would have double-posted onto two live threads.

### 9. The label drift — both halves, and the declaring authority nobody read

PR labels were chosen by MEANING rather than from `.portulan/labels.json`'s `covers` roster, which is the
declaring authority. Measured against it, three of four were wrong: #255 carried `record` (whose covers are
`docs/plan.md`, `.portulan/handoffs/`, `CHANGELOG.md`) while touching `.portulan/verify/` — `workspace` —
and `cli/` — `mechanism`; #258 carried `record` while touching only `cli/` and `README.md`; issue #257
carried `documentation`, a GitHub default the curated roster deliberately omits. Only #256 was right.

**Both halves of how it survived belong in the record.** The implementer picked by meaning. The supervisor
corrected by eye — arguing from the label's NAME and a grep for a string, not from `covers` — and stated a
falsifiable reason, *"a nonexistent label would have made `gh` error at create"*, which issue #257 itself
refutes: `documentation` exists on GitHub, `gh` did not error, and the issue carried it. The instruction was
right by accident. **The declaring authority sat unread through three gates**, which is exactly the scenario
the 2026-07-27 ruling on #43 named — *check each against the declaring authority, not by eye* — now with a
supervisor instance beside the implementer one. All four relabels applied on approval.

### 10. The tmpdir sweep — the method is the durable half

**1248 → 502. Removed 746; appeared 0; survived 502.** Reported as a whole-name-set diff, never a prefix
count. ~5.5 MB.

The method, and **the supervisor ruled it the standard for any future sweep**:

1. **Build the roster from the declaring code**, not from a handoff's prose — 51 prefixes from every
   `mkdtempSync` literal plus the `scratch("…")` callers.
2. **Content-attribute anything the tree cannot explain.** Five prefixes existed in tmpdir and nowhere in
   the current tree. Four proved ours by content (`.portulan/`, `workspace.json`, `plugins/`), and one did
   not: **`MSBuildTemp` ×34, empty, left alone** — the lesson the constraint was written for, present in
   the actual data. The catch that vindicates the rule is **`atk-`**: 11 directories holding a real Portulan
   workspace under a name no grep of the tree would match. Name-matching alone would have missed it.
3. **Control the age filter rather than trusting it.** A freshly planted `portulan-feedback-XXXXXX` was
   name-matched by the roster and correctly excluded by `-mmin +60`, then removed.
4. **Freeze the list, then delete the list.** The command consumed a file written at census time rather
   than re-running `find` at deletion time, so no directory created between the report and the approval
   could be swept in. The delta confirms it: removed == the frozen list exactly, appeared == 0.

### 11. F and G: instruments that failed their own control before they worked

**F's rail failed twice before it worked, both in the implementer's hand.** A greedy `.*\[` captured the
LAST link on each table row instead of the first, making `stop-gate.mjs` look rowed — **the exact failure
`cli/README.md`'s own footnote describes, reproduced one command after reading it**, which is why the rail's
pattern is anchored. Then `git ls-files 'cli/*.md'` matched across `/` and the first real run went red on
four files inside `cli/fixtures/drifted-workspace/`: the hand measurement had used shell `ls`, and swapping
the instrument silently swapped the question for a broader one. `comm` was also missing from `docs.sh`'s
dependency guard.

**G's scope was re-derived rather than taken.** The brief said scope the reserved-character check to
`shell`/`write`/`read`. Tracing the code found **one regex carrying two justifications**: the DSL half does
not reach a `none` value (it is prose, reported verbatim), but a second half does — that prose is printed
into a LINE-BASED report, so `\n\r\t` still matter. A blanket exemption would have shipped a defect. The
supervisor graded the split over its own brief.

**#255's round then found three more, two of them the change's own subject:** the file exemption was audited
on half its claim (that `README.md` exists, never that it is absent from rows — so a `README.md` row would
have gone unnoticed); `grep -o` is not POSIX in the one recipe documented as POSIX-only, though `docs.sh:171`
had already breached that for as long as it existed (filed as **#257**, not folded — different class); and
the bold claim was universal with two exceptions immediately below it, false as written.


## Instrument tally — THIRTEEN, across both implementers and the supervisor

**One tally for the whole night, and the numeral equals the enumeration.** An earlier draft of this file
said *three* while section 11 two screens down described two more; that is the same defect the night kept
finding, in the record about it. The inclusion rule, stated so the count is checkable: **an instrument that
answered a different question than the one asked, or reported clean about something it could not see.**

**The predecessor's arc (4)** — recorded in the succession handoff and the pull requests it names:

1. **ugrep's `-P` missing a planted C1.** System `grep` here is ugrep 7.5.0 and its `-P` does not match
   `\xNN` byte classes, so the detector reported clean over a byte it could not see. (#251's subject.)
2. **The JSDoc drift detector swallowing its own shape B** — a declaration regex permissive enough to read a
   bare call `foo();` as a method signature, so it reported clean about a class it could not parse. (#248's
   body, which states the failure before its result.)
3. **`git config --show-origin --get-regexp`, patternless — exit 129, measuring nothing.** Transcribed from
   a supervisor's verdict prose *without being run*. (0029 incident 3; split-provenance B.)
4. **The same patternless command a second time**, in the repair — repaired properly with a positive control
   (set key found exit 0; unset silent exit 1).

**The supervisor's verification misses (2)** — two different wrongs, and they are not one:

5. **`ls .git/hooks` inside a worktree.** The right branch and a **path that does not exist**: inside a git
   worktree `.git` is a FILE, so the command reported a confident zero about hooks it never looked for.
6. **A diff read and a suite run against the wrong tree.** The shared worktree held a *different branch*,
   clean, so the verification measured something else entirely and proved nothing. Fixed by naming the tree
   path and writing the patch to disk with a sha256 both readers could confirm. (#249.)

**The successor's arc (5)** — sections 8, 9 and 11 carry the detail:

7. **A greedy `.*\[` capturing the LAST backtick-link per table row** instead of the anchor, so
   `stop-gate.mjs` read as rowed. This is **the exact failure `cli/README.md`'s own footnote describes**,
   reproduced one command after reading it — which is why the shipped rail's pattern is anchored. (#255.)
8. **`git ls-files 'cli/*.md'` matching across `/`** where the hand measurement's shell `ls` does not. The
   rail's first real run reddened on four files inside `cli/fixtures/drifted-workspace/`: swapping the
   instrument silently swapped the question for a broader one. (#255.)
9. **GraphQL has no `inReplyToId`** on `PullRequestReviewComment`; the thread-attribution query errored
   outright. REST's `in_reply_to_id` is the authoritative field, and it is what settled the 529 recovery.
10. **`behind_by` answers about the REMOTE branch head, not the local tree.** Read as a local fact it
    produced a rejected push; the local instrument is `git rev-list --left-right --count origin/main...HEAD`.
11. **A grep of `labels.json` for the string `documentation`**, answering *does this string appear* when the
    question was *is this label in the `covers` roster*. The roster sat unread through three gates. (§9.)

**The closing rounds added two more (2)**, both in the successor's arc and one of them shared:

12. **A mutation that never mutated.** A multiline `perl -0pi` regex aimed at `compile.mjs` matched
    nothing; the file was unchanged, the suite passed, and the green was reported as *the test binds*.
    Redone in Python with an `assert` on the target and a `diff -q` confirming the file changed — it
    reddened one case. **An unverified mutation is not a check, it is a second reading.**
13. **A refusal message that outran its own mechanism — written by the implementer, approved by the
    supervisor.** #256 round 2 replaced an over-reaching reason with a false one: it blamed the report's
    padding, and the padding comes from `r.id.padEnd(38)`, never from `why`, so the sentence cannot
    misalign a column. The gate read the sentence and did not check it against the loop it describes,
    which sat visible at `compile.mjs:2107`. Caught by Copilot, fixed in round 3 with the true reason.
    **Both authors, one instrument.**

Not counted, because it is not an instrument failure: the seam grep, which was **control-cased against three
planted terms before being trusted** and passed. The distinction is the point — an instrument that is
controlled and holds is the case the other thirteen are measured against.

## Standing discipline that earned its keep

- **Re-measure immediately before an irreversible act.** The session was suspended ~9h45m mid-work; the
  pre-merge conditions were re-taken at the moment of the act.
- **Never read the CLI's exit — read `state,mergedAt`.** Every merge verified that way. A compare call 404'd
  on #248 *because the branch was already gone*, which reading rather than assuming caught.
- **A rebase is a new tree.** Every published figure re-measured after each of the five rebases, and two PR
  bodies corrected before merge.
- **Mutation, not reading, decides whether a test binds.** Every fix this session was mutation-checked.
- **A stated artifact must exist where stated.** Commit messages, replies and patches written to disk before
  being described as drafted.

## Where this leaves the tree

**`main` = `692eaff`. Suite 1590, eleven recipes green, zero open pull requests.** Eight merged tonight,
closing **#219, #207, #228, #225, #203, #205**.

Six issues filed and open — **#252** (rule-4 triage), **#253** (`commit_id` drift), **#254** (six
hand-rolled mocks), **#257** (the POSIX claim), **#259** (the `cli-table` rail's two gaps), **#260** (the
`none`-message accuracy) — each carrying its measurement, its repair arms and a retire-when, and each
filed rather than folded because the bound said so and the class said so.

The loop rules did the work they exist for. **#251** stopped at two rounds and triaged two correct
apostrophes. **#255** stopped at two and triaged two correct rail gaps. **#256** took a third round under
the sibling exemption's own operational test — the governing rule was being enforced by the same diff nine
lines above the site when the defect was written — and the exemption bought that round and not the gate,
so its next findings went to an issue and the loop terminated. **Three different terminations, three
different reasons, none of them a session granting itself room.**
