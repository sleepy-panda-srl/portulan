# Proposal — a tier says who attends; a checkpoint says what is owed

**Status. RULED, 2026-08-09** — by a fresh-context Fable 5 supervisor under the maintainer's named
in-session delegation on [#174](https://github.com/sleepy-panda-works/portulan/issues/174), the third
ruling delegated this way after [`0022`](0022-a-claim-about-a-mechanism-is-re-derived-like-a-figure.md)
and [`0023`](0023-a-head-that-never-draws-a-round-needs-an-answer.md). Like both of those, **it corrected
the framing it was handed rather than picking from the options offered.** Accepted on merge.

**Pull request:** https://github.com/sleepy-panda-works/portulan/pull/194

## The question as it was put, and why none of its answers was taken

#174 reported two carriers disagreeing about when the pre-commit checkpoint is owed —
[`packs/rituals/checkpoints/skills/pre-commit/SKILL.md`](../../packs/rituals/checkpoints/skills/pre-commit/SKILL.md)
saying *before committing*, [`../gate-map.md`](../gate-map.md) putting the gate at the pull request — and
offered two resolutions, each making one carrier cite the other. A third, doing both, was put to the
maintainer; he delegated the ruling instead.

**The two carriers never disagreed.** The gate map's own checkpoint table has always read:

| Checkpoint | When |
|---|---|
| Pre-commit | before any commit |

**No carrier in this tree puts this checkpoint at the pull request** — not core, not the pack, not this
workspace. That boundary was an *inference* from the Auto tier, and #174's premise inherited it.

## The distinction the inference missed

**A tier says who must attend an action. A checkpoint says what the session owes before it acts.** Auto
means no *person* waits — *"nothing here asks a person for anything"* — not that nothing is owed.

This gate map already holds exactly that coexistence, and has since 2026-07-27: *"the seam scan is a
**commit**-time obligation, and commits were already Auto — so nothing moves from checked to unchecked."*
The pre-commit checkpoint is the same shape at a higher blast radius. Reading the tier as the boundary
converts every commit-time obligation into a nullity the moment the action becomes unattended, which is
the opposite of what moving push to Auto was argued for.

## What this overturns, explicitly

[`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md), *Where this lands*, records #168 as
*"compliant with the gate map, out of order under the pack's sentence."* **That is half wrong and the
half that is wrong is load-bearing.** #168 was compliant with the *tier* half of one file, and out of
order under that same file's checkpoint table, the pack's sentence, the skill's own frontmatter
(*"Grade a finished diff before it is committed"*), and core's floor (*"the diff before it goes
outward"* — the pull request **is** outward under this workspace's own tier design, and it opened while
the verdict was pending).

So #168 is reclassified as the breach class the Session log already names on
[#137](https://github.com/sleepy-panda-works/portulan/pull/137): *"**Breach recorded:** the doctrine
commit went out before pre-commit ran."* **Forward-only** — #168's own record is not rewritten, and
`0020`'s file is not edited. The sentence is overturned here, which is `0020`'s own precedent for a
merged sentence: *overturned here rather than left to disagree quietly*.

## Why each offered resolution was refused

**(1) The pack defers to the adopting workspace's gate map.** Refused. Named moments are the *pack
layer's* one contribution — [`0018`](0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md)'s
altitude table assigns exactly this to it — so deferring the moment makes the pack's contribution a
pointer into a file an adopter may not have. Worse, a skill *named* `pre-commit` whose *when* defers to
gates that classify **attendance** would invite, in every adopting workspace, the same conflation that
produced #174 here.

**(2) This workspace records the merge as its boundary.** Refused. It contradicts this workspace's own
breach records, forfeits the checkpoint's stated value — *"the last point at which a defect is cheap"*,
where a post-pull-request finding costs a public push and a Copilot round under the review-loop bound
instead of an edit — and breaks customer zero: *"If the doctrine will not hold for its own repository,
it is not ready to ship."*

**(3) Both.** Inherits both defects.

One kernel of (1) survives, in one narrow slot: the pack's **recovery** clause legitimately defers what
*outward* means to the adopting workspace's gates, because only the adopter knows which of their acts
puts work in front of someone first.

## The carrier designation

| Carrier | Role |
|---|---|
| `packs/rituals/checkpoints/skills/pre-commit/SKILL.md` § *When to use it* | **operative** statement of the moment, at the procedure altitude |
| `.portulan/gate-map.md` § Supervised-build checkpoints | binds it in this workspace's words, and **cites** |
| `.portulan/gate-map.md` Auto bullet `commit-to-a-working-branch` | carries the clause at the point a session actually reads before committing, and **cites** |
| `packs/rituals/checkpoints/README.md` § The three checkpoints | declared a **summary** of each skill's own statement, not a second carrier |
| `core/operating/evolution.md` — *"the diff before it goes outward"* | the deliberately loose **floor**, knowingly left |

Core is knowingly left because [`0019`](0019-the-development-cycle-is-doctrine-not-anecdote.md) fences
it: core does not set who grades or when. Naming the commit in core would put a pack's moment into core
and invert the cascade. That floor does not compete with the commit moment — it bounds it, and #168
breached even the floor.

## Siblings swept, and what each owes

`core/operating/loop.md` (obligation, no timing) — nothing. The pre-commit skill's frontmatter — nothing;
it is already the cleanest existing statement of the ruling. `personas/supervisor.md` (*"a diff before it
commits"*) — nothing; it agrees, and an enumeration is a use rather than a competing carrier.
`.portulan/dod.md` conditions 5 and 7 — nothing; 7 already cites the gate map for *which* work, and 5 is
the pattern this ruling generalises. `docs/plan.md` row 7 clause (c) — nothing; it assigns the customer
the **threshold** and the **who**, not the moments, which is precisely this ruling's split. Records —
Session log, milestone files, handoffs — forward-only, untouched.

## What this does NOT settle

- **It adds no rail.** Verdict-before-commit stays prose plus the breach-record practice. The mechanical
  check — a verdict record required before the commit — is the form check `0020` §6 already named and
  refused pending a fixed verdict format. That pointer stands; this proposal does not build it.
- **It does not require a checkpoint per git commit.** Work-in-progress commits, and the fold-in commits
  discharging an APPROVE-WITH-ADJUSTMENTS verdict's numbered adjustments, take no fresh pass —
  REQUEST-CHANGES already requires its own second pass. What post-verdict *Copilot-round* fixes owe is
  the review loop's business, and the known hole there is `0020`'s named limit rather than anything
  resolved here.
- **It moves no tier and adds no human attendance.** Commits, pushes and force-push-with-lease stay Auto;
  the merge stays Gated; nothing returns to the pre-2026-07-27 push gate.
- **It does not forbid preparing the supervisor early** — only committing, pushing or opening the pull
  request for finished full-lane work before the verdict returns.
- **It does not decide the lane boundary.** Which work is full-lane remains the adopting workspace's
  threshold; `0018` is unchanged.

## The adopter with no gate map

Not left without a named moment, and this is the strongest argument against resolutions (1) and (3),
which would have created exactly that orphan. Under this ruling the pack's skill states the primary
moment operatively on its own — finished full-lane work is graded, then committed — and no gate map is
needed to locate it. What a gate-map-less adopter lacks is two things, both deliberate and both
pre-existing: the **lane boundary** (`0018`'s design — only the adopter knows their blast radius) and the
**recovery** moment's referent, the one slot where the pack legitimately defers, with *a pull request is
the usual first one* as the stated default. That is acceptable: **the pack ships and gate maps do not.**

## Decision

**Taken.** The boundary stays where every carrier that states it already put it — the pre-commit verdict
is owed when full-lane work is finished, before that finished work is committed. No tier moves, no human
attendance is added, and this workspace records no pull-request boundary because none ever existed
outside an inference. `0020`'s clause is overturned above; `0020`'s file is left alone.
