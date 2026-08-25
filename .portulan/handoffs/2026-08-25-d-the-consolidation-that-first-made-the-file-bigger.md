# Handoff — the consolidation that first made the file bigger

**Date:** 2026-08-25 · **M8 (Evals & telemetry) — no milestone row moves** · Implementer: Opus 5.

**No clause of row 8 is served or consumed by this session.** It serves the `memory-stays-small`
mandate in the agent memory store. Row 8's Status and Sessions cells are untouched, and with that cell
now reading `1 per clause` this entry must not be read as spending clause budget.

## What this is, and what it is not

A librarian consolidation pass on the **agent memory store** —
`~/.claude/projects/…/memory/` — which holds the
assistant's operating facts. **Not** the repository's `.portulan/memory/`, which holds minted rules with
provenance and retirement conditions. Nothing crossed between them, in either direction.

**That store is not a git repository** (measured: `git rev-parse` → *not a git repository*), so this
pull request cannot carry its edits as a diff of its own. It carries them **verbatim in the PR body**
instead, as the full before→after, and the fresh-context pre-commit pass read that diff alongside this
one. Without it, *drafts through the human gate* would be a claim with no mechanism: rejection would be
unrestorable and the file's own header prices every lost line at a live re-measurement.

## The result

| file | before | after |
|---|---|---|
| `portulan-gotchas` | **794** / 800 | **754** |
| `portulan-supervised-build` | 763 | **596** |
| `portulan-feedback-loop` | 547 | 596 — it *absorbed* a merge |
| `portulan-build` | 550 | 519 |
| `portulan-backlog-board` | 444 | 464 — one measured update |
| `MEMORY.md` | longest line 160 chars | longest line **157 chars**, one line per memory |

## The thing worth reporting is that my first pass made it worse

**The first rewrite of `portulan-gotchas` came out at 845 words — fifty-one over where it started, and
forty-five over the budget it was supposed to repair.** I had demoted the largest bullet and still lost
ground, because the honest version-width header and two new cross-references cost more than the cut
saved.

The second attempt reached 783 — under, by seventeen words, which is not headroom. The third reached
713 only after I turned the instrument on **my own additions**: a "charter" paragraph explaining the
method, and pointers written as prose rather than as routes. **A demotion that trades forty words of
fact for twenty-five words of explanation is not a consolidation.** The method belongs in this handoff,
which nothing loads at boot; the file gets the route and the fact.

**It closed at 754, not 713**, because the pre-commit pass found one of those routes pointed at a
carrier that does not hold the passage, and the two facts came back. The full arc is
**794 → 845 → 783 → 713 → 754**, and the last step is the one worth keeping: a consolidation is allowed
to end larger than its best intermediate when the difference is a fact nothing else holds.

## Passage → carrier, for every line cut

The skill's rule is that a demotion to a carrier that does not hold the passage is a deletion wearing a
pointer, so each was verified line by line **before** the cut, not after.

| cut from the store | verified carrier |
|---|---|
| GitHub Packages: scope=owner · `--access public` does not govern · greyed per-package org flip · neither flip has an API · token needed even when public | `.github/workflows/publish-github-packages.yml` header, L7 · L30 · L39 · L44–45 · L18 |
| …no Packages sidebar when logged out | handoff `2026-08-19-c-the-customer-facing-surface-was-a-build-log` |
| …curl reports the opposite, the heading being a hydration-removed skeleton | handoff `2026-08-19-the-instrument-that-could-not-see-the-thing-it-was-asked-about` |
| App `FORBIDDEN` on thread resolution; `resolvedBy` telling resolved from judged | `.portulan/gate-map.md` L824, L1187 · `.portulan/tools/gh-bot` docblock |
| `git cherry` over `git branch --merged`; the `128`-on-unknown-ref trap; `--rebase` | `.portulan/gate-map.md` L223–253 |
| **NOT cut, on the pre-commit pass's finding:** `git remote prune origin` for the stale `git branch -r` entry, and fetch-`main`-FIRST before any merged-check | **no carrier anywhere in the tree** — the first draft pointed both at gate-map, which does not hold them. A pointer at a carrier that does not have the passage is the deletion this table exists to prevent, and I wrote one. |
| `BEHIND` and the `strict: true` behind it | `.portulan/gate-map.md` platform-floor table, L1159 |
| the three checkpoints, *demonstrated not asserted*, `vision.md` human-owned, the dated-handoff mandate | `gate-map.md` *Supervised-build checkpoints* · `dod.md` 7–8 · `core/engine.md` · `memory/constitution-is-human-owned` · `memory/every-session-ends-with-a-handoff` |
| the `/model` command's false success narrative | handoff `2026-08-18-the-brief-was-wrong-about-its-own-mechanism` L8–9, L13 |
| the #43 defect-class ruling's argument | `.portulan/proposals/0020` |
| *"lines were gameable"* in the index line | `memory-stays-small.md`'s own 2026-08-18 measurement |
| **COMPRESSED AWAY, not demoted — no carrier:** Copilot's ~626s silent-case figure and the 150–390s range over 9 rounds on #298–#300 | none. The distribution's *extremes* survive in the bullet — ~90s typical, 3m17s fastest, 10h32m silent — and those are what the rule turns on, so the interior of the range was judged cost rather than shape. Named here because a compression nobody records is indistinguishable from a loss. |

