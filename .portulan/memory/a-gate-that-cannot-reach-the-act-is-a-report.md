**type:** rule
**scope:** workspace — any check run before an irreversible or outward act, and the seam scan above all
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/309`
— on 2026-08-19 a client identifier from the private context reached this **public** repository in a
commit message. The scan that would have stopped it ran in the same shell command as the `git push`
that carried it, so its result could not reach the decision. Ruled by the maintainer the same day:
leave `main` alone, record it.

**A check whose result cannot change what happens next is a report, not a gate.** Run it as its own
step, read the answer, and only then act. If the two share a command, they share a fate: the act
proceeds on the exit status of the last thing in the chain, and the check becomes an audit trail for
a decision nobody made.

**Why it holds.** The seam scan was written, correct, and passing most of the time. It fired on the
right token. It named a real client term. And it changed nothing, because by the time its output
existed the push had already run — the shell does not care what a scan printed. **Three seam-gate
failures in one session, two of them caused by this ordering, and the second happened after the
first had been recorded and the ordering declared fixed.** Writing "gated on before this commit" in a
commit message is not the same as gating.

**What it cost, measured rather than estimated.** One client directory name, message-only, in one
commit (`a15dde4`) on `main`. Not in any tracked file, not in any line of code, repository public,
zero forks. Removing it would mean rewriting a protected branch — unprotect, force-push, re-protect —
which breaks every clone, invalidates every SHA the records cite, and still leaves the old objects
reachable until GitHub garbage-collects. The maintainer ruled the cure worse than the disease and the
incident recorded instead. **The record is the remediation**, which is only true because the exposure
was a directory name; it would not be true of data, a person, or a document.

**What catches it when the ordering fails:** the at-the-act sweep before a merge. That is what caught
this — after the bytes were public. **That is the whole difference between a gate and a report**, and
it is why the merge sweep exists even though every commit is supposed to have been scanned already.

**Retire when:** the seam scan runs as a hook that can refuse the push itself, rather than as a step an
agent is trusted to sequence correctly. Until then this is prose, and prose is what failed here.
