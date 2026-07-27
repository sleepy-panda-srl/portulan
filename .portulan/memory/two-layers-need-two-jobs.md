**type:** rule
**scope:** workspace — anyone emitting belt-and-braces enforcement into a host
**provenance:** `form=link` `href=../handoffs/2026-07-27-the-enforcement-compiler.md`
— milestone 4, session 0. The enforcement compiler emitted every gate twice, as a permission rule and
as a hook. Measured, the second layer did not do the job it was emitted for.

When you emit two layers of enforcement for one rule, **measure what each layer actually contributes**
before shipping both. A layer whose output the other layer discards is not defence in depth: it is an
inert component that reads as an active one, and it will be cited later as a guarantee nobody checked.
Either find the job only that layer can do, or do not emit it.

**Why it holds:** measured 2026-07-27, Claude Code 2.1.220.

The plan was that the permission rule would hold the gate and the hook would supply the *sentence* —
`gates.json` already carries a reason written for exactly that moment, and "permission denied" teaches
nobody anything. Then a canary settled it: with a permission `ask` rule and a hook on the same command,
**the hook ran** — the marker file was written and the payload recorded the exact command — and the
agent still received the host's generic message. The hook's `permissionDecisionReason` was discarded.

Two more measurements decided what to do about it, rather than deleting the layer:

- **A hook that crashes fails open.** Exit 1 with non-JSON output, and the tool ran normally — on the
  identical wiring that blocked when the hook was healthy. So the hook can never be the load-bearing
  layer, and the permission rule must exist regardless.
- **A permission pattern is a literal prefix match.** `Bash(git push:*)` does not see
  `bash -c "git push …"`. The hook, which receives the command string, can — so it peels one wrapper
  and matches again. In exactly that case the permission layer has nothing to say, so the hook's
  decision *and* its sentence are what the agent gets. Demonstrated live in both directions.

That is the shape to keep: **the permission rule cannot fail open; the hook covers more ground.** Each
does something the other cannot, and the redundancy is now a claim that survives being checked.

**When to apply:** any time enforcement is emitted into more than one host mechanism — permissions and
hooks, a hook and a CI check, a client guard and a server guard. The question is not *are both
present* but *what does each one catch that the other misses*, and it is answered by removing one and
measuring, not by reasoning about the design.

**The near miss worth remembering.** Shipping the original design would have produced a hook that was
correct in isolation — its unit tests passed, its output was exactly right — and contributed nothing.
It would have been described in the gate map as the layer that explains gates to agents, and that
sentence would have been false from the first commit. This is
[`a-manifest-field-can-validate-and-load-nothing.md`](a-manifest-field-can-validate-and-load-nothing.md)
one milestone later, in the milestone whose whole subject is enforcement: the component was fine, the
composition was not, and nothing at rest showed it.

**Retire when:** the host surfaces a hook's reason alongside a matching permission rule, at which point
the layers genuinely are redundant and the choice becomes a preference rather than a design.

**Re-test on every Claude Code upgrade** — including the fail-open half. If a crashed hook starts
failing *closed*, the permission layer stops being the only thing that cannot be removed by a syntax
error, and the argument above changes shape.
