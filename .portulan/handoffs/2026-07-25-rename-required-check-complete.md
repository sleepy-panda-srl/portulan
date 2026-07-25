# Handoff — the required check now says what it asserts

**State.** Done, and the three-step sequence in
[`../proposals/0004-ci-runs-every-declared-recipe.md`](../proposals/0004-ci-runs-every-declared-recipe.md)
is complete. `main` requires `workspace-verify`, pinned to app 15368; the transitional `docs-integrity` job
is deleted; one job, one context, and the name describes the work. Nothing about *what* is enforced changed
at any point in the sequence — only what the enforcing job is called.

**Decisions + why.**

- **The rename happened as a sequence rather than an edit, and that was not caution for its own sake.** A
  required context cannot be renamed in a pull request: the old context stops reporting, protection waits
  for a check that never arrives, and `enforce_admins` means the resulting block cannot be forced past.
  Fails closed and stuck. So: new job alongside → maintainer re-points protection (Gated) → old job
  deleted.
- **Step 3 was a deletion, not a migration**, because step 1 put the work in the *new* job and left the old
  one thin. That choice looked arbitrary at the time — both read identically once written — and it is the
  whole reason this change moves nothing but a comment block.
- **Protection was changed through the `required_status_checks` sub-endpoint, not `PUT …/protection`.**
  The latter takes the entire protection object and silently resets any field omitted from the payload, so
  a one-field change made that way would have dropped `enforce_admins`, conversation resolution, and the
  force-push block. A settings tweak would have become a hole in the floor, with no error to notice.
- **The check is pinned to app 15368.** Without an app id, any GitHub App reporting a check of that name
  satisfies the gate. The branch-protection UI does not surface this and the `contexts` API shape does not
  carry it; only the `checks` form does. Recorded in [`../gate-map.md`](../gate-map.md) because it is
  invisible from every place someone would normally look.

**Verification, read back from the live repository rather than assumed.**

```
required: [{"app_id": 15368, "context": "workspace-verify"}]
enforce_admins: true    reviews: 0    conversation resolution: true
```

Both contexts were green on `main` at the moment of the switch, which is what made it safe to do in one
step instead of two.

**Open questions.**

1. **The floor has not been re-probed since the rename.** It was demonstrated once, in the milestone-1 arc,
   by attempting a direct push and being rejected. The settings read back correctly now, but reading
   settings back is assertion — the same distinction this build applies to everything else. Worth one probe
   push, rejected and discarded, at a moment when interrupting the run costs nothing.
2. **`CODEOWNERS` is still absent**, unchanged and carried forward. No path-specific human is required on
   any file, including the constitution.

**Next action.** Milestone 2, session 2: `doctor`, the demo workspace with more than one product, and the
claims-against-the-tree lint. `doctor` becomes a required check the moment it is declared in
[`../workspace.json`](../workspace.json) — no workflow edit and no settings change — which is the payoff
the previous two changes were for. Also due there: sweeping the two provenance notices, now that the
constitution carries both forms.

**Recoverability.** One workflow file and five documents. Reverting this commit restores the transitional
job, which would then report a context nothing requires — harmless, and not a route back: protection now
points at `workspace-verify`, so restoring the old name would need the same three steps in reverse.
