# Handoff — the four merged, and one issue closed by a keyword nobody meant

First handoff of 2026-08-09, and a merge record rather than a build session: the four pull requests this
session opened all landed today, and one of them closed an issue it had been corrected not to close.

**State.** `main` = `46e7b81`. Nine recipes green, suite **1059**, store **118,730 / 122,880**,
`claude plugin validate --strict` passes. Merged in dependency order, rebase-merged, branches deleted at
both ends after `git cherry origin/main <branch>` showed zero `+` lines:
[#179](https://github.com/sleepy-panda-works/portulan/pull/179) →
[#177](https://github.com/sleepy-panda-works/portulan/pull/177) →
[#178](https://github.com/sleepy-panda-works/portulan/pull/178) →
[#176](https://github.com/sleepy-panda-works/portulan/pull/176). Issues **#66** and **#148** closed;
**#134 reopened** — see below.

## The one thing here a diff cannot reconstruct

**#134 was closed by a commit message, not by a decision, and the decision had gone the other way.**

[#178](https://github.com/sleepy-panda-works/portulan/pull/178) carried `Closes #134` in an early commit
(`fce158c`). A fresh-context supervisor then ruled **KEEP OPEN**, the pull-request description was rewritten
to `Refs #134`, and a later commit (`56da8f0`) withdrew the claim in as many words. **GitHub reads closing
keywords from every commit a merge lands**, so the retracted one fired anyway and the issue closed on merge.
Reopened the same hour with the reasoning in a comment.

**The lesson is narrow and worth having:** editing the pull-request body does not retract a closing keyword,
and neither does saying so in a later commit. The commit that carries it has to be rewritten. Recorded in
[[portulan-gotchas]] as a measured platform fact, because nothing in this tree would have caught it.

## Why the supervisor was right, since the record should carry the argument and not just the outcome

The change measured `Skills (4) → Skills (7)` after correcting the declared skills path, and read that as
demonstrating row 7's clause **(b)**. It does not. **The same `Skills (7)` reproduces from a directory
containing no `.portulan/` at all** — registration is a property of `.claude-plugin/plugin.json`, not of any
workspace's `packs` array, so **composition plays no part in the result** and the result cannot demonstrate a
clause whose subject is *a composed pack in an adopting workspace*.

Two more, both verified rather than accepted: row 7's criterion says clause (b) closes #134 while **its own
Status cell in the same table cell still lists `(b) parity` as Left**; and **#123 does not hold the residue**
— its body contains `governed_by`, `pointer` and `boot` **zero times each**, and it predates proposal
[`0017`](../proposals/0017-one-repository-one-governing-workspace.md), which invented the pointer kind. So
closing #134 would have left the invisibility complaint carried by no open issue at all.

**Owed to the maintainer, and neither is an agent's to take:** row 7's clause (b) parenthetical needs
narrowing to the pack-registration half with a named carrier for workspace resolution, and if #134 is ever to
close, **#123 must be widened first** so the residue lands somewhere.

## What the merges cost, and what the loop bought

**#176 ran fifteen rounds**, each extension past the bound granted explicitly. It is the strongest evidence
this repository has for the loop: **rounds 4, 11 and 15 each found a different silent-loss path in the one
chain written to refuse silent loss** — a swallowed POST failure, three discarded stderrs, and an early
return on an empty body. Round 9 found a **marker anyone could paste** to suppress a finding, inbound and
untraceable. Round 7 found that the concurrency key added earlier in the same branch **bought nothing**,
because the await loop exited one layer in.

**Four claims this session were reasoned from the right document and refuted by running the thing**, three of
them the implementer's own. That is the sentence to keep.

## The rebase, because it is the part most likely to be repeated badly

All four pull requests touched the same append-only records, so each merge left the next behind. Replaying
#176's twelve commits through those conflicts is where a resolver quietly wins an argument — and it did, on
the first pass: rule 3's amendment and a CHANGELOG entry vanished into `--ours`. The repair was to restore the
two files the branch **owned** whole from its own tip and rebuild the four shared ones deterministically
(plan = main's plus one entry; index regenerated; changelog = union, newest first; the memory record =
#179's consolidated text with rule 3 spliced back in, which worked only because #179 deliberately left rule 3
byte-identical). Then verified by probing for each pull request's own carriers rather than assuming.

## Next

A separate session is taking #134's remaining half — pointer resolution at the boot, against the acceptance
criterion the supervisor wrote. Its two open questions are the ones named above and both are the
maintainer's.
