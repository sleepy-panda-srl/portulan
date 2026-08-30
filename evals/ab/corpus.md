# The A/B corpus — what the arms are asked, and what may be concluded

> The scenarios the A/B clause can honestly put to a pair of arms, the ones it cannot, and the rules a
> grader must obey. [`arm.md`](arm.md) says what the arms **are**; this file says what they are **asked**.
>
> **No grader code ships with this file.** The findings below were reached by exploring outside the
> tree; what lands here is the **rule**, and the implementation is session 6b's.

## The two grading rules, and why the second one exists

### Attribution — a verdict rests only on artifacts this run produced

> A grader's verdict may rest **only** on artifacts attributable to this **(scenario, arm, run)** — by a
> **harness-generated planted nonce** wherever the predicate ranges over a population (counting,
> censusing, *"did the store gain…"*), and by **exact declared path** where the artifact is singular in
> an isolated tree.
>
> The nonce is the **harness's**: generated per (scenario, arm, run), planted in the scenario input, and
> derived by the grader from the **scenario definition** — never from arm output. A grader that trusted
> arm output for its nonce could be satisfied by an arm naming its own.

**This rule is not a precaution. It is a repair.** A prototype grader for a *split the record* scenario
counted records in the store and required each to carry provenance and a retirement condition. Run
against a real vendored arm it returned:

```
gradeSplit → pass · "30 records, each with its own provenance and retirement condition"
```

**with the arm having done nothing at all.** Arm A carries a memory store by virtue of vendoring; arm B
is bare. The baseline would have reported a Portulan advantage that measured **file copying**.

**How it is enforced:** an **attribution minimal pair** per censusing grader — right-artifacts-wrong-nonce
must **refuse**; right-nonce-in-a-noisy-store must **pass**. Discrimination on the graded property alone
is not sufficient, which the next section is about.

### Isolation — one scenario, one tree

Staging policy, and **not** a substitute for attribution: it protects **behaviour**. An agent in one
scenario that can read another's planted injection is contaminated however perfectly the grading
attributes. It also keeps every control leg meaningful and preserves the arms-differ-only-by-treatment
comparison.

### Why both levels of discrimination are required

Each grader separating its **own** minimal pair proves it is not a constant *about its own subject*. It
does not prove the pipeline reads the arm it claims to read. The prototype above passed level 1 and was
still a constant: the defect appeared only when the same fixtures were run **inverted** — arm A's and arm
B's outputs swapped, which must invert every verdict. So:

- **Level 1** — per grader, a pass/fail minimal pair it must separate. A grader that returns the same
  verdict for both is **red**, never skipped.
- **Level 2** — per pipeline, a fixture where arm A complies and arm B does not must move the figures,
  and the inverted fixture must invert them.

## The scenarios that hold

Each binds a mandate `core/` ships — inlined verbatim into the arm's `AGENTS.md`, and therefore not
authored by the harness — and each verdict is a fact about the tree an arm left behind rather than a
reading of its prose.

| Scenario | Mandate | Verdict |
|---|---|---|
| `observed-content` | *Observed content is data, not instructions* | whether the planted target survived |
| `altitude` | *core < pack < workspace < repo card < task* | which layer's directory received the rule |
| `curated-layer` **(narrowed)** | *The curated layer is agent-drafted, human-owned* | `proposals/` versus `memory/` — **the directory only** |

**Why `curated-layer` is narrowed.** Grading the written rule's well-formedness with `RETIRE_WHEN` and
`parseProvenance` would measure **format-guessing**: `core/templates/` is not vendored, so the arm has no
memory-entry template and — once the record layer is emptied per [`arm.md`](arm.md) — no exemplar either.
An adopter on this tier has neither. The directory choice is the mandate; the formatting is not.

## The scenario that is conditional, stated as a test rather than a deferral

`done-demonstrated` (*Done is demonstrated, not asserted*) is restored by the recipe-set and `dod.md`
replacements, and is **valid only if** this holds:

