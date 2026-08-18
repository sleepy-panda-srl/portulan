# Handoff — the wire reaches an artifact adopters receive, and the constitution catches up

**Milestone 7, session 2, second batch** — [#158](https://github.com/sleepy-panda-srl/portulan/pull/158).
**M7 still open.** `vendor` itself is not in this batch; what is in it is the thing `vendor` was waiting on.

## What landed

Both compiled-hook runners moved from `.portulan/compile/` — which `package.json`'s `files` has **never**
shipped — into `cli/`. Every adopter's compiled policy named two files they did not have, and **a missing
hook fails open**, so the gate they were told they had was one they did not have. `npm pack` now carries
**83 files including both**. Plus the maintainer's `docs/vision.md` edit widening `vendor`'s gloss to
cover both switch directions, which finally gives the residence switch its verb.

## The file move was never the fix, and that is the finding

**Both runners derived the adopter's workspace from their own file position** — `HERE/..`, `HERE/../..`.
That is true in exactly one layout: the author's. From `node_modules/@sleepy-panda-srl/portulan/cli/` a
runner has no idea where the workspace is, and inferring one would be
[#131](https://github.com/sleepy-panda-srl/portulan/issues/131)'s class in the two tools with the most
to lose from it. The project root is **told** now — `CLAUDE_PROJECT_DIR || cwd`, `||` rather than `??` so
an empty env var falls through instead of resolving every path against `""`.

## What the pre-commit checkpoint caught, and it was asked to

Two of its findings were things this session had flagged as *belief rather than evidence*, and both beliefs were wrong in the way that matters:

- **`spell()`'s absolute fallback recorded nothing.** The comment promised `refused` would say a hook was
  pinned to this machine; the code pushed to nothing, and compiling from outside a project emitted two
  absolute hooks in silence. A dod-condition-4 violation written by the session that was fixing one.
- **`compile --workspace <other>` reintroduced the exact fail-open this task exists to close.** It wrote
  the target project's settings naming *this* project's runner — a file the target does not have, failing
  open silently. The `root` plumbing existed and the caller never used it.

`||` versus `??` was the third thing flagged, and there the instinct was wrong in the safe direction: the
checkpoint ruled `||` correct, for the empty-string reason above.

## Decisions a later session would otherwise re-derive

- **The two runners differ on a missing workspace, deliberately.** `stop-gate.mjs` blocks loudly — a
  Stop-gate with nothing beneath it. `gate.mjs` steps aside silently — a `PreToolUse` hook that cannot
  read the policy must not block every call, and the compiled permission rules still hold under it. The
  first draft of that paragraph claimed the strict behaviour for both.
- **`PORTULAN_WORKSPACE` is read and set by nothing.** It exists so a workspace under another name is not
  unreachable. Now documented rather than latent.

## Undemonstrated, named

Context 3 — an absolute-path hook exercised by a **live host** — has never happened; the emission and the
note are demonstrated, the run is not. `init` still drafts the binding and does not run `compile`, so an
adopter's workspace has no compiled hooks until their human runs it. The handoff-index rail still has no
spelling, deferred to [#148](https://github.com/sleepy-panda-srl/portulan/issues/148) by ruling.

## What comes next

`vendor` and the switch — now unblocked — then `upgrade`, verify composition, clause (b)'s parity,
`feedback`, the interview loop, and the six demonstrations.