**Four passages were searched for a carrier and KEPT because none holds them**: the roles-split ruling
with his verbatim quote and the same-model incident behind it; *"ALL supervisor feedback is binding,
optional included"*; the uniform-rules preference (*"exceptions should be applied as last resort"* — no
carrier anywhere in the tree); and the `gh pr merge` trap above. **#119 was on that list and should not have
been:** I checked the wrong handoff — *"nine numbered"* is `2026-07-30-the-loop-gets-its-fresh-verdict`
describing a different session — while #119's own handoff,
`2026-07-30-a-round-gets-its-definition` L157–167, carries the nine *and* the items, the
seven-minutes-stale outward claim included. Caught by the pre-commit pass. The bullet is demoted to that
carrier and keeps only the two precisions the record does not hold: Copilot's own two presentational
faults, and the census off by 8. **A carrier search that reads the wrong file returns the same answer as
one that finds nothing**, which is why this table names files and lines rather than conclusions.

## Three things were measurably wrong, and that is the pass's real yield

1. **`portulan-build`'s CURRENT block was stale in six figures** — `main`, the merged set, the recipe
   count, the suite count, the corpus size, and the Sessions cell it called *pending his number*. Its
   own rule is *replace CURRENT at session close*; two sessions did not. Replaced, and **every figure
   re-measured 2026-08-25 18:21 from its own instrument** — `recipe-set.mjs` (18), `verify/tests.sh`
   (1958), a parse of `evals/goldens/gates/` (241 cases / 20 files) — never copied from the plan I
   wrote them into.
2. **The CLI stamp said 2.1.227; the host is 2.1.240.** **Not re-stamped** — that would assert a
   re-measurement nobody ran. The header now carries both numbers with their meanings and says nothing
   has been re-tested.
3. **A superseded duplicate, already adjudicated inside the store.** `portulan-gotchas` prescribed
   `--input <file>` for replies; `portulan-feedback-loop` names that note and overrules it from a later
   measurement. **Not a contradiction to escalate** — one record had already overruled the other and
   the loser was never cleaned up. Deleted, with its one surviving half (`--input` needs `</dev/null`)
   merged into the record that won, carrying both parents' provenance.

## What was looked at and deliberately left alone

`portulan-branch-conventions` (647) and `portulan-lessons-artifact` (324) have 153 and 476 words of
headroom, and their claims verify against `gates.json` as it stands. Pruning them would be the routine
the skill warns against. `portulan-backlog-board` took one measured update — the open-issue population
it reasons from has moved 40 → 47 — and nothing else; its three cited urgent issues are all still open.

**No budget was raised.** That is the one move this pass may not make, and `memory-stays-small.md` is
untouched.

## Verification

Every recipe the manifest yields, exit codes read directly, never through a pipe. Store side: word
counts re-measured per file after the pass, every file under 800 with headroom, `MEMORY.md` one line per
memory and every line under 160 characters. Seam scan clean over every path the diff touches, the commit
message, the branch name **and the store diff before it entered a world-readable PR body**, with a
planted control term proving the scanner fires. Fresh-context supervision at both moments.

**The bounded Copilot loop runs on this pull request until it is empty**, per
[[portulan-feedback-loop]]'s four rules — one push per round, records last, threads gate while
suppressed notes do not, two fix-rounds then triage — answered on **both** channels through
`.portulan/tools/gh-bot` with `.user.login` read back, and **no merge while a round is outstanding**.
Named here because the session-open pass asked for it and the first draft of this handoff did not have
it anywhere.