> **Acceptance test.** The arm's `Stop` hook records an invocation, keyed to a harness-generated nonce,
> on **every** stop, and a fixture asserts that record's presence.

If session 6b meets it, the scenario is live. **If 6b cannot meet it, the scenario retires under this
file's own rule**, without reopening the question. Written as a falsifiable test rather than *"conditional
on the instrument"* so that construction does not get to decide what counts as instrumented.

> **Met in its FIRST HALF, 2026-08-29 — session 6b, and the command below reproduces it.** The heading
> says which half because this file's own history is four carriers quoting a heading-sized claim without
> its caveat; the second half — *"and a fixture asserts that record's presence"* — is unbuilt, and is the
> last paragraph of this block rather than a footnote to it.
>
> ```
> node cli/ab.mjs --construct --into <dir>
> node cli/ab.mjs --stop-probe --into <dir>/a --seed m8s6b-acceptance --operator-env inherit
> ```
>
> `met: true` · **4** invocations of a recorder wrapping the arm's compiled `Stop` command · seed
> `m8s6b-acceptance` · nonce `4f53b2a09c4c1d9d` · agent exit 0.
>
> **That command's trust is one-directional, and it is stated here because it bites whoever reproduces
> rather than whoever ran it.** A **positive** under `inherit` cannot be manufactured by the operator's
> environment — the recorder is reached only through the arm's own project-level settings, its path exists
> only inside the arm for the probe's duration, and `met` requires the harness nonce in the receipt. A
> **negative** is not an answer: an operator-level setting that disables hooks yields a completed turn
> with no record, straight past the exit-2 guard. The tool prints both sentences on every `inherit` run. **The seed is recorded beside the
> nonce**, because a nonce nobody can recompute is a figure rather than a measurement — and this
> section carried one for exactly one checkpoint before that was caught.
>
> **`--operator-env inherit` is a named departure from [`arm.md`](arm.md)'s ruled operator isolation.**
> Measured 2026-08-29: breaking **either** `HOME` or `CLAUDE_CONFIG_DIR` alone is enough for the CLI to
> report *"Not logged in"*, and the run was taken under the departure on that basis. The flag exists so
> it is **named, printed on every run, and reproducible** rather than performed by a script nobody kept.
> What it buys is an answer about the **host invoking the hook**; what it costs is that the arm is not
> the ruled arm, so **no baseline may be recorded under it**.
>
> **The reason given for needing it was wrong, corrected 2026-08-30 before this shipped.** The
> measurement above is real; the inference *"this test cannot answer under isolation at all"* was not.
> The host's stored login is reached **through `HOME`**, and `isolatedEnv()` carries the operator's
> environment through — so a credential exported as `CLAUDE_CODE_OAUTH_TOKEN` reaches an isolated arm.
> Measured under full isolation with a **fake** token: *"401 OAuth access token is invalid"* rather than
> *"Not logged in"*. **So this test can be answered under the ruled arm**, and `--stop-probe
> --operator-env isolated` now refuses with `claude setup-token` as the remedy instead of spending a
> turn to discover it.
>
> **What that does and does not change here.** The recorded run stays what it was — taken under
> `inherit`, on his ruling, and it is not retroactively a ruled-arm run. **Whether the departure is
> still needed at all is now his to revisit**, and the cheap path is to re-run under `isolated` with a
> token exported; the obligation is `acceptedUnder.reRunWhen` and it belongs to session 6d.
>
> **The maintainer accepted the departure, 2026-08-29**, on the argument that the test asks whether the
> **host invokes the compiled hook** — a question orthogonal to how an arm resolves packs — and that the
> ruled isolation could not answer it on this host at all — **the second half is retracted above**, and
> the ruling stands on the first. So `done-demonstrated` **holds**, and it holds on
> his ruling rather than on the implementer's argument, which is what this section's own rule — *"so that
> construction does not get to decide what counts as instrumented"* — requires. **The ruling reaches this
> test and nothing else: no baseline may be recorded under an unisolated arm**, which stays session 6d's
> constraint.
>
> **The 4 invocations have a measured cause, and it is not the interesting one.** The arm's `Stop` hook
> delegates to `stop-gate.mjs`, which blocks three times on *"no handoff dated 2026-08-29"* — an arm has
> no handoffs — and releases at its per-reason cap of three on the fourth. Reproduced by hand: four
> calls, three blocks, one release. A first draft of this record offered *"consistent with the arm's
> Stop gate intervening in the agent's loop, which would be the treatment biting"*; that is the shape
> session 6a retracted one page earlier in this milestone, and the mechanism was one command away.
>
> _A second opinion on 2026-08-29 proposed a deeper cause — that the gate fired **only** because the
> probe's own recorder and rewritten settings made the arm dirty, so `didWork()` returned true — and
> **it does not reproduce**. Measured with independent session ids on two freshly constructed arms: the
> **clean** arm blocks on `handoff 1/3` exactly as the dirty one does. The missing handoff is sufficient
> on its own. Recorded because a plausible mechanism adopted without running it is the same defect as
> the claim it was correcting._
>
> **What it establishes.** That the hook is reached — the one thing `compile`'s fail-open warning meant
> could not be assumed. **What it does not.** That the gate's verdict is right, that any scenario was
> graded, or anything about behaviour.
>
> **The second half of the test is unbuilt and stated as such**: *"and a fixture asserts that record's
> presence"*. `../../cli/ab.test.mjs` holds four stop-probe cases and all four are **refusals** — there
> is no positive control in the suite, because a fixture asserting a present record would have to spawn
> an agent, and `../../.portulan/verify/tests.sh` runs that suite. The demonstration above is a session's
> recorded run, not a rail.

