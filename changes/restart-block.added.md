- **A workspace can declare that a crossed restart threshold also holds a turn's end, once.** Workspace
  Definition 2.13 adds `spend.restart`. `"advise"`, what every workspace has, is the restart advisory's line,
  once, with a tool result or at a prompt. `"block"` keeps that line, and `compile` writes a second `Stop`
  command beside the Stop-gate's, [`cli/advisory.mjs`](../cli/advisory.mjs)'s `stop` mode: at the first stop
  at or past the threshold it holds the turn's end with the same line as its reason, once in a session and
  again after each compaction. Nothing ends a session, and the Stop-gate's counters and caps are untouched.
  Undeclared or `"advise"`, `.claude/settings.json` compiles byte for byte as before; `doctor` gates the key
  to 2.13 and names a declared block in its line on the session switches. Nothing offers it: the threshold
  is an estimate, and at the general multipliers it comes early for a model whose cache reads cost less
  than a tenth, so this repository declares no block.
