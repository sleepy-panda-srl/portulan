**type:** rule
**scope:** workspace — every agent acting on this repository's GitHub surface
**provenance:** `form=link` `href=https://github.com/sleepy-panda-works/portulan/pull/8#issuecomment-5077446174`
— the milestone-2 pull request, where four review replies written by an implementer agent were posted
through the maintainer's credentials and therefore appeared under his name. Noticed by the agent that
wrote them, while answering a review about claims that are false against the tree.

Anything an agent writes on this repository's GitHub surface — pull-request comments, review replies,
resolved threads — must be attributable to a non-human identity at a glance, without the reader having to
know a convention.

**Why it holds:** the defect is invisible from inside the artifact, which is what makes it worse than an
ordinary inaccuracy. A reader of a pull request cannot tell that a reply attributed to the maintainer was
written by an agent; the record *reads* correct while being wrong about the one thing this repository is
most careful about. The same doctrine that refuses to backfill a handoff — because writing one after the
fact fabricates a contemporaneous artifact — forbids a review conversation that fabricates a human
participant. It is the identical failure with the author and the timestamp swapped.

The commit record is deliberately the **opposite** case and must not be "fixed" the same way: commits stay
under the maintainer's own git identity, because the build's provenance discipline depends on his
authorship there. Attribution is not a single principle applied uniformly — it is *who actually did this*,
and the honest answer differs between a commit the maintainer owns and a comment an agent wrote.

**When to apply:** before any write to GitHub that a human will read as prose. Posting through
[`../tools/gh-bot`](../tools/gh-bot) satisfies it; posting through the maintainer's default `gh` auth does
not.

**Enforced by permissions, not by discipline.** The agent identity is a GitHub App whose token can write
pull-request conversation and nothing else — it cannot push, merge, or change settings. The wrapper's
refusal of a few subcommands is a guard against habit and is trivially bypassable; the permission set is
what actually holds. That division is the usual one here: the machine bounds the blast radius, the human
judges the content.

**Interim state, and it is not yet true.** Until the App exists and the wrapper is configured, replies are
still posted under the maintainer's account carrying a signature line — a convention, which is exactly the
kind of unenforced rule this workspace keeps converting into rails. Related:
[`verify-preconditions-fail-closed.md`](verify-preconditions-fail-closed.md), the other rule this arc
produced.

**Retire when:** the agent no longer writes to a human-readable GitHub surface, or the platform itself
attributes agent authorship in a way a reader cannot miss. If a future host marks agent-authored comments
natively, this rule should *move* to that mechanism rather than be deleted — the requirement is the
attribution, not the App.
