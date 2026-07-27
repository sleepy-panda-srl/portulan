**type:** rule
**scope:** workspace — every pull request into `main` in this repository
**provenance:** `form=link` `href=../handoffs/2026-07-27-nothing-merges-behind-main.md`
— the maintainer's ruling, Marius Cetanas, 2026-07-27, and the state of the repository when it was
taken: three open pull requests, each exactly one commit behind `main`, one of them reported by GitHub
as `CLEAN` and `MERGEABLE` and therefore mergeable on the spot.

A pull request does not merge while its head is behind `main`. Sync first — rebase the branch onto
`origin/main` and push it with `--force-with-lease` — and merge only once `main` is an ancestor of the
head. The two halves are one rule: *behind* is the condition, *sync* is the remedy, and the merge is
what waits.

**Why it holds:** the required check is `workspace-verify`, and CI runs it on the `pull_request` event
against `refs/pull/N/merge` — GitHub's test merge of the head into `main` **as `main` stood when the
check ran**. Nothing re-runs it when `main` moves afterwards. So a green check on a branch that has
fallen behind is a true statement about a tree that no longer exists, sitting beside a merge button
that will produce a different one. The gap is not theoretical here, because this repository's recipes
check *correspondence* rather than syntax, and correspondence is exactly what two independently green
branches break when they meet: `links` goes red when one branch deletes a file another links to, `map`
when one adds a top-level directory and another rewrites the README's layout table, `record` when one
adds a Session log date whose handoff is on the other. Each side green, the union red — and red on
`main`, where the next pull request inherits it and the required check stops distinguishing that
branch's defects from the one it was handed.

**When to apply:** immediately before every merge, as the last thing checked rather than something
remembered at open time — a branch that was in sync when it was reviewed is behind the moment anything
else lands. One command answers it, from the remote and without a fetch:

```
gh api repos/sleepy-panda-works/portulan/compare/main...<head> --jq .behind_by
```

Zero is the only acceptable value. Locally the same question is `git fetch origin main && git merge-base
--is-ancestor origin/main <head>`, and note the direction: `--is-ancestor` is asked here whether **main
is an ancestor of the branch**, which it answers honestly. The inverted question — *has this branch
merged* — is the one it lies about, because a rebase-merge leaves the branch tip an ancestor of nothing.

**This one is a rail, applied the same day it was written.** `required_status_checks.strict` is **`true`**
on `main` since 2026-07-27 — *Require branches to be up to date before merging*, on the maintainer's
explicit instruction, per
[`../proposals/0011-no-merge-from-behind-main.md`](../proposals/0011-no-merge-from-behind-main.md). It was
`false` until then, which is exactly why GitHub had been calling a branch one commit behind `CLEAN`. With
`enforce_admins: true` beside it the requirement reaches everyone, so this rule is one of the few here
that no prompt has to carry: a behind pull request reports `BEHIND`, the merge is refused, and updating
the branch re-triggers `pull_request` so the required check re-runs against the merge that will actually
happen. Verified at the settings layer immediately after the change — `strict: true`, the required check
still `workspace-verify` **pinned to app 15368**, `enforce_admins`, conversation resolution, and the
force-push and deletion blocks all intact.

[`../gates.json`](../gates.json) also states the precondition in the reason on `merge-a-pull-request`, and
that is a courtesy rather than a second layer: on a bare `gh pr merge` the permission rule matches, the
host **discards the hook's reason**, and the agent sees the generic prompt — measured, and the reason
[`../compile/gate.mjs`](../compile/gate.mjs) exists at all. The sentence reaches an agent only on the
wrapped spelling the permission pattern cannot see. The platform is what holds
([`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md)).

**Retire when:** merging into `main` stops being how changes land here — a merge queue is the case to
expect, since a queue tests each change against the tip it will actually sit on and so enforces this by
construction. That makes the *mechanism* redundant, never the intent, so this entry moves into the
queue's description rather than being dropped.
