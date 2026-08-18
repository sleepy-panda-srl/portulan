# Handoff — the correction was not the one the issue predicted

2026-08-09, second of three sessions off the board's `Now` column, on
`m7-a-claim-about-a-mechanism-is-a-figure`.
[#133](https://github.com/sleepy-panda-srl/portulan/issues/133): fix the one instance the issue
deliberately left unfixed, and file a proposal on the class. Both here; the ruling is the maintainer's.

## The instance, and why it is worth more than a one-line fix

#133's row 6 was *"The sentinel is a byte no path can hold."* The issue proposed narrowing it to *"this
repository treats that byte as unrepresentable in a tracked path."* **Measured, that narrowing is also
wrong.** git tracks a filename of any bytes but NUL and `/`; `a<0x01>b` commits cleanly.

What actually holds belongs to the recipe rather than to the filesystem: the lists `docs.sh` compares
are built by `git ls-files` **without** `-z`, and git C-quotes a control character in that output
**regardless of `core.quotePath`** — measured in a scratch repo under `true`, `false` and default, all
three printing `"a\001b"`. `-z` emits the byte raw, which is why `control-chars.sh` could not reuse this
sentinel unchanged.

So the fix for a wrong claim was itself a claim that had to be measured, and the issue's own proposed
replacement would have shipped a second wrong sentence. **That is the argument for the proposal, made
by the instance.**

Two other corrections in the same stroke. The neighbouring comment cited
[#68](https://github.com/sleepy-panda-srl/portulan/issues/68) as *"the rail that would make such a
path impossible"* — wrong twice: **#68 is closed**, and the rail it shipped scans file **contents**,
never path names. And the new sentence itself carried a residual overclaim, caught at the checkpoint: it
covers the **path** channel only. A raw `\001` in a link **target** still reaches the sentinel through
the candidate list, collides, and prints the confidently wrong *escapes the repository root* diagnosis.
That is `control-chars.sh`'s to catch, and only when it runs — which the Stop-gate does not do for it.
Named in the comment rather than left.

## The proposal, and the finding that changed what it asks for

`0022` recommends **(b)** — strengthen the pre-commit ritual — over (a) derive-numbers and (c)
do-nothing, on the ground that (b) is the only one reaching **sentences** and now has two positive
instances.

**The first draft framed (b) as a new instruction, and the checkpoint refuted the premise.** Pre-commit
**step 3 already reads** *"Check every claim the change makes about itself"* — since `cea9ca4`,
2026-07-29, **the day before #133 was filed**. Adopting the draft would have made a second carrier of
step 3's subject: the two-carrier defect `docs/milestones/m07.md` recorded one milestone ago, committed
inside the fix for it. (b) is now **two clauses appended to step 3** — the *standard* (re-derive from the
mechanism; where the claim is about the world, from the world) and the *disqualification* (the author's
reading is not evidence). That materially changes what the ruling is about, which is why it is here.

## The thing worth carrying forward, which is embarrassing and therefore useful

The draft said the #183 suite was **"1082 tests"**. Written from session memory; measured, it is
**1089** at `3a17e48`. **A figure from memory, in the decisive paragraph of the proposal arguing that
figures from memory are wrong.** It is kept in the proposal as an erratum rather than silently
corrected, because it is the best evidence in the document that the class is not something other people
do.

## The ruling, taken the same day

The maintainer **delegated this ruling to a Fable 5 supervisor in session** rather than taking it
himself — his gate, exercised by someone else at his instruction, and the pull request still goes
through him.

**Accepted as (b), with one amendment**, and the amendment is the same class one more time. The draft's
opener was *"Re-derive rather than re-read"*. The supervisor refused it: the skill's own epigraph
already reads *"must **re-measure rather than re-read**"*, and step 1 carries *"Measured, never
derived"* with **derive pejorative** — so the draft would have minted a second slogan of the epigraph's
exact shape, three lines below, with the verb flipped in valence, in the one file whose header already
carries it. The final text *cites* the motto instead of coining a rival. Verified against the file
before accepting: epigraph at line 8, step 1 at line 26, step 2 at line 28.

**(a) is not bundled** — filed as [#187](https://github.com/sleepy-panda-srl/portulan/issues/187), so
the mechanical rail is costed as a build rather than decided inside a doctrine ruling. **The two errata
stand**, on the ground that a record which demonstrated its thesis against its own author is evidence,
and scrubbing it would trade a demonstrated claim for an asserted one.

One obligation the drafter had missed and the ruling added: the standing corpus is **unaudited** against
this standard, so a stale claim found in old prose after this lands is **arrears, not a regression**.

#133 closes with this change.

The proposal names its pull request by prediction, per
[#143](https://github.com/sleepy-panda-srl/portulan/issues/143)'s chicken-and-egg — `docs.sh` check 5c
asserts URL *shape* and never that the pull request exists, so the number was verified by hand after
opening rather than by any rail.
