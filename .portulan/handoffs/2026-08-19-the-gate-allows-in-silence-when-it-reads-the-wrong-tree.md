# Handoff — the gate allows in silence when it reads the wrong tree

**Post-M7 hardening, session 24. Full lane, in progress.** No milestone row moves. Continues
[#220](https://github.com/sleepy-panda-srl/portulan/issues/220), whose first arm merged as
[#295](https://github.com/sleepy-panda-srl/portulan/pull/295). Baseline `a2c0f91`, suite **1725**.
Implementer Opus 5, identity line checked at boot before any file was written.

## What landed today before this arm started

**#295 merged** (`7aed889`) after three more Copilot findings, all real: a stale `maxBuffer`
rationale that described a limit the same change had removed; a bare `*` pathspec that silently
matched nothing under `GIT_NOGLOB_PATHSPECS` — reinstating the very gap that arm closes; and **four**
independent `today()` calls on one path, where a stop spanning local midnight could search history
for a date nobody checked the tree for.

**#220 was closed by that merge, against a standing ruling, and is reopened.** I had removed
`Closes #220` from the pull request body and verified `closingIssuesReferences` returned `[]` — and
treated that as sufficient. It is not: that field reflects the **body only**, and this repository
rebase-merges, so every commit message lands on `main` and is parsed too. The branch's first commit
still carried `Closes #220.` in its body and closed the issue at merge. **Two carriers, one checked.**
The commit message on `main` is now permanently wrong about the issue; the correction lives on the
issue instead, which is where a reader arriving from the commit lands.

## The premise this arm rests on, measured rather than assumed

The record carried **no** measurement of a Stop payload's shape, and the whole arm depends on one
field. Probed with a temporary instrument, wrapped so it could not affect the verdict, reverted after:

```
keys: session_id, transcript_path, cwd, prompt_id, permission_mode, effort,
      hook_event_name, stop_hook_active, last_assistant_message, background_tasks, session_crons
```

**`cwd` is present.** Had it not been, this arm would degrade to precisely what #295 already ships,
and building it would have been ceremony — which is why it was measured before the plan, not after.

## The defect, demonstrated with the real binary

Two repositories: a **told** tree (clean, carrying today's handoff) and a **session** tree (a live
divergent repo with unrecorded work and no handoff). The payload names the session tree in `cwd`;
`CLAUDE_PROJECT_DIR` names the told one.

- The gate **allows, with empty stdout** — it says nothing at all.
- Control, same payload with the hook pointed at the session tree: it **blocks**. So the obligation is
  real and the gate simply never saw it.

This is the direction the merged arm cannot reach: both its naming arms live inside
`if (!handoffPresent && didWork())` and fire only when the gate blocks. A false green, which this
runner's own doctrine ranks worse than the false red the first arm removed.

## Status

Plan at the session-open checkpoint; no implementation file written yet. The acceptance criterion is
the silent-allow case above, not the visible one — a suite that only exercises the block path would
pass without touching this.
