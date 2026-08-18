# Task 0016 — the three demonstrations: D1, D2, D5

**Lane:** full · **Opened:** 2026-08-12, milestone 7 session 10, at the session-open checkpoint
**Verify recipe:** `tests` · **Status:** IN REVIEW — [#233](https://github.com/sleepy-panda-srl/portulan/pull/233), four Copilot rounds to empty, awaiting the maintainer's merge

> The last three of row 7's six demonstrations. Nothing here was planned as a mechanism: every clause
> these exercise is already delivered and recorded in [`m07.md`](../../docs/milestones/m07.md), and what
> is owed is a session that **runs and records** them — which is the whole of what *demonstrated, not
> asserted* means here, and the reason the row is still open. One mechanism change did arrive, from a
> finding the demonstrations themselves produced; it is ruled, scoped and recorded below rather than
> absorbed.

## The criterion, quoted rather than paraphrased

Row 7 of [`../../docs/plan.md`](../../docs/plan.md), and the pinned list in
[`m07.md`](../../docs/milestones/m07.md) → *The demonstration count, pinned — **six***:

> 1. **D1** — a never-seen repo onboards to a validated workspace in one afternoon.
> 2. **D2** — a user adds a skill, a persona and a pack of their own without editing a file this project ships.
> 5. **D5** — clause (b): a composed pack's skill invoked through a host the same way a core skill is.
>    The row says "the demonstration is that **parity**".

Clause (c) is not a seventh demonstration and is graded as a clause. m07.md has said since 2026-08-09
that *"Clause (c) stays ungradeable until clause (b) is demonstrated"* — **that sentence lives in
m07.md and not in the row**, and this task said otherwise in its first draft, which is the
two-carrier confusion this repository names more often than any other, committed in a file arguing
about carriers.

## What the maintainer ruled, and what a fresh context said about each

Every ruling below was taken **before** the work it governs. Each was also put to a fresh Fable 5
context at his instruction — *"ask a supervisor for a second opinion"* — so what is recorded is a
ruling plus an independent grade of it, never a ruling alone.

1. **D5's invocation half runs against a project-scoped install**, using the real configuration
   directory for authentication. The supervisor **agreed**, refused the registration-only alternative
   on the row's own sentence — *"`Skills (7)` cannot stand in for the parity this clause asks for,
   since the same count reproduces from a directory carrying no workspace at all"* — and found the
   teardown as first written **one carrier short**: it removed the plugin and not the marketplace
   record, which points at a worktree that is deleted after the merge.
2. **The implementer picks D1's subject**, and he refused the option of one of his own repositories.
3. **`--pack-root auto` unions with the tree-derived root** — the finding the demonstrations produced,
   below.

## The finding the demonstrations produced, and the change it earned

**A workspace composing a cache-installed pack *and* one of its own had no green `doctor` invocation
that did not require typing the host plugin-cache path by hand.** That workspace is not hypothetical:
clause (a) makes `init` compose `rituals/checkpoints` by default, so it is what an adopter has the
moment D2's pack is added. Measured on a probe workspace before anything was planned:

| invocation | cache pack | the adopter's own pack | verdict |
|---|---|---|---|
| no flag | does not resolve | resolves (derived from `tree`) | **RED**, exit 1 |
| `--pack-root auto` | resolves | **does not resolve** | **RED**, exit 1 |
| `--pack-root auto --pack-root ./packs` | does not resolve | resolves | **RED**, exit 1 |
| `--pack-root ./packs --pack-root <cache path, typed by hand>` | resolves | resolves | GREEN, exit 0 |

The behaviour was the **ruled** precedence, so this was never an implementation defect to fix on an
implementer's authority. It is the concrete victim of the narrowing
[`../../cli/discover.mjs`](../../cli/discover.mjs) already **recorded and flagged for the maintainer**,
and it falsifies the half of that flag which said the clause *"survives where it matters — nobody has
to know the cache path"*. For this shape, somebody has to.

**Put to him with three answers drafted as consequences, he ruled the union.** Then the session found
its own framing had been incomplete and said so rather than building on it: `resolutionRoots`' docblock
gives **two** grounds for *never union*, and only the first had been surfaced. The second is #123's
closing constraint, which the `forced` branch states in its own words — the set is *"empty rather than
falling back to the tree-derived root, so a pack cannot resolve from a local copy here"*. A union lets
a copy lying in the local tree satisfy *this pack resolved from the feed*.

**Re-ruled on that: union, but never silently.** #123 objected to roots being added *silently*, so the
guarantee is bought back in the form it actually asked for — where the union is in force, provenance is
stated per pack rather than guaranteed by the composition of the root set. What may then be claimed
narrows accordingly, and the record carries the trade rather than dropping the old reason.

**The sibling sites are enumerated before the fix, not after it.** The sentence the change falsifies is
written in more than one place, and this repository's own repair for that is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md). Measured by grep rather than
by memory: the precedence sentence is carried in `cli/discover.mjs`'s `resolutionRoots` docblock, and
**again** in the comments of [`../../cli/recipe-set.mjs`](../../cli/recipe-set.mjs) and
[`../../cli/skills-set.mjs`](../../cli/skills-set.mjs), each of which cites the rule while reaching it
through `rootPlan`. All three move together or the rule is obeyed at whichever a reader opens first.
The `forced` branch's own `why` string is a fourth carrier, of the reason rather than the rule.

## D1 — a never-seen repo onboards to a validated workspace

**The subject: [`psf/requests`](https://github.com/psf/requests), pinned at
`8068356288978c4f54661ae6f95afe0e0831885e`**, cloned into a scratch directory, nothing of it committed
here. Chosen against three requirements, and the third decided it:

- **Never seen by this project** — not authored here, not vendored, not a fixture; the string appears
  nowhere in this tree before this task.
- **Real**, with a history and users. A workspace drafted onto a scaffold this session wrote would
  demonstrate the scaffold.
- **Its layout makes the scan's honest null observable.** It carries a `Makefile` with a `test:` target
  and no `build:` or `run:`, plus a `pyproject.toml`. So the draft says `make test` because that target
  exists, and *not determined by the scan* for the other two — the behaviour
  [`../../cli/init.mjs`](../../cli/init.mjs)'s scan docblock exists for: *"the failure an onboarding
  tool is most likely to commit is the confident default."* A subject where every field resolved would
  demonstrate the easy half only.

**Why not one of the maintainer's own, recorded because it was offered and refused.** This
demonstration's transcript lands in a record this repository carries, and his repositories may hold
client-derived material. That would put the seam inside the evidence path, where a scan is a mitigation
and not a guarantee. A public repository has no seam to cross.

**"Never-seen" means never seen by the *project*, and a supervisor ruled that the only coherent
reading.** The alternative — never seen by the implementing *model* — is unsatisfiable for any subject
that is also **real**: every public repository with a history and users is in a training corpus, and
what remains is private repositories (the seam, refused) or fabricated ones (which demonstrate the
scaffold). The distinction has a mechanical consequence rather than a rhetorical one: **`scan()` is a
deterministic file reader** — Makefile targets by regex, manifest files by existence — so no model
memory can reach what `init` drafts. Where familiarity *can* leak is the curation, and that is
disclaimed at its own width: **the curator knew this repository, so the curation timings are a floor
for the machinery and never an observation about an adopter.**

**One arm stays honestly unexercised, said rather than left silent:** the subject is Python and this
product is Node, so nothing in its stack overlaps the toolchain the CLI assumes — and `scan`'s
`package.json` arm, the richest of the detectors, is not exercised by this subject at all.

**What runs, each step timed:** the clone; `init --residence in-repo`, the arm of record; the interview
under a pty, reported at its own width; `doctor` for the validation; the drafted verify recipe's
**exit 2**, then its curation and a real verdict; `compile`; `index`.

**What "in one afternoon" is measured as, stated before measuring so it cannot be fitted to the
result:** wall-clock from the clone to the first green `doctor`, and separately to a curated workspace
recipe rendering a real verdict. **The curation in this run is an agent's, not a human's**, and the
record says so where the limits are stated rather than in a footnote.

**The subject's layout was claimed before it was cloned, so the run evidences it.** The three-detector
shape above was read off the forge's API while planning; the record carries the **scan's own observed
output at the pinned SHA**, because a plan's expectation and a tool's observation are two different
claims and only the second is evidence.

**The trap is in exactly one file, and it is named before it is walked into.** `doctor` needs no Python
environment — it lints path-shaped claims against the tree and executes nothing — but the curated
`verify/workspace.sh` is the second timing's endpoint, and this machine has no dev environment for the
subject. Three honest resolutions exist: install a minimal environment and let the timing carry it;
curate the subject's own command and record its honest non-green with the missing precondition mapped
to **exit 2**; or curate a narrower check that is genuinely real. **One dishonest resolution exists and
is refused in advance** — a body that exits 0 having checked nothing, which the draft's own comment
forbids: *"a stub exiting 0 would report 'nothing wrong' when the truth is 'nothing looked'."*
Whichever is taken, **the record states what the curated green means and whether the subject's own
suite ran**, so *validated workspace* cannot inflate into *the subject's tests pass* or deflate into a
green the demonstrator defined.

## D2 — a skill, a persona and a pack of the adopter's own

Run in D1's workspace, because a team that has just onboarded is exactly who adds these. The three
`new` kinds into the adopter's own layer; the placeholders filled; the persona added to the pack's own
`contributes.personas`; the pack composed in the **adopter's** manifest; `doctor` validating all three.
A refusal beside the success: `new … --into <checkout>/core/…`, which the tool refuses by contract.

**How *without editing a file this project ships* is evidenced — as a byte equality, not by
inspection.** `git status --porcelain` over this checkout, a digest over every tracked file, `HEAD`,
and a digest of the installed pack payload in the host plugin cache: captured before the first `new`
and again after the last, with the algorithm and both values in the record. **The two captures bracket
D2's operations only** — this session's own record edits and D5's installs fall outside the bracket, by
construction rather than by explanation, and each capture is timestamped so a reader can see which
side of the bracket it sits on.

## D5 — a composed pack's skill invoked through a host, the way a core skill is

**What the clause compares, stated precisely, because getting it wrong yields a different and easier
demonstration.** Not *a pack's skill works*. It compares a **core** skill and a **composed pack's**
skill reaching one host through the **same plugin manifest**, and claims that nothing about invoking
them differs — same tool, same `plugin:skill` grammar, no path anybody had to know.

**Measured already, and it is the substrate rather than the demonstration.** With this checkout added
as a marketplace in an isolated configuration and `portulan@portulan` installed, the host reports
**Skills (7)** — `clarify`, `codify`, `consolidate`, `milestone-close`, `portulan`, `pre-commit`,
`session-open`: three core skills, the boot skill, and **three from the composed
`rituals/checkpoints` pack**, in one flat inventory with nothing marking which came from where. The
feed pack installs beside it and reports **Skills (3)**.

**Three invocations, not two.** The row's parity pair is a **core-origin** and a **composed-origin**
skill through *the same* `portulan@portulan` manifest; the feed pack's skill through
`portulan-checkpoints@portulan-internal` is m07.md's *beside*-ness and is the third. Satisfying that
memo's *"one skill of each"* without the composed-origin skill would demonstrate the memo and miss the
clause. Captured as stream-json, and **any permission flags are recorded**, because they shape what a
transcript can show. **Parity is the tool call, never the narration:** a fallback to a path invocation,
described as parity, demonstrates the clause's opposite.

**The transcripts are characterised, never quoted, and this reverses what the plan first said.** A
fresh context refused the plan's mitigation — seam-scan them and commit them — on three grounds, and
the first is this session's own D1 argument turned around: the maintainer's repositories were refused
as D1 subjects because that *"puts the seam inside the demonstration's evidence path, where a scan is a
mitigation rather than a guarantee"*, and **one session cannot hold that for D1 and hold the opposite
for D5**. The second is D3's precedent, whose record characterises — byte counts, a named sha256, exit
codes, issue links — and quotes no transcript, after that demonstration's first run produced material
that could not be pasted into a pull-request body. The third is decisive on its own: **the term list
cannot clear what it has no terms for.** The scan is scoped to one engagement; a run against the real
configuration loads user-level context that may carry private material of other kinds, which no listed
term names. Condition 5 is a necessary gate here and not a sufficient one.

So the record carries: **the exact commands with every flag** (session-authored, so not a disclosure
surface), the **three skill names and the observed tool-call names** — structural fields, not model
prose — **exit codes, host version, provenance, and a sha256 plus byte count of each full captured
transcript**, so the record states what it is characterising. Assistant free text stays out, and so
does any inventory beyond the two `portulan` carriers. *"The tool calls and their names are in the
record rather than in a summary of it"* is satisfied exactly this way: **tool calls and names in the
record is not transcripts in the record.**

**Teardown, of both carriers, with its failure path stated.** The plugin uninstalled *and* the
marketplace record removed, then the real configuration re-read and compared to the pre-state capture
as an **equality**. **If teardown is partial, the record names the residue and the manual removal** —
this session does not end silently dirty in the maintainer's live configuration.

**The equality is recorded as digests, not as a roster**, for the same reason the transcripts are
characterised: the pre-state capture is the maintainer's whole plugin and marketplace inventory, which
is not this repository's business and which the term list cannot clear either. So the record carries
**a sha256 of the pre- and post-captures, shown equal**, and verbatim only the entries this
demonstration **added and removed** — the two `portulan` carriers, which are the only ones it has
anything to say about.

**Provenance, because that is this project's standard of evidence for an install:** the marketplace
path, the commit the payload came from, and the host version. The install exercises **this branch's
tree**, not `main`'s.

**The deviation is recorded, not slid past.** Running against the real configuration directory departs
from this build's standing *isolate plugin experiments from real state — always*, and the measured
reason is that credentials are per-configuration-directory: an isolated one exits *Not logged in*, and
copying credentials is not something this session may do.

## `HOST_SKILL_DEPTH`, re-measured because the host moved

[`../../cli/skills-set.mjs`](../../cli/skills-set.mjs) carries a standing mandate to re-measure at a
host upgrade, and the host is **2.1.227** against a last measurement of 2.1.226. **Re-measured today,
both directions, and it did not move:** a manifest declaring `./packs/rituals/` registers **Skills
(0)**; one declaring `./packs/rituals/checkpoints/skills/` registers **Skills (3)**. Had it moved, that
would have been a mechanism change with a same-change fix and a re-run of every demonstration touching
it.

## The session-open verdict, and the eight adjustments folded

**APPROVE-WITH-ADJUSTMENTS (8)**, fresh Fable 5, the standing instruction for a session that edits
`docs/plan.md`. Recorded here as numbered items rather than edited invisibly into the plan they graded.
The maintainer's instruction to this session is that **every** adjustment is folded, optional ones
included.

1. **The pack-root question goes to him at session open, before D2's captures** — not raised into the
   record for later. Deferring it to the close would relocate the reckoning, which is what the
   2026-08-03 *"properly, not cheaply"* ruling refused. **Done, and twice: the ruling, then the
   correction when the framing was found incomplete.**
2. **D1's curation is evidence, not housekeeping.** The record carries the drafted manifest, the
   drafted→curated diff, and the curated recipe's body. *"A timed clone-to-green where the
   demonstrator authored the recipe, with its content absent from the record, is a green the
   demonstrator defined"* — the demonstration-shaped form of the blind spot this repository has
   measured seven times.
3. **D2's digest bracketing is stated**, with algorithm and values, to the named-sha256 standard D3
   set.
4. **Each demonstration gets its own *What this does NOT establish* section** in m07.md, as D3 and D6
   have. D1's "one afternoon" limit lives there, and the record never says *one afternoon:
   demonstrated* flat.
5. **D5's teardown gets a stated failure path**, and the post-teardown check is an equality against
   the pre-state read-back rather than a re-reading.
6. **Clause (c)'s grading evidence is named.** A second fresh context ruled it **answerable this
   session**, and the basis is below rather than left as an obligation restated.
7. **A moved `HOST_SKILL_DEPTH` would be a mechanism change**, with a same-change fix and re-runs.
   It did not move; the measurement is above.
8. **An attribution fix** — a sentence credited to the row that lives in m07.md. Corrected at the top
   of this file.

### A second pass, on the questions the maintainer had answered without one

Commissioned at his instruction after the first — *"proceed with a fresh supervisor opinion on recent
questions too"* — over D1's subject, the transcript question, and whether the eight above were folded
adequately. Four items, all folded above, and **one of them reversed a decision this session had already
made**:

9. **The subject stands**, on the project-reading of *never-seen*, with the model-familiarity limit and
   the unexercised `package.json` arm said out loud, and the pre-clone layout claim evidenced by the
   scan's own output.
10. **The curated recipe is the trap**, and three honest resolutions are admissible where a fourth is
    refused in advance.
11. **The D5 transcripts are characterised rather than committed — a reversal.** The plan had proposed
    to seam-scan and commit them; the pass refused that as *"a gate, not a licence"*, and the refusal
    turns this session's own D1 argument back on it.
12. **The teardown equality is recorded as digests**, not as the maintainer's inventory.

And it ruled **clause (c) answerable now**, which the first pass had left open as *name the evidence or
say why you cannot*.

### The pre-commit pass, and the nine it returned

**APPROVE-WITH-ADJUSTMENTS (9)**, fresh Fable 5, on the frozen and fully staged diff before anything
was committed. It re-ran the eleven recipes and the suite itself rather than reading the report of
them, **re-measured the baseline in a fresh clone**, and ran **fourteen mutations of its own** — of
which **eight survived**. Every survivor was a rail the suite could not see, which is the finding
rather than a footnote: the session's own six mutations all aimed at sites that had tests.

13. **The suite figure was wrong in two committed records** — 1514 where the tree said 1515. Corrected,
    and the figure re-measured again after the adjustments below moved it.
14. **The Session log miscounted the supervisors** — two where the handoff and this file record three,
    and it fused the reversal and the live-defect find into one grader. Corrected.
15. **The headline `skills-set` fix had no binding test.** The defect could be reintroduced verbatim
    and 1515 tests stayed green, because nothing exercised `--pack-root auto` in that file at all.
16. **The named+auto refusal was pinned in one carrier of six.** Deleting it in `compile`, `index`,
    `vendor` or `init` broke nothing. All five now have one, and the diff's own comment had already
    recorded that this exact class produced the fifth carrier earlier in this session.
17. **A sixth site was still unswept:** `compile.mjs`'s `packContributions` kept the literal-plan
    short-circuit this change replaces in `doctor` and `index` — so given `packRoots` **and** `forced`
    it silently ignored the discovery request, and returned a plan carrying neither `origins` nor
    `refusal`, breaking the uniform shape one file over.
18. *(optional)* The `Unreleased` CHANGELOG entry for #123 still stated the replaced rule. Forward-
    pointed rather than rewritten — an entry edited to match a later one destroys the record of what
    the first change shipped.
19. *(optional)* `compile`'s union plan line, `init`'s derived-arm union and `resolverFor`'s `forced`
    had no tests. They have them.
20. *(optional)* D1's curated recipe body and the drafted→curated change now live in the record rather
    than in a scratchpad that evaporates.
21. *(optional)* The digest instruments are named, so both of D2's figures are re-derivable rather
    than trusted.

**Two of the repairs did not bind on the first attempt, and both were the same trap.** The `compile`
refusal test exited 2 whether or not the refusal fired, because `packContributions` refuses the same
pair — the same double-carrier shape that had already caught the `doctor` test at the session's own
mutation pass. It now carries a **control** asserting the fixture compiles to 0 without the pair. And
the sixth-site test had to be aimed at `packContributions` directly, because through `run` the
parse-time refusal answers for it.

## Clause (c), and the basis it is graded on

Clause (c) is the parity property over (a) and (b), and its own text says what grades it: after `init`
a customer's workspace runs the **same shaped cycle** customer zero runs — *"three fresh-context
verdict moments available and the records railed"* — while the **threshold and the who remain the
customer's policy**. All three demonstrations land in **one** scratch workspace, which is what makes
the clause gradeable from them rather than from an argument:

- **The verdict moments are available.** The measured inventory's three composed-origin skills *are*
  `session-open`, `pre-commit` and `milestone-close`, so D5's composed-origin invocation is necessarily
  one of the three checkpoint skills. Availability then rests on **invocation plus the demonstrated
  registration mechanism**, never on the `Skills (7)` count — which the row itself refuses as evidence.
- **The records are railed** in the customer's own tree: `init`'s draft binds the checkpoints pack, the
  `handoffs` slot, the handoff index and `verify/index.sh`, and D1 exercises that wiring by running
  `compile` over the drafted policy and `index` over the drafted records.
- **The threshold and the who stay the customer's** — the drafted `gates.json` is the customer's own
  file, core names no pack, and the ritual pack refuses to set a lane boundary. **This third leg is a
  reading of the tree rather than a run, and the record says so.**

**What grading (c) does not establish, said here so the close is not held to it:** no adopter ran a
full cycle end to end — no real session-open → work → pre-commit sequence was performed by a customer
in that workspace. That is not a gap this session leaves: the clause asks for availability and rails,
and the row deliberately made (c) a clause rather than a seventh demonstration. Demanding a lived cycle
would re-commit the count drift m07.md documents.

## What this session must not claim

- **It is not the milestone close.** That is a fresh-context checkpoint run *after* the work merges,
  and the maintainer's to act on. This session produces the evidence a close would grade.
- **A demonstration of a superseded build is an assertion about the shipped one** (m07.md, D3). The
  pack-root change lands **before** the demonstrations for exactly this reason; anything that lands
  after re-runs what it touches.
- **Derivable is not demonstrated**, and the inventory count is not the evidence.

## The review loop

**Four rounds to empty; four findings, none refused**, two of them through the promoted-note channel.
**Three of the four were one defect** — a correct refusal placed where something could skip it, in
`compile`, `skills-set` and `init` in turn — and the rule they share is recorded in the handoff rather
than as three fixes: *a judgement about the command line belongs where the command line is assembled,
not where its subject is used.* Round 1's second finding was the sharpest: `resolverFor` dropped
`rootPlan`'s `refusal`, which is the silent drop this change exists to remove, one layer down.
