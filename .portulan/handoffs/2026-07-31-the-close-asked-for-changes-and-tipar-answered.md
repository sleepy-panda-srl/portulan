# Handoff — the close asked for changes, and the Tipar drive answered it

**Date:** 2026-07-31 · **M6, session 2 (continued past midnight)** · Branch
`records/the-close-asked-for-changes`

**State.** **Milestone 6 is still open, and for one reason only: `tipar#46` is not merged.** The
milestone-close checkpoint ran against the merged tree and returned **REQUEST-CHANGES** — clauses 1–4
demonstrated, clause 5 half. Both repairs it asked for are merged. The Tipar half it refused now
exists as [`tipar#46`](https://github.com/sleepy-panda-srl/tipar/pull/46), carrying the artifacts
whose absence was the refusal.

## Why the close refused, because the reason is not what it looks like

The Tipar work already in the tree — `#42`, `#43`, `#45` — is good work. The close did not say
otherwise. It said the record contained **no checkpoint verdict on a full-lane task**, and **nothing
recording a phase that read the layer from a feed INSTALL**: that session edited a working *clone* of
the feed. Which is this project's own rule turned on itself — *a from-the-feed claim cannot be met by
a local copy* — the rule `--pack-root` was built to enforce in #117.

So the gap was never quality. It was that the loop left no evidence it had run, and a demonstration
that leaves no evidence is indistinguishable from one that did not happen. Worth holding on to: the
clause is about the **loop**, and the loop's output includes its own record.

## What the two repairs were, and why the first one matters beyond itself

**The feed workspace failed its own recipe when run from the install.** `repos/tipar.md` linked
`../../../README.md`, which resolves in the clone layout and points outside the plugin once installed,
because a workspace lives at `workspaces/<name>/` here and **is** the root there. Links red, 1 of 21.
The merge-time green had been run against the clone.

**That is [#121](https://github.com/sleepy-panda-srl/portulan/issues/121)'s class one level up**, and
it arrived one merge after that class was closed in the public engine. There the lesson was *a check
must ask the repository, not the disk it runs on*. Here it is **a check must run in the layout the
consumer gets** — and for a feed-delivered workspace the consumer's layout is the install, never the
repository. The feed has no CI, so nothing else was going to notice.

The second was `spec/pack.schema.json` claiming nothing resolves `contributes` paths and an escaping
value is inert. `cli/index.mjs` has resolved, opened and contained them since 2.6. Condition 4 in the
safe direction — the code stricter than the document, which is the direction that hides.

## The Tipar drive found two vulnerabilities, and the second was the one I missed

**Magic-link single use did not hold under concurrency** — read, check in memory, save, with no
concurrency token anywhere in that codebase. **And `tipar.session` shipped without `Secure` in
production** on both hosts: `SameAsRequest`, Caddy terminating TLS and proxying over plain HTTP, no
`UseForwardedHeaders` anywhere. The session-open checkpoint found the second one and corrected my
severity reasoning on the first.

**Reproducing the race took three attempts and the first two passed.** Two concurrent callers: green,
three of three. Sixteen behind a barrier: still one success. The defect needs both callers to **read
before either writes**. A control that cannot fail is not a control, and two of mine could not.

**The severity argument I shipped in the plan was also wrong.** I claimed mail-scanner prefetch made it
reachable without an attacker; scanners prefetch at *delivery*, which is the sequential case, already
refused. The checkpoint replaced it rather than softening it — correctly, because a false framing gets
the true argument discounted with it.

## The recurring class, now with a count

**Six prose defects in #129, and four more here** — a wrong base sha, a false "the tool is not
installed", a comment the diff falsified, and one overstatement repeated at four sites. Every one is a
*claim about a mechanism* that was wrong while the mechanism was right. Checkpoints and drills attack
mechanisms; nobody attacks the sentences about them.
[#133](https://github.com/sleepy-panda-srl/portulan/issues/133) holds the argument. The cheapest
remedy is still one line in the pre-commit skill: re-derive the diff's claims about the diff's own code.

## For the next session

**Merge `tipar#46`, then re-run the close.** Clauses 1–4 will not need re-arguing; the checkpoint said
so itself. Then the close records land: row 6's Status with the fidelity note, the Session log, and
both of the maintainer's rulings written into `m06.md` as **readings of the row, not amendments**.

**Carry these into the close verdict.** The `skills`/`verify` labels in `spec/pack.schema.json` still
do not name M7's `vendor`, which the "declare" ruling depends on — measured, not assumed. Tipar's half
is publicly unverifiable where Portulan's is checkable, and the verdict must say so rather than average
them. And a **deploy is owed on Tipar** before either security fix is true for a customer.

**Still unfiled:** the maintainer's repository-vs-portfolio exclusivity question. The cascade has
exactly one workspace layer, so two carriers is ambiguity rather than layering, and per-repo policy
belongs in the repo card. That is the mechanical argument for his instinct and nothing records it yet.
