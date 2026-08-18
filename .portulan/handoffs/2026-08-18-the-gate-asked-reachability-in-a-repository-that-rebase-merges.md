# Handoff — the gate asked reachability in a repository that rebase-merges

**Post-M7 hardening, session 23. Full lane.** No milestone row moves. Closes
[#220](https://github.com/sleepy-panda-srl/portulan/issues/220). Suite **1706 → 1713**, twelve
workspace recipes plus the pack-composed `tools/github:actions-pinned` green — **re-measured on the
final head after rebasing onto `d6498f0`**, which is the tree these figures belong to. `main` moved
twice under this session: [#291](https://github.com/sleepy-panda-srl/portulan/pull/291) merged at
13:04Z and the organisation was renamed `sleepy-panda-works` → `sleepy-panda-srl`, so every issue URL
written earlier in this change was dead on arrival and was corrected before the rebase. Implementer Opus 5,
identity line checked at boot before any file was written. **[#264](https://github.com/sleepy-panda-srl/portulan/issues/264)
was demonstrated and deliberately not built** — see *What is parked, and how far it got*.

## The defect

`cli/stop-gate.mjs`'s third did-work signal asked `git log HEAD --not --remotes`: **a reachability
question, in a repository that rebase-merges.** A rebase-merge rewrites commits, so a merged branch's
originals sit on no remote; once the remote branch is deleted on merge they never will. Every commit
of every merged-and-deleted branch therefore satisfied it **permanently**, and any checkout left on
such a branch reported *this session did work* forever — demanding a handoff from a session that had
done nothing.

The class was already named in this repository for a different tool
(`../memory/a-branch-syncs-with-main-before-it-merges.md`, *"a rebase-merge leaves the branch tip an
ancestor of nothing"*), and the sanctioned instrument named there is `git cherry` — comparison by
**patch-id**. The gate asked the same wrong question the record exists to answer.

## Demonstrated red before the fix, with the real binary

A fixture whose branch was rebase-merged and whose remote branch was then deleted, driven through
`node cli/stop-gate.mjs` with a payload on stdin:

| signal | result |
|---|---|
| 1 · `git status --porcelain` | empty — falls through |
| 2 · `@{u}` | `fatal: no upstream configured` — falls through |
| 3 · `git log --oneline HEAD --not --remotes` | **2 commits** → `didWork()` TRUE |
| `git cherry origin/main HEAD` | all `-`, **zero `+`** → every patch upstream |

The gate blocked that clean, fully-upstream tree with *"no handoff dated 2026-08-18"* — the
2026-08-10 incident reproduced, including its compound: the handoff present on `origin/main`, absent
from the stale cwd tree.

**The fixture's own premise assertion earned its place.** The first draft cherry-picked onto the same
parent with the same identity inside the same second and reproduced the **original sha** — no orphan,
so the case tested nothing. A rebase-merge is modelled with a distinct committer date, and the
premise line is what caught it.

## The repair

**Signal 3 compares by patch-id.** The coarse reading runs first and bounds the expensive one
(nothing on no remote by reachability means nothing by patch either). No remote at all still reads
every commit as work — the documented reading, so it reports nothing. Otherwise the base is the
remote's own recorded default head, never a branch picked by name.

**The fail-open that decided the spelling, and which this repository had already paid for twice.**
`git cherry` against an unknown ref exits **128 printing nothing**, so counting `+` lines alone reads
a failed command as *nothing unmerged*. Measured here in both directions — unknown ref → exit 128,
`+` count 0; real base with real work → exit 0, `+` count 1. The test is **exit 0 AND zero `+`**, the
exit half carried by the throw. `../gate-map.md` and `cli/init.mjs`'s `delete-a-remote-branch` reason
already record this trap; `didWork()`'s own docstring records a catch-turned-`false` that once
*silently disabled the handoff gate*.

**Could-not-tell fails CLOSED and says so.** When the refinement cannot be made, commits-on-no-remote
is already an established fact and only the excuse failed, so the coarse reading stands as **true**
with a stderr sentence naming what could not be compared. Reading it as *no work* would convert a
case that blocks today into a pass — a relaxation, and this gate's own message says relaxing a check
is the change to scrutinise hardest. The asymmetry settles it: a wrong block is capped at
`MAX_BLOCKS` and speaks; a wrong pass is unbounded and silent.

## The second half, and the narrowing that is on the record rather than implied

`handoffToday()` reads the directory under `WORKSPACE`, derived from whatever the host told the hook
or the cwd happens to be — so the gate could ask about one tree and answer from another.

**#220 offers rescoping the gate to the tree the session wrote to, and that is the more thorough
repair. It is not what shipped, and the reason is not convenience:** the incident's worktree had been
*removed*, so the tree to rescope to no longer existed to be read. What a reader actually lacked was
any sign that a true sentence was about a tree they were not thinking of. So the refusal now **names
the working tree and the branch**, and where a handoff dated today exists on some other ref already on disk
it says so — commit and ref — instead of only that this tree lacks one. It still blocks, because the
gate cannot know this session wrote that file; what it no longer does is send a reader to write a
duplicate, which `docs.sh`'s record check would then have refused.

**No network, deliberately:** a Stop hook runs on every attempt to end a turn, so this reads refs
already on disk — `--all`, which is local branches too, not only remote-tracking ones. The sentence is scoped to match — *absent from this working tree* is always true
when it fires; *present at `<ref>`* only where a fetched ref shows one.

## Tests — the shape the repository's own record prescribes

Seven cases, **every one spawning the real binary against real git fixtures**, not an injectable
runner. The session-open checkpoint corrected the plan here and was right: `gate.test.mjs` states the
argument (*"a unit test on `decide` would have passed on every day the hook was blind"*), the arm
shipped on #208 rejected a test-only export whose only caller is the entry block, and the defect here
is precisely that **real git behaves otherwise than the signal assumed** — a stubbed runner is a copy
of that assumption. **Four of the seven were red before the fix** — measured by running the new cases against `7fba76c`'s runner, not inferred: the orphaned-and-upstream case, the degraded-stderr case, and both tree-naming cases. The remaining three are controls (genuinely-unmerged, handoff-present, no-remotes-at-all) and passed on **both** sides, so the repair could not be a fail-open. _(An earlier draft of this handoff said two. That was the first describe block's count, written before the second was added and never re-measured — the pre-commit checkpoint caught it.)_

## Sibling sweep

Instrument, **as it actually ran** — the BRE alternation matters, and the plan first transcribed a
`-E`-less variant with bare pipes that returns **0** hits:

```
grep -rn -- "--not --remotes\|--no-merged\|branch -d\|is-ancestor" cli/ .portulan/verify/ .github/
```

7 hits, **all of them `pack-version`'s `--is-ancestor` argument-injection guarding** — a different
question. This grep sweeps the space-separated CLI spellings a shell or a document would carry; it
cannot match the defect site itself, which spells the flags in argv form (`"--not", "--remotes"`).
That spelling was swept separately across `cli/`, `.portulan/tools/` and `.github/`, and
`cli/stop-gate.mjs:262` was the only reachability-verdict site in either. **The instrument did not find
the defect and is not claimed to have** — it establishes that no OTHER carrier states the assumption in
prose or shell.

## Prose carriers updated in the same change

`cli/stop-gate.test.mjs`'s header and `cli/README.md`'s `stop-gate.test.mjs` row both said the
runner's I/O was *deliberately* untested. The new cases make that false, so both now say which half
is tested and which two are still not.

## What is parked, and how far it got — #264

**Not built. Demonstrated end to end, so the next session starts from the measurement rather than
re-deriving it.** Live on this host: `rituals/checkpoints` resolves from the discovered cache root at
**0.2.0** while the tree carries **0.2.1**, and the rail pins `--pack-root packs`.

With an isolated `CLAUDE_CONFIG_DIR` — a cache plus a **version-2** `installed_plugins.json`, which
is the part that took three goes; discovery refuses a record with no `version`, and a cache directory
alone is not discovered — carrying a fragment the tree does not have:

- unpinned `compile --pack-root auto` emitted `.claude/settings.json` containing
  `"Bash(git push --mirror:*)"`;
- the pinned rail then went **RED exit 1**: *".claude/settings.json has drifted from
  .portulan/gates.json. Recompile."*;
- that rule id had **0** hits in tracked files before this record was written — this handoff is now its
  only carrier, which is the point rather than an exception — and the RED names the cache **0** times.

**Beyond what the issue records: the RED's remedy is "Recompile", which typed unpinned is the act
that caused the drift. The remedy loops.** That message lives at `cli/compile.mjs:2165`, which was
inside [#291](https://github.com/sleepy-panda-srl/portulan/pull/291)'s diff for the whole of this
session and was therefore off-limits. **#291 merged at 13:04Z while this change was at its
pre-commit checkpoint**, so that file is free again and the follow-up is unblocked — the deferral
was real when it was made and is no longer a constraint.

**Two routes, and the cheaper one needs no `cli/compile.mjs` at all:** #264's *Retire when* is an
explicit OR, and its compare-and-report branch is satisfiable in `doctor` alone (comparison data
from `discover.mjs`), provided the report says **what differs** and not merely that a shadow exists.
Arm 4 — recording the resolution roots in the emitted artifact — needs `cli/compile.mjs`, which is
now available.

## Honest limits

- The rescoping arm of #220 is **not** built, by the reasoning above. Whether naming the tree is
  enough is the maintainer's call at close, which is why it is stated here and in the closing comment
  rather than left for a reader to infer from the diff.
- Nothing observes that a session's handoff is *this* session's. The gate checks a date and a
  directory, as the doctrine's checkable form says, and the history sentence is a report.
- `didWork()` still runs against `REPO`, which is still the told-or-cwd root. Naming it does not make
  it the right tree; it makes the wrong tree visible.
