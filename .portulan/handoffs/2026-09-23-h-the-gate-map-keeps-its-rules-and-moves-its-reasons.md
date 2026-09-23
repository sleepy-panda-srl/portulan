# Handoff — 2026-09-23: the gate map keeps its rules and moves its reasons

**What landed.** [`../gate-map.md`](../gate-map.md) is now the index a boot reads: each gate with its rule,
under its tier; the nine honest holes and the identity acts, one line each; the merge-discipline ruling, the
triage threshold, the checkpoint rules and the platform-floor table. The rest of each tier and topic, its
conditions, measurements, amendments and reasons, moved verbatim into nine on-read files under
[`../gate-map/`](../gate-map/), each linked from the index line it continues. The index opens by saying when
to read on: before a merge, a release, a settings change, a branch deletion, a review round, or an edit to
what a gate guards. Nothing was deleted; nothing is kept in both beyond a hole's title and an identity row's
action, which name what the on-read text continues; and the maintainer's rulings stay verbatim where they
landed. What stayed was decided by one test: a sentence that changes what an agent does in routine work
stays; one that explains why moves.

**Measured.** `gate-map.md` went from 143,030 to 26,959 bytes (−81%), about 47,840 to 9,020 tokens at
proposal `0036`'s estimated 2.99 bytes per token. The on-read files hold 126,965 bytes; the text as a whole
grew by 10,894 bytes of headers, headings, pointers, hole rules and identity keys. This repository's boot
read-set went from 211,673 to 95,602 bytes (−55%), about 38,800 fewer tokens per boot. **The demo
workspace's boot read-set is unchanged by this change**, at 36,195 bytes: it reads its own gate map,
[`../../examples/gate-map.md`](../../examples/gate-map.md), which this change does not touch.

**Why no proposal.** The gate map sends an idea that adds an axis, a mode or a surface to a proposal. This
adds none: no tier, mode, manifest key, slot or surface, and the `gates` slot still names `gate-map.md`. It
applies `0036`'s accepted one-level rule and its remedy for an expensive always tier, demotion to a later
tier, to the largest file this repository's boot reads. `0036` names two demotions as the first; this is a
third.

**Readers.** CODEOWNERS and the three scope lists in `rule-carriers.json` cover `gate-map/`, and the A/B
register gives it the gate map's own disposition. `compile.test.mjs` checks every on-read file for rule ids
no rule declares and that each is linked from the index; `telemetry.test.mjs` finds the consent refusals in
`gate-map/gated.md`, where they moved; `verify/README.md`'s five links to the 0007 rule point at
`gate-map/platform-floor.md`, which states it. About 150 prose references in about 45 files cite a gate-map
section or hole by name, and each still resolves, because every moved section keeps its heading and a
pointer in the index. Pointing them at the on-read files is a follow-up, as is one quotation in
`verify/drills.sh` of wording the gate map already lacked before this change. No record was edited.

**How it was checked.** The split was cut at text anchors, not line numbers, and checked sentence by
sentence against main's file: of 922 sentences and table cells, 178 stay verbatim in the index, 693 moved
verbatim, and 35 were edited, each by one of 39 recorded edits that turn *above* and *below* into links or
restore an antecedent a move left behind. The 16 units found in two files are the labels named above: 7 hole
titles and 9 identity action keys. All 44 section links resolve and no on-read file is orphaned. The new
test case was checked against a stale rule id and an orphaned file, and caught both.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38: no fresh-context runs unless he asks. The
coordinator session reviewed the diff before the commit; his review is on the pull request.

**Green in this container needs a non-root run.** As root, `tests` fails its permission cases, because a
chmod-000 fixture never denies root. All 27 recipes ran green as a non-root user on a copy of this tree.

**Next action.** His review of the pull request, and a Copilot request on it from the Reviewers menu, since
Copilot does not review a pull request an App opened (#161).
