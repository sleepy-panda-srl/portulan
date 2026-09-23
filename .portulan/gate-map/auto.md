# Auto — how the tier changed, and what the push costs

> The rest of the gate map's [Auto tier](../gate-map.md#auto--the-agent-acts-unattended): how its definition changed, and why
> pushing a working branch moved into it. The tier's rules are in the index; nothing here restates them.

[The tier's definition](../gate-map.md#auto--the-agent-acts-unattended) was rewritten on 2026-07-27, because the previous one — "recoverable and reversible inside a
working copy; nothing here reaches another person or a shared branch" — stopped being true the moment
working-branch pushes moved into this tier. A push does reach a shared remote. The tier's real boundary was
never the working copy: it is that an Auto action cannot change what the repository *is*, and cannot put
anything in front of anyone. A pushed working branch is visible and is not yet a claim on the repository. What
that visibility costs is stated below rather than defined away.

**Pushing a working branch was Gated until 2026-07-27, and the argument for gating it did not survive
inspection.** It is recorded rather than quietly dropped, because the reasoning it replaces is still the
reasoning behind the commit-attribution rule in [Which identity acts](identity.md).

The old argument ran: commits carry the maintainer's git identity, every push is approved, therefore his name
on a commit records a decision he actually took — *"remove the push gate and the commit attribution would
become exactly the fiction the comment attribution was."* The flaw is that **push was never the moment that
guaranteed it.** A commit's author is fixed when it is written, not when it is sent; and a commit on an
unmerged working branch is not part of this repository's record. What makes his authorship honest is his
decision to **merge**, which is where a commit actually enters `main` — and that stays Gated. The push gate
was a proxy for a guarantee that lives one step later.

What ungating it does not touch, all of it platform-enforced rather than promised: `main` rejects direct
pushes, force-pushes and deletions on `main` are blocked, `workspace-verify` and `pr-labeled` are both
required, conversation resolution is required, and `enforce_admins` leaves nobody an exemption. A working-branch push cannot reach
any of that. Every commit still carries `Co-Authored-By` marking the agent's hand.

**The one real cost, named rather than waved past:** a push is the moment content leaves this machine for
GitHub, and it was the last human checkpoint before that happened. The confidentiality seam does not depend
on it — the seam scan is a **commit**-time obligation, and commits were already Auto — so nothing moves
from checked to unchecked. But the honest statement is that an unreviewed push now publishes to a remote
where it may be cached or indexed. That was judged acceptable on a one-collaborator **private**
repository and was named as *the thing to revisit first if either of those facts changes*. **One of them
has changed: the repository is public again, so an unreviewed push is visible to everyone, not to
everyone with access.** This clause has therefore fired, and it is recorded as fired rather than
answered — the tier is Gated policy and the maintainer's alone, and the same clause fired at the
2026-07-27 flip and was likewise flagged rather than edited. Nothing here moves the tier; what moves is
the sentence that described the remote.
