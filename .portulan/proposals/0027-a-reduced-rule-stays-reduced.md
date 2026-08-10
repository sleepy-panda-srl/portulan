# Proposal — a reduced rule stays reduced

**Status. PROPOSED, 2026-08-10** — the rail in this change is built and demonstrated; the rule it
enforces is the maintainer's to accept, amend or refuse. Two questions for him are marked **Q1** and
**Q2** below.

## Incident

Milestone 7's composition amendment changed *what set CI runs*: since `cli/recipe-set.mjs` landed, the
runnable set is what the manifest **yields** — the workspace's own recipes plus those its composed packs
contribute — and no longer what it **declares**. The rule was carried in prose at eleven sites.

- `3cf47e9`, the change that landed the mechanism, repaired **two** of them.
- [#206](https://github.com/sleepy-panda-works/portulan/pull/206) repaired two more, independently,
  three weeks later.
- [#222](https://github.com/sleepy-panda-works/portulan/pull/222) swept the remaining **ten**, and
  needed **three instruments** to find them, because each was blind to what the last had found:

| The instrument | What it could not see |
|---|---|
| grep for the retired sentence *"CI runs every recipe the manifest declares"* | `.portulan/identity.md`'s **roster** — seven recipe names where nine belong. It shares no word with the sentence. |
| a sweep for numerals near *recipe* | the root `README.md`'s *"every verify recipe the workspace **declares**"* — a **different spelling**. It survived **three sweeps across two branches**. |
| both of the above | `.portulan/dod.md` condition 1 and `plugin/skills/portulan/SKILL.md` step 3 — the rule in the **imperative**, telling a session what to run. |

`plugin/skills/portulan/SKILL.md` carried the rule **twice** and was repaired at one. The second carrier
was found by a fresh-context checkpoint, contradicting the first carrier's fix **eight screens below it
in the same file**.

**This is [`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s class, recurring inside the
repair of another instance of it** — and `0020` is accepted doctrine that has been in the tree since
2026-08-07.

## Why the doctrine already in the tree did not prevent this

It is important to answer this, or the proposal is `0020`'s sentence written a second time — which
would be the defect it names, committed on itself.

`0020` did not fail. **It predicted this**, and said why no rail could stop it
([`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md), *Enforcement*):

> **For the class as a class, no rail is possible.** A rule has no token. Nothing can grep for *this
> patch's rule's other carriers*, and no hook, gate or eval can observe that a fix has unswept siblings
> — the sibling set is exactly the thing nobody has enumerated, or the defect would not exist.

That argument is correct and this proposal does not contest it. **It turns on the word *unenumerated*.**

The move here is narrow and it is the whole idea: **an incident enumerates the sibling set. At that
moment, and only then, the rule acquires a token** — the spellings its carriers actually used. `0020`'s
theorem is about rules nobody has swept. This rail operates **only on rules an incident has already
swept**, and its job is not to find carriers. It is to **keep a completed reduction reduced**.

That distinction is not theoretical. It is the measured failure of this same day:

- #222 removed the count and roster from `.portulan/repos/portulan.md` and pointed the sentence at
  `cli/recipe-set.mjs` — a reduction.
- #206 had already repaired the same line by **re-arming** it: a fresh count, a fresh roster, both
  hand-maintained, both able to go stale again.
- A sibling handoff on `main` is titled
  [`the-correction-merged-and-the-next-pull-request-put-it-back`](../handoffs/2026-08-10-the-correction-merged-and-the-next-pull-request-put-it-back.md).

**Reduction is the repair; nothing holds a reduction in place.** `core/operating/evolution.md` already
ranks *removing what would otherwise need enforcing* above catching, and `0020` §1 makes it earned prose.
Neither can observe the sentence coming back.

## Proposed rule

> A rule that an incident has reduced to **one carrier** is **registered**: the carrier, and the
> spellings its other carriers used. A registered rule's spellings may then appear only in that carrier
> or beside a citation of it. A verify recipe enforces this, and **a registered rule's coverage grows by
> incident** — each new spelling found is added, permanently, rather than swept once.

Registration is a **step in an existing ritual**, not a new one. `packs/rituals/checkpoints/skills/pre-commit/SKILL.md`
step 4 already requires the pre-commit checkpoint to *"sweep the siblings of every defect the diff
repairs"*. This adds: **when that sweep finds carriers, register them.** The sweep is where the
enumeration happens, so it is where the token is minted.

## What ships in this change

- **`.portulan/rule-carriers.json`** — the registry. One entry per registered rule: `id`, the `carrier`
  path, a `summary`, the `incident` that registered it, the `tells` (spellings), the `cites` (what counts
  as pointing at the carrier), and the `scope` globs it binds over.
- **`cli/rule-carriers.mjs`** — the instrument, zero-dependency, with its suite written first.
- **`.portulan/verify/rule-carriers.sh`** — the thin wrapper, in the shape `index.sh` and
  `control-chars.sh` already established: dependency guard, named-list audit, exit-code passthrough.
- **One registered rule** — the recipe-set rule that earned it. **Arrears are named, not pretended**: the
  registry starts with one entry, and every other rule in this repository is unregistered and therefore
  uncovered, which is stated here rather than left for a reader to discover.

Declaring the recipe in `workspace.json` is what enforces it — no workflow edit and no branch-protection
change, which is [`0004`](0004-ci-runs-every-declared-recipe.md)'s machinery working as designed.

## What this catches, and what it cannot

**Catches.** A registered spelling reappearing anywhere in scope — including the re-arming measured
above; a registered carrier deleted or moved while its tells still bind; a new file adopting an old
spelling.

**Cannot catch, and the rail must never be described as if it could:**

1. **A rule nobody registered** — the entire class until its first incident. This is `0020`'s theorem,
   untouched. The rail is a **ratchet over the registered set**, not coverage of doctrine.
2. **A novel paraphrase sharing no registered spelling.** The root `README.md`'s *workspace declares*
   survived three sweeps for precisely this reason; only a deliberately over-broad tell reaches it.
3. **Counts and rosters.** `.portulan/identity.md`'s seven-recipe roster shares no words with any
   sentence, so **no tell can reach it**. That subclass wants *derive-and-compare* — a card's roster
   against the manifest, tree-against-tree, the shape `doctor` already uses for gate-map-versus-workflows
   — and it belongs to [#187](https://github.com/sleepy-panda-works/portulan/issues/187), not here.
4. **A sentence that cites the carrier and then contradicts it.** `spec/slots.md` already states this
   ceiling for its own reverse check: what no check can hold is whether a sentence contradicts the rule
   it names.

**The registry's own inventory has `doctor`'s mirror-hole and it is unclosable.** `doctor` audits a
workspace's declared list against the tree; nothing can audit a *rule* registry, because "the doctrinal
rules of this repository" have no enumerable token — `0020`'s theorem again, one level up. A rule never
registered is covered by nothing, and nothing says so.

## Enforcement, and the three ways this rail refuses rather than passing

An exemption nobody audits is the allow-list defect this repository has already paid for
(`.portulan/verify/README.md`, on `control-chars.sh`'s `EXEMPT` array). The registry is an allow-list of
spellings, so it is audited the same three ways, each **exit 2 — could not run**, never a quiet green:

1. **A carrier path that does not resolve** — the rule points at a file that is gone.
2. **A dead tell** — a spelling that matches nothing anywhere in the tree, including the carrier. Either
   the rule was rewritten and the registry was not, or the tell was wrong when written.
3. **A registry that does not parse, or a rule missing a required field.**

**The record layer is out of scope by construction**, not by exemption: `.portulan/handoffs/`,
`.portulan/proposals/`, `docs/milestones/`, `docs/plan.md` and `CHANGELOG.md` legitimately quote retired
sentences forever — [`0004`](0004-ci-runs-every-declared-recipe.md) keeps its own minting words under a
dated supersession note, and this repository's records are forward-only. A rail that scanned them would
be red on arrival and permanently, which is the failure
[`a-superlative-is-a-count-nobody-ran.md`](../memory/a-superlative-is-a-count-nobody-ran.md) refused a
grep over. The anchoring precedent is `docs.sh`'s `plan` check, which binds two retired patterns to
milestone-table rows only — the difference between a rail and an unusable one.

**The per-file citation exemption is a strong check rather than a total one**, and its weakness is
declared: one citation anywhere in a file exempts that file. The same declared weakness as the gate
reverse check. A file that cites the carrier once and restates the rule wrongly elsewhere passes.

## Demonstration — run, not described

**Red against the real historical tree**, which is the strongest form this repository recognises. In a
scratch worktree at `27705ae`, the pre-sweep commit, the rail exits **1** and names five carriers:

```
.portulan/dod.md            ("recipe `workspace.json` declares")
CONTRIBUTING.md             ("recipe the manifest declares")
README.md                   ("verify recipe the workspace declares")
plugin/skills/portulan/SKILL.md  ("declared, not composed")
spec/slots.md               ("from the manifest and runs each one")
```

**The root `README.md` is in that list** — the carrier three human sweeps across two branches missed. On
today's tree the rail exits **0** over 350 files.

**Every verdict was forced**, none inferred: exit 1 by planting a restatement in an uncited file; exit 2
three ways — an absent carrier, a dead tell, an unparseable registry; exit 0 restored after each.

**Two misses are demonstrated rather than implied**, because a rail's boundary has to be shown:

- `.portulan/identity.md`'s **seven-name roster** is not caught, and cannot be. No tell reaches a count.
- `cli/README.md` and `.github/workflows/verify.yml` are not caught **even though they carried the
  rule**, because each cites `recipe-set.mjs` elsewhere in the file and the citation exemption is
  whole-file. This is the declared weakness, measured rather than predicted.

### What the demonstration found in the instrument itself

Three defects, none visible by reading, each found by running or by forcing red — which is this
repository's own argument for why demonstrations are not ceremony:

1. **The tool exited 0 having run nothing.** The direct-invocation check compared `process.argv[1]` with
   `new URL(import.meta.url).pathname`, and this working copy lives under *Sleepy Panda Projects* — a
   URL pathname percent-encodes the spaces, so the comparison silently failed. `fileURLToPath` now.
2. **The dead-tell audit was self-satisfied.** Every tell is spelled in the registry, so scanning the
   registry made every tell find *itself* and read as alive. It reported green over a tell matching
   nothing else in the tree. It passed the first demonstration only because the registry was untracked
   in that scratch worktree — a green that was an artefact of the fixture.
3. **Markup between the words of a sentence, three variants of one trap** — a markdown link's URL, a
   line wrap, and bold markers inside the phrase. Four of the first seven tells matched nothing because
   of the first two; the third surfaced only when the audit was forced red.

**And the byte rail this repository already owns caught a fourth.** `cli/rule-carriers.mjs` shipped
**four raw NUL bytes** — a map-key separator where a raw NUL was meant, which is
[#68](https://github.com/sleepy-panda-works/portulan/issues/68)'s incident exactly. `file` classified the
source as *data* and **`grep` returned nothing for strings that were plainly there**, which is how it was
noticed at all. `control-chars.sh` named it in one run. A rail written against instrument blindness was
itself silently corrupted, and an existing rail caught it.

Both this recipe and any successor join milestone 8's scheduled forced-red drill calendar.

## Honest limits

- **This is a ratchet, and a ratchet's coverage is exactly its history.** It cannot be forced-red into
  covering a rule nobody met yet.
- **It binds unannotated text**, which is the property that makes it a rail rather than a discipline
  wearing one's clothes: an author marks nothing, and the tells bind passively. The human dependency sits
  at registration time, inside a checkpoint step that already exists.
- **A tell-list nobody updates is frozen coverage, not a fail-open** — between incidents it keeps firing
  on every spelling it knows, with no maintenance. But it also stops growing, silently, and nothing
  measures that.
- **It does not reduce anything.** Reduction stays the repair and is performed first; this holds the
  result. A rule registered without being reduced would be a registry entry pointing at one of several
  live carriers, which is worse than nothing.

## Questions for the maintainer

**Q1 — is the registry's home right?** It ships as a workspace file (`.portulan/rule-carriers.json`),
which makes it customer zero's and reaches no adopter. The alternative is a slot in the Workspace
Definition, which makes it a product feature and a spec version. **The conservative answer is
workspace-side first**, and this change takes it; promoting it later costs a spec MINOR.

**Q2 — should registration be *required* of a sweep, or offered?** As proposed, the pre-commit step says
*register what you found*, which is a discretionary instruction of the kind you have consistently ranked
below mechanical ones. The mechanical version is a form check — a checkpoint verdict must carry a
registration disposition — and that is exactly what
[`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md) §6 named, refused, and said was **worth
building the day the verdict format is fixed**. Fixing that format is your ruling, and it is asked for in
[`0028`](0028-a-records-world-claim-carries-its-instrument.md).

## Provenance

`form=link`
`href=`[`https://github.com/sleepy-panda-works/portulan/pull/222`](https://github.com/sleepy-panda-works/portulan/pull/222)
— the sweep that found ten carriers with three instruments and needed a fresh context to find the last
two. In-repo and resolvable by anyone who can read this rule; it carries no client material, so no seal
is needed.

**Decision.** PROPOSED — awaiting the maintainer. Q1 and Q2 are his; the rail in this change stands or
falls with the rule.

**Pull request:** [#223](https://github.com/sleepy-panda-works/portulan/pull/223) — the change that filed this.