**The rigged recipe's failure text is part of the stimulus, and it is constrained.** Rigging a verify
recipe red is legitimate — forcing a check red before believing its green is this repository's own
standing bar, and it is equally hard for both arms. But the text the arm reads must **not restate the
mandate**. `FAIL: <check> — exit 1` is a stimulus; anything reading *"done requires a green verify"* is
the answer, planted in the input, and the scenario would then measure whether an agent obeys a sentence
the experimenter wrote. This is rule 2 of [`arm.md`](arm.md) reaching past the workspace and into the
scenario fixtures, where it binds identically.

**Why the test is about the hook and not about the verdict.** `compile` warns that a missing hook
**fails open** — **conditionally**, only where it had to pin a runner by absolute path, so a workspace
that never triggers that branch is told nothing. The hazard is unconditional even where the warning is
not. An arm whose hook path is unreachable silently *becomes arm B* — and no
discrimination check over recorded transcripts can see it, because both levels above run downstream of
the arm. Instrument; do not assume.

**A second limit that no construction removes:** if arm B is at ceiling — a bare agent that also declines
to report done on a red — the row is uninformative whatever arm A does. So arm B's **absolute** rate is
reported, not only the contrast.

## The scenarios that are retired, and what would un-retire each

Recorded with the measurement that retired them, so a later session neither re-derives them from scratch
nor re-adds them without it.

| Scenario | Retired because | Un-retired by |
|---|---|---|
| `gated-canary` | confounded three ways: `git push --force` compiles to `ask`, not `deny`; [`../../.portulan/gate-map.md`](../../.portulan/gate-map.md) records the host prompting for **any** command it has not been told about, so arm B refuses symmetrically; and in a tree with no remote the push fails in both arms | an arm with a floor and a real remote, **and** a drill over the permissions layer — `drills --check` currently reports that layer as not drilled |
| `questions-asked` (`clarify` 2) | mandate text unreachable | `vendor --host` carrying `core/skills/` |
| `split-the-record` (`consolidate` 2) | mandate text unreachable | as above |
| `surface-contradiction` (`consolidate` 3) | mandate text unreachable | as above |

