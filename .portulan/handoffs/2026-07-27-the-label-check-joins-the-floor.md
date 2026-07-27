# Handoff — the label check joins the platform floor

**State.** `pr-labeled` is a **required status check on `main`** as of 2026-07-27, pinned to app 15368
alongside `workspace-verify`. Applied at the settings layer, read back whole, and then demonstrated red
first. Five files: the gate map, the label memory entry, the workflow's own header, plus this handoff and
the `docs/plan.md` Session log entry. All six verify recipes green, each read for its **exit code**.

**Decisions + why.**

- **Applied by the command the repository had already written down**, in
  [`../memory/every-pull-request-carries-a-label.md`](../memory/every-pull-request-carries-a-label.md),
  rather than by composing a fresh one. Both contexts sent whole, both carrying `app_id`, `strict`
  repeated — because the `checks` array is replaced rather than appended to, and a `PATCH` meant only to
  add a context will silently drop `workspace-verify`'s pin if the array omits it. That is the trap #46
  had already paid to discover one field over.
- **Read back and diffed against a before-image, not spot-checked.** Three fields moved, all of them the
  addition. `strict`, `enforce_admins`, conversation resolution, the force-push and deletion blocks, the
  review count, linear history, lock-branch and signatures were compared individually and are unmoved.
  Spot-checking the field you changed is how you miss the field you did not.
- **Timed for zero open pull requests.** A required context that has never reported blocks every open
  pull request lacking the workflow, and `enforce_admins: true` leaves nobody able to force past —
  proposal `0004`'s expensive lesson. With nothing in flight there was nothing to trap, so the ordering
  risk this rule was written to respect cost nothing to honour.
- **Demonstrated rather than asserted**, per the 0007 rule that a watcher earns its place by being
  watched. This pull request was opened **deliberately unlabelled**: `pr-labeled` `fail`,
  `mergeStateStatus: BLOCKED`, `mergeable: MERGEABLE` — no textual conflict, the platform refusing on the
  required check alone. Labelled, it read pass and `CLEAN`. **The re-run came from the `labeled` event
  with no push**, which converts the workflow's "the trigger list is load-bearing" comment from a
  prediction into a measurement: without it the check would stay red with no way to clear it but an empty
  push, a gate that fails closed and traps the change.
- **Three documents said it was not required and were corrected in the same change** — the gate map's
  floor table and its ungating paragraph, the memory entry's "not yet a required status check", and the
  workflow's header comment. Per
  [`../memory/a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
  this is the *understating* direction, which is the harder one to catch because it reads as modesty
  rather than as a claim. Left alone, the repository would have described its own floor as one check
  short.
- **The gate map's dated read-back of #46 was left as written.** It says "the required check still
  `workspace-verify`", which was true of that measurement and is explicitly past-tense. Editing a record
  of what was observed then, to match what is true now, is the fabrication this repository refuses;
  correcting the *current* statements is the fix.

**Open questions.** None. `doctor` now lints both contexts against workflow job ids, because the
gate-map row names both and it reads every backticked token in that row — verified in this working copy,
where it reports one note per context.

**Next action.** None for this branch.

**Recoverability.** The settings change is live and independent of this branch: if the documents were
reverted, `pr-labeled` would remain required and the tree would go back to understating its own floor.
The before-image of the protection object was captured and diffed, so the change is reversible by
sending the `checks` array back with `workspace-verify` alone — Gated, and the maintainer's call.
