# Handoff — the four Now items, and a citation that was precise and wrong

Session of 2026-08-09, opened on the board's four open `Priority = Now` items and closed with three of
them merged. The fourth is narrowed, evidenced, and still open on purpose.

**State.** #173, #174 and #172 CLOSED by PRs #192, #194 and #193. #184 carries its bundle half in #195,
open. New: proposal `0024`, issue #196. Nine recipes green throughout.

## What each item turned out to be

**#173 — the store was not full of the thing the issue described.** *(Figures below describe the moment
before #193 landed; the store is 28 records and 120,677 bytes now.)* The 2026-08-08 pass had already run
the lifecycle's other half; what remained was arithmetic. A second compression of
`a-review-loop-needs-a-bound.md` (18,283 → 15,733, all four rules byte-identical, verified by extracting
the block from both revisions and diffing) freed 2,550 bytes. **The number it leaves behind is the
finding**: after an honest pass the store is 27 legitimate records with nothing retirable, and one more
average-sized rule breaches again. That is a decision — raise the rail in a change of its own, or accept
that a rule now displaces a rule — and it is the maintainer's, not this session's. The contradiction the
2026-08-08 pass surfaced (`repo-is-private-until-flip-clearance`'s tense) is **still unresolved and still
his**, now waiting since 2026-08-08.

**#172 — the branch it pointed at carried a stale tree.** `m7-a-superlative-nobody-counted` was tens of
commits behind — 57 against the `main` of the moment I first measured it, and further with every merge
since — and its tree held three memory records at pre-consolidation state, `a-review-loop-needs-a-bound.md`
among them at 23,596 bytes. **The hazard was narrower than I first wrote it**: the branch's own commit
touches one record, and a plain merge conflicts nine ways and auto-resolves all three to `main`'s side. What
would have reverted #173 is a *hand reconciliation* preferring the branch tree — the failure this project
has hit twice — not the merge itself. Corrected by the checkpoint on this record.

So the sweep was **rebuilt on `main`** and the census re-run. **That census was also wrong, and the way it
was wrong is the record's own subject**: it found 20 living occurrences across 18 files where there were
**22 across 19**, because the phrase wraps across comment-line boundaries and the scan could not see a
variant split that way. **Two carriers survive on `main`** — `cli/compile.mjs` and `cli/vendor.test.mjs` —
and the sentence claiming zero, "confirmed by re-running the census script", inherited the instrument's
blind spot. A rule against unmeasured superlatives shipped carrying a count run wrong.

**#174 — the two carriers never disagreed.** Ruled by a fresh-context Fable 5 supervisor under the
maintainer's named delegation, the third such ruling after `0022` and `0023`, and like both of those it
**corrected the framing rather than picking an option**. The gate map's own checkpoint table has read
`Pre-commit | before any commit` all along; no carrier anywhere puts the checkpoint at the pull request.
That boundary was an inference from the Auto tier, drawn by #168's session, ratified verbatim into
`0020`, and repeated in #174's premise. Recorded as `0024`, which overturns `0020`'s clause explicitly
rather than editing it.

**#184 — measured, not reasoned.** Deleting the `packs` key outright from `.portulan/workspace.json` and
reinstalling left the host's inventory **identical** — `Skills (7)` both times, the pack's three among
them. Registration is a property of `.claude-plugin/plugin.json` and nothing else, so a composed pack's
ritual was invocable by coincidence of a hand-written path. `plugin-lint` gains a `compose` check pinning
the two together both ways. **The adopter half is untouched** and #195 says so rather than closing #184.

## What the review loop found, and it is the session's real lesson

**The sweep replaced a vague superlative with a citation that was precise and wrong.** Nine sites were
given *"the class #91 names"*. **#91 is "An index that cannot be READ is reported as one that is
absent"** — the fail-open incident. `0020` names the two-carrier class. Copilot raised it at every site.

That is worse than what it replaced, and the reason is the sweep's own justification: a checkable claim
beats an uncheckable one **only if it survives the check**. A reader following the new citation lands
somewhere real and wrong; before, they landed nowhere. Ten pre-existing carriers use the same shorthand
in its *incident* form and were knowingly left, as **#196**.

Three more of the session's own defects came back the same way, all in changes about exactly them: a
proposal asserting a table cell **its own diff rewrites** (#133's class, inside a proposal about carriers
disagreeing); a citation naming `dod.md` condition 5 as *the seam scan* when that condition calls itself
*the pre-commit scan*, in the change ruling on two names for one obligation; and **an unmeasured
superlative written into `0024` by the session sweeping unmeasured superlatives out** — caught before
the push, in the same hour.

## Two mechanism notes worth keeping

**A thread sweep keyed on *who spoke last* misses promoted suppressed notes**, because the promotion is
posted by the agent. One note on #194 was resolved before it had been read. Key on *whether a reply
exists*.

**The #161 strand cleared on the next rebase.** `copilot-reviewed` went red on #193 with a re-request
accepted at 629s and no round at all; `main` moved, the branch was rebased, and the fresh head drew a
round in the usual time. No override was needed. That is a data point for #161 on a **user-authored**
pull request and it is on the pull request rather than only here.

## What this session did not do

**No fresh-context pre-commit checkpoint ran on any of the four diffs before their commits — the breach
stands**, and each pull request says so on its own face rather than leaving it to be discovered. Under
`0024`, merged in this session, three of them owed one.

**Fresh-context review arrived afterwards, which is recovery for a missed moment and not the moment.** Five
passes ran late on the maintainer's instruction: A-W-A on #192, #194, #195 and this record, and
**REQUEST-CHANGES on #193**. Every figure this handoff corrects above is theirs rather than mine, which is
the argument for the checkpoint made better than any sentence could make it.

Seam scan clean: no diff, commit message or branch name in this session carries client context.