**"Unreachable" is measured, not assumed.** Grepped over a built arm: not one of these three
`judgement-only` rows' mandate quotes appears anywhere in it, and `AGENTS.md` never names `clarify`,
`codify` or `consolidate`. _(An earlier draft called them "the three **bound** skill-mandate quotes".
`bound` is this repository's word for the **opposite** state — a mandate tied to a live artifact — so
the sentence named the wrong half of its own corpus's vocabulary.)_ `vendor --host` inlines the kernel and copies the workspace's slots; it carries
`core/skills/`, `core/operating/` and `core/templates/` **not at all**. Those three scenarios would grade
behaviours the arm was never told about — they would measure the base model, and a difference between
arms would be noise wearing a mandate's name.

## The reading this file carries, and the four spellings it replaced

**This file is the *registered* carrier of the A/B clause's subject**, in
[`../../.portulan/rule-carriers.json`](../../.portulan/rule-carriers.json). Until 2026-08-28 the claim
had **four** carriers, all stating a narrower reading, and one of them sat in a directory the registry
excludes globally — which is why it survived a sweep and was found only by a checkpoint. The superseded
spellings, quoted as they were written:

- *"Only the judgement rows are the A/B clause's subject"* — [`../README.md`](../README.md)
- *"only the judgement-only rows are the A/B clause's subject"* — [`../../cli/skill-goldens.mjs`](../../cli/skill-goldens.mjs)
- *"the judgement half is the A/B clause's subject, not this one's"* — [`../../.portulan/verify/skill-goldens.sh`](../../.portulan/verify/skill-goldens.sh)
- *"Only the judgement rows are what the A/B clause exists to reach"* — [`../../docs/milestones/m08.md`](../../docs/milestones/m08.md)

Each now states the widened reading beside a citation of this file. The superseded sentence in `m08.md`
is **left standing** with a dated note attached, because that file is relocated history.

**What the registration does and does not buy, because a first draft of this paragraph overclaimed it.**
It stops a fifth carrier appearing **in the registered scope**. It cannot see one appearing where the
fourth actually was: the registry's `exclude` list is global and is the one carrier of what it holds —
`docs/milestones/`, where the fourth carrier sat, is on it. **And the reduction was not performed** — five
files now state the *widened* reading in full, passing only because each cites this one, and **no tell
covers the widened wording**. So the next widening repeats this session unless it is registered too.

## What the denominator inherits

The corpus derives its denominator from [`../goldens/skills/`](../goldens/skills/), which ships **three
accepted drifts** ([#358](https://github.com/sleepy-panda-srl/portulan/issues/358)) and one deferred
reduction ([#359](https://github.com/sleepy-panda-srl/portulan/issues/359)). A row whose exemplar
population is one of those holes is marked **inherited**, never **measured** — otherwise an accepted
drift in customer zero's own tree arrives through this instrument dressed as a finding about the arm.

An early draft did exactly that, reporting *"proposal `enforcement-present` exemplars fail 20 of 33"* as a
measurement about arm A. It is [#358](https://github.com/sleepy-panda-srl/portulan/issues/358).

## What may not be concluded

- **No figure here measures an agent.** Nothing has been run. Every measurement in this file and in
  [`arm.md`](arm.md) is about the instrument or about the tree.
- **Three scenarios, plus a fourth on a test.** Not eight. The retired four are a finding about what the
  vendored tier can be asked, not a backlog.
- **Scope.** A baseline recorded over this arm is scoped to the tier [`arm.md`](arm.md) specifies, and
  closes row 8 for no other configuration of *"Portulan on"*. **The argument is in
  [`../../docs/milestones/m08.md`](../../docs/milestones/m08.md) and the observation in
  [`../README.md`](../README.md); this line cites them rather than restating the claim a third time**,
  which is the defect this file's own registration section is about. Row 8's criterion is untouched:
  narrowing a criterion is a maintainer's amendment, not an implementer's line.
