# Task 0013 — the interview, the records rail, and the two checks `doctor` never made

**Lane:** full · **Opened:** 2026-08-11, milestone 7 session 7, at the session-open checkpoint
**Verify recipe:** `tests` · **Status:** DELIVERED, 2026-08-11, milestone 7 session 7 — [#227](https://github.com/sleepy-panda-works/portulan/pull/227), awaiting review

> Four of row 7's remaining items — **the four the maintainer chose at session open, over closing the
> row on a narrowed criterion** — taken together because none of them touches another's files.
> **M7 does not close this session**, and what it still owes is named at the end of this file rather
> than left to a reader of the Status cell. _(This paragraph called them "the four smallest" until the
> session-open checkpoint: a ranking nobody ran, where a ruling with real provenance was available —
> [`../memory/a-superlative-is-a-count-nobody-ran.md`](../memory/a-superlative-is-a-count-nobody-ran.md).)_

## The criterion, quoted rather than paraphrased

Row 7 of [`../../docs/plan.md`](../../docs/plan.md) carries all four:

- **`doctor` validates what `new` scaffolds** — "a skill's frontmatter, a persona against its
  five-part contract, a pack against its schema, and **the persona↔agent binding nothing checks
  today**." Three of the four landed at session 2 ([#150](https://github.com/sleepy-panda-works/portulan/pull/150)); the binding is the one left.
- **`doctor` scores agent legibility** — the 2026-07-28 amendment, "the audit
  [`vision.md`](../../docs/vision.md)'s influence map calls the **unclaimed niche**, reading the
  `affordances` slot that is its input."
- **Clause (a)** — the drafted workspace carries the records conventions, "a handoffs directory in the
  `handoffs` slot, the session-end gate wired through the compiled policy, and **the handoff-index
  freshness rail where the workspace declares an index**." The directory and the binding landed at
  session 4; the rail did not.
- **The interview** — [`vision.md`](../../docs/vision.md) glosses `init` as *interview + codebase scan
  → drafted workspace, human curates*. `cli/init.mjs` says in its own header that what ships is the
  substrate and the prompt loop is not built, and leaves whether flags satisfy the gloss to this close.

## What each of the four is not

Named first, because three of them have an over-reaching version that would be easy to write and
impossible to defend.

- **The binding check does not grade absence.** A pack persona with no host agent file is a *choice* —
  an adopter may not be on this host at all — so absence is reported and never failed. What is failed
  is a binding that **contradicts** the persona it claims to bind, because that one is wrong on any
  host.
- **The legibility score does not grade prose.** It scores properties that are *checkable from the
  tree*, prints them, and moves no exit code. A score that failed a workspace would make `doctor`'s
  verdict a matter of how much affordance prose somebody wrote.
- **The rail does not invent a green.** A drafted workspace's rail must not go red on the adopter's
  first run for a file `init` never wrote, and must not exit 0 when the tool that would check it is
  not on the machine. Those are the two failure shapes
  [`../memory/verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md)
  and the drafted `workspace.sh` already refuse.
- **The interview does not become the only way in.** Every non-TTY invocation behaves exactly as it
  does today, byte for byte: CI, a test, and a headless host are the reason the substrate was built
  first.

## Done when

Each line is a test that fails before the change and passes after.

**The interview asks, and only where somebody is there to answer.**
1. With stdin and stdout both TTYs and an answer missing, `init` asks for it; with either not a TTY,
   the run is identical to today's — the same refusal naming the same flag.
2. `--no-interview` forces the non-interactive path on a TTY. `--answers` and flags already supplied
   are never re-asked.
3. A question offers the value the flags path would have derived **where one exists**, and an empty
   line accepts it. **Residence and `governed-by` offer none** — the flags path derives nothing for
   either, and refuses without them; `feed`'s default is *none*, which an empty line accepts.
4. `governed-by` and `feed` are asked only when the residence is `pointer`.
5. An answer the schema refuses — a name that is not a slug, a residence that is not one of the two —
   is re-asked with the reason, and does not abort the run.
6. The interview ends by printing what will be written and asking once. Declining writes **nothing**
   and exits 2; EOF at any prompt does the same. Exit 0 continues to mean *it wrote*.
7. The loop is driven through an injected reader, so every line above is asserted with no TTY in sight.

**The rail ships with the records it holds.**
8. `init` writes the handoff index the manifest declares, generated by the same carrier `index` uses,
   so a freshly drafted workspace is **green** rather than red about a file nobody has written yet.
9. `init` drafts a second recipe holding that index current, declared in the manifest beside
   `workspace`, and `verify.default` stays `workspace`.
10. That recipe locates the CLI — `$PORTULAN_CLI`, then `portulan` on `PATH`, then the bundle it was
    drafted from — and exits **2** naming all three when none answers. It never exits 0 without
    having checked.
11. Editing the drafted index by hand turns the recipe **red**; regenerating turns it green.
12. `doctor` is green on what `init` drafts, in both residences, exactly as it is today.

**A binding that contradicts its persona is a defect on any host.**
13. `doctor` resolves each persona a composed pack contributes to a host binding at `<tree>/agents/<name>.md`,
    and reports the pair it found.
14. No binding is a **report**, not a failure — and the report names the persona and the path that
    would carry it.
15. A binding whose frontmatter `name` is not the persona's **fails**: the host loads an agent by that
    field, so the file binds a persona nobody named.
16. A binding carrying no `tools:` allow-list **fails**: the persona contract's first part is a
    default-deny surface, and a binding without one hands the role the host's whole toolbox.
17. A workspace declaring no `tree` is reported unverifiable rather than passed — the same answer the
    claims lint already gives, for the same reason.

**The score is a measurement, and it says what it measured.**
18. `doctor` prints one scored line per workspace, naming every dimension it missed.
19. The dimensions are checkable without judgement, and each is asserted independently. **Shipped as
    seven**, and the reconciliation with the eight this line first named is recorded rather than
    silently applied, because a plan edited to match its own implementation has stopped grading it:

    | This line's original | Shipped | Why |
    |---|---|---|
    | a declared `tree` | **dropped** | already a hard failure for `kind: repository`, so it could only ever be a guaranteed point |
    | a repo card for every repository the products name | **dropped** | already a hard failure through the `cross` check, same reason |
    | every verify recipe declaring `requires` | kept | genuinely optional per recipe |
    | a `dod` slot · a gate map with a gate policy beside it · a memory store with a declared index | kept | each optional in the Definition |
    | every product declaring `affordances` | kept, **widened** to *its own or the workspace-level default*, which is the cascade this slot already declares |
    | each affordances document naming what an agent must not assume | kept |
    | — | added: **a handoff series with a generated index** | optional, varies, and it is clause (a)'s own records convention scored from the other side |
    | — | added then **removed**: *executable verification* | it survived one checkpoint before being measured: schema form 0 requires `verify` of every workspace the score can reach, so it was a constant dressed as a measurement |

    The rule every row above is decided by is one sentence: **a dimension that cannot vary measures
    nothing, and a dimension that restates a hard failure is a second carrier of one verdict.**
20. The score moves **no exit code**, and a workspace that scores 0 with nothing else wrong exits 0.
21. `examples/` scores below full marks, so the score is demonstrated discriminating on a workspace
    this repository already ships rather than only on a fixture. **Measured: 5 of 7 against this
    workspace's 7 of 7** — the demo declares no machine-readable gate policy and no handoff series.
    _(This line read "`fieldnotes` declares no affordances", which the session-open checkpoint
    independently verified and which is nonetheless **wrong**: `examples/workspace.json` declares a
    workspace-level `affordances` default at line 20, so `fieldnotes` inherits one, and `doctor`'s own
    cross-check says so in the same run. A score contradicting a note beside it would have been the
    defect this dimension exists to avoid. Corrected by running it, which is the only thing that could
    have caught it — the reading was plausible from the products array alone.)_
22. The one dimension that reads prose (19's third) is a **form** check over a named pattern table,
    and says so where a reader will meet it, the way `PERSONA_PARTS` already does.

## Folded in at the session-open checkpoint — APPROVE-WITH-ADJUSTMENTS (8)

Recorded here rather than edited into the list above, because a *Done when* list rewritten to match
what a checkpoint said has lost the record of what it graded. **The arithmetic, since it does not close
on its own:** two of the eight are applied **in place** — the superlative in the opening paragraph, and
test 3's derived-default claim, which was false for the one question with nothing to derive — leaving
**six numbered, 23 to 28**. Item **29 is a ninth thing** and not one of the eight: the checkpoint raised
it in its closing note as *part of the work rather than a plan defect*, and it is numbered here because
it is an obligation this session owes either way.

**The carriers this change makes untrue, named at the opening where they are cheap.** Every one is a
sentence that goes false the moment this merges, and DoD condition 4 cuts both ways — a document may
not deny a capability that exists any more than it may claim one that does not.

23. **The score's five carriers.** [`../../cli/doctor.mjs`](../../cli/doctor.mjs)'s header
    ("never scores agent-legibility"), [`../../cli/README.md`](../../cli/README.md) ("the audit is not
    built"), [`../../spec/README.md`](../../spec/README.md)'s coverage row, two sentences in
    [`../../spec/slots.md`](../../spec/slots.md), and **two** in
    [`../products/portulan/affordances.md`](../products/portulan/affordances.md) — where the second is
    the subtle one: *"`doctor` resolves this file's path and reads nothing in it"* stops being true
    because dimension 3 reads this very document. Each replacement states that the score **moves no
    exit code**.
24. **The interview's carriers.** [`../../cli/init.mjs`](../../cli/init.mjs)'s *"There is no
    interactive interview yet"*, and the exit-code contract in the same header and in
    [`../../cli/README.md`](../../cli/README.md), which speaks for `init` and `new` jointly: `2`
    widens from *it could not run* to **it wrote nothing**, so a decline is inside the contract rather
    than beside it. The deliberately-absent `1` and its reason are kept — a decline is the human's
    choice, not a verdict about anybody's workspace. `new`'s gloss is untouched.
25. **The drafted README is a carrier in somebody else's tree.** The draft currently tells its adopter
    the index *"does not exist yet … this draft does not run it"* — false the moment test 8 passes, and
    false where nobody here will ever read it. That is the shape `init`'s own header calls **the worst
    available**, from the drafted Stop-hook sentence that survived a fourteen-carrier sweep. The
    drafted README and the drafted `verify/README.md` both describe what `init` now writes.
26. **The rail's honest first state is written into the artifact that ships it.** The package is
    unpublished — publishing is Gated — so on an adopter's CI none of the three locations may answer
    and the recipe's expected first state there is **exit 2**. The drafted `verify/README.md` says so,
    per [`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md):
    arrears are named in the change that adopts them. And the bundle path is named in the recipe as a
    **machine-local fallback**, never as a portable location —
    [`../memory/a-generated-file-must-not-point-at-what-git-cannot-carry.md`](../memory/a-generated-file-must-not-point-at-what-git-cannot-carry.md),
    since it may sit in an `npx` cache git cannot carry.
27. **The score's scope is a reading, and it is stated rather than assumed.** Every carrier of the
    2026-07-28 amendment says the `affordances` slot *"is its input"*, and the dimensions read
    six slots beyond it. The broad reading is what [`../../docs/vision.md`](../../docs/vision.md)'s
    *"repo affordances scored by `doctor`"* asks for, and a slot-only score could not discriminate at
    all on a workspace whose products declare no slot. So: **the slot is the named input, not the only
    one**, said here and in the carriers 23 replaces.
28. **The Status cell's cut is decided here, not scrambled at the rail.** Row 7's cell measures ~493
    bytes against `PLAN_STATUS_BUDGET=500` (check 6c in [`../verify/docs.sh`](../verify/docs.sh)), and
    DoD condition 6 obliges it to move: four items leave *Left* and s7 joins the history. The net edit
    does not fit in seven bytes. **The cut: the s0–s4 clause collapses to its milestone-file citation**,
    which is the split this row already uses between the scoreboard and its legislative history — the
    per-session narrative lives in [`../../docs/milestones/m07.md`](../../docs/milestones/m07.md) and
    the cell carries state.
29. **`AGENT_DIR` is exported rather than re-spelled.** It is declared in
    [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs) as the one location a host loads agents
    from — measured, not assumed — and is currently unexported. Exporting it is part of this work;
    a second spelling in `doctor` would be the two-carrier class
    [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md) names.

**Two things the checkpoint checked and deliberately did not adjust**, recorded so a later reader does
not reopen them: test 13's population is complete — `.portulan/personas/` holds per-persona *memory
scopes* rather than persona definitions, and `new persona` scaffolds into a pack, so a composed pack's
personas are the whole workspace-level population — and the report/fail split at 14–16 is `doctor`'s
own precedent rather than a softening: a pointer's `governed_by` is *reported and never graded* for the
same reason, and this repository is the exhibit, since the checkpoints pack's supervisor is deliberately
unbound (its `self-certify-a-checkpoint` gate makes **fresh context** the mechanism, which a host
binding would not supply).

## Folded in at the pre-commit checkpoint — APPROVE-WITH-ADJUSTMENTS (5)

The checkpoint executed the new rails rather than reading them, and the first of these is the reason
that distinction is doctrine here.

30. **A FALSE GREEN, found by running it.** The binding read joined a persona's `name` onto the tree
    with no containment test. A persona's name is the pack's own free text — the five-part contract
    does not include it and the Pack Definition does not reach persona markdown — so a pack declaring
    `name: ../../poison` had `doctor` open a file outside the workspace, validate it, and print *names
    and tool grant agree*, echoing that file's own `name:` into the report. Closed twice over: a
    **lexical** refusal of any key that leaves the tree, which fires whether or not the target exists,
    and a **resolved** one that catches a symlink pointing out. The suite was green over the hole
    because every fixture used a slug name — **a harness you write to check your own change inherits
    your change's blind spot, for the fifth time in this repository.** Two further defects surfaced
    only because the fix was tested: comparing a realpathed file against an unresolved root refuses
    ordinary bindings wherever the root sits under a link (every macOS temporary directory), and the
    lexical test is not redundant with the resolved one — with no file there, `realpathSync` throws
    `ENOENT` and the check fell through to its *unbound* sentence, which named the escaping path as
    "the one location a host loads agents from". A refusal that depends on whether the attacker's file
    exists is not a refusal.
31. **A dimension that could not vary.** *Executable verification* was scored until the checkpoint
    measured it against the schema: form 0 of the manifest's `oneOf` requires `verify` of every
    workspace that is not a pointer, a pointer returns before the score, and a manifest failing the
    schema returns earlier still. A constant +1 in a list whose whole claim is that every entry can be
    absent — and three carriers this session wrote said so in as many words. Dropped; the count is
    seven, item 19 above carries the reconciliation, and a test now asserts **no dimension is a key
    the schema requires** rather than trusting the prose.
32. **`CHANGELOG.md` denied the interview**, in the `## Unreleased` section its own header says
    accumulates as changes land. Adjustment 24 inventoried the interview's carriers and missed it —
    the records are the unrailed half, and no lint in this tree can see a sentence there.
33. **A test that had stopped checking.** `cli/init.test.mjs`'s *"the interactive interview is named as
    absent rather than implied"* asserted `/interview/i` against the help; the help now says the
    opposite and the assertion still passed, on the word `--no-interview`. Re-pointed at the two claims
    that matter. It is the sibling of the defect the test directly above it in the same file records,
    and it survived the change that made it wrong.
34. **Two exit-code gaps in the drafted rail**, both the *could-not-run vs ran-and-failed* distinction
    the rail installs elsewhere. `PORTULAN_CLI` naming a directory with no `index.mjs` died **1**,
    which this recipe's own header defines as *the index drifted — regenerate it*: a path typed wrongly
    sending somebody to repair a file that was never wrong. Guarded, and 2. And a **different**
    `portulan` on `PATH` is answered honestly rather than defended against — nothing can tell one
    program from another of the same name, so the drafted `verify/README.md` says so and names the
    explicit path as the location that answers a question about identity.

## What M7 still owes after this

`upgrade` · clause (b) parity's adopter half
([#184](https://github.com/sleepy-panda-works/portulan/issues/184)) · and **three of six**
demonstrations — D1, D2 and D5, none of them blocked on anyone but a session.

## Context

- [`../../docs/milestones/m07.md`](../../docs/milestones/m07.md) — the amendment history, the pinned
  demonstration count, and the *Left* list this task shortens by four.
- [`../../core/personas/README.md`](../../core/personas/README.md) — the five-part contract, and the
  measured finding that the binding is **lossy**: of three charters exactly one survives translation
  into a tool grant, which is why 15 and 16 check agreement and not equivalence.
- [`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs) — `AGENT_DIR`, the one location a host loads
  agents from, measured rather than assumed. Imported, never re-spelled.
- [`../../cli/init.mjs`](../../cli/init.mjs) header — why the substrate came first, and the sentence
  this task retires.
