# 2026-07-27 — Autonomy is a setting now: three modes, two scopes

**What landed.** The tier table (Auto / Propose / Gated / Prohibited) is untouched and still classifies
actions by undoability. Beside it there is now a second axis — the **mode** — which says how often the
development cycle stops for approval: `auto` never, `gated` once at the ship step, `strict` at every push
and the ship step.

**This workspace declares `gated`**, which is also what the engine ships as its recommendation.

**The one number that matters for review.** Adopting the model changed **no gate**. The recompiled
`.claude/settings.json` differs from its predecessor by exactly one line — `"mode": "gated"` — and every
compiled permission rule is byte-identical. That was deliberate and it was the test of whether the model
was faithful to the posture it replaced: if it had not been, the artifact would have moved.

**What is deliberately NOT in this change: customer zero's own mode.** A ruling arrived mid-session that
this repository should declare `auto`. It was implemented, reviewed, and then pulled back out into its own
pull request — not because the ruling is doubted, but because the pre-commit supervisor found that `auto`
here **contradicts `docs/vision.md`**, which is human-owned and which no agent may edit. At `auto`, with
required approving reviews at 0, an agent could merge a change to `core/` with no human act whenever the
pull request drew no review comment; the constitution says *"No unsupervised self-evolution"* (`:81`) and
*"The human gate on rule changes … never remove it"* (`:113`). A constitutional question does not belong
buried inside a mechanism change, so it ships alone, carrying the redline options for his hand. **Do not
read this workspace's `gated` as a rejection of that ruling** — read it as the mechanism landing first.

**Why the names collide, and why that was not fixed.** The modes are Auto / Gated / Strict, and two of
those are already tier names. That is a genuine ambiguity, kept because the maintainer named them and the
words are the ones practitioners use. It is closed by *position*, not by renaming: a tier is a rule's
field, a mode is the policy's, and they never occupy the same slot. Prose says "the Auto tier" or "Auto
mode"; the bare word is wrong wherever both are in scope. **If a future session finds this costing real
confusion, that is the evidence for revisiting it** — and the place to look is whether anyone has written
the bare word and meant the other thing.

**The four rails, because they are the reviewable part.** All red-first. A mode may never reach
`prohibited` in either direction — the fourth tier exists because no approval unlocks it, and a
prohibition a setting could revoke would be Gated wearing its name. A mode-keyed tier must name all three
modes, so no posture is left to a default. It may not get *looser* as the mode gets stricter, or the names
lie while the compiler reports green. And a mode-keyed tier in a policy declaring no `mode` refuses the
whole compile, because which mode a workspace runs is a ruling, not something a compiler picks.

**Tighten-only is the design decision most likely to be questioned, so here is the argument in full.** A
session may raise its own checkpoint frequency freely and may not lower it. Two independent reasons,
either sufficient:

1. **It could not be honoured.** The load-bearing layer is the compiled `permissions` rule, emitted at the
   workspace default. A session claiming to be looser would still meet every prompt its mode promised to
   remove. A mode announcing a posture the host does not have is exactly
   `a-stated-enforcer-must-be-the-real-one`.
2. **The agent writes that file.** Editing on a working branch is Auto, so an agent that could loosen its
   own mode could un-gate its own merge — self-authorisation with extra steps.

Loosening is therefore a change to the workspace default: a `.portulan/` edit, which is Propose, which is
a pull request. The direction that needs a human keeps one. **Auto mode is still fully available** — it is
a declared default plus a recompile, not a runtime flip, and that is the point.

**The gate-map:78 revisit clause fired.** Push-stays-Auto was justified on a *one-collaborator private*
repository; the repository went public 2026-07-27. `strict` is the designed answer, and it is better than
re-gating the push would have been, because re-gating imposes one team's risk posture on every adopter of
the engine. **Which mode this repository runs on that axis stays the maintainer's one-line call**, with
the argument both ways recorded beside it in the gate map. Keep this distinction straight if the question
is reopened: the confidentiality obligation rests on the commit-time **seam scan**, unchanged at every
mode; `strict` buys a *review* checkpoint, not a confidentiality one.

**The consequence written down in advance.** The commit-attribution argument — his name on a `main` commit
records a decision he took — rests on every merge being approved, which is true at `gated` and `strict`
and false at `auto`. The gate map now says so *before* anyone flips it, so that whoever does inherits an
explicit debt rather than a stale sentence. The floor does not silently cover the gap: conversation
resolution establishes that no comment was ignored, not that anyone agreed, and a pull request that drew
no comment trips none of it.

**Where the state lives.** The per-session override is worktree-local, untracked, in the OS temp dir,
keyed by the working tree and carrying the session that claimed it — the same shape as `stop.mjs`'s
counter and for the same reasons — keyed by the session **and** the tree. It was keyed by the tree alone
for one checkpoint, which read correctly and wrote wrongly: two sessions in one worktree shared a file and
the second to tighten erased the first, silently, while its own tool reported success. The supervisor
found it by running two writers. There is now a regression test. A record whose session does not match the
reader's is ignored, which is also how it expires. `CLAUDE_CODE_SESSION_ID` in a Bash call was **measured** present on CLI 2.1.220;
without it the override writes unclaimed and binds nobody, which degrades to no override rather than to
somebody else's.

**Auditability, stated because the record discipline asks.** The tracked artifact names the mode it was
compiled at, so `git log -p .claude/settings.json` is the durable history — and because an override can
only tighten, that artifact **bounds** every session that ran against the commit: none was ever looser.
Whether a given session tightened is untracked by design; the honest carrier is the handoff. This session
did tighten to `strict` briefly while exercising the tool, then cleared it.

**What is NOT done.** The mode is not wired into `doctor`'s degradation report, and the ruleset export
(M4 session 1's other deliverable) does not yet express a mode — it should, since the floor backend is
where a mode would matter most to an adopter with no hook system. Neither was in scope.

**What the pre-commit supervisor caught, because the list is the useful part of a handoff.** Verdict was
**do-not-ship** and it was correct. Beyond the clobber above: the mode-invariance test walked nine of the
twelve rules its own prose claimed to cover; `"mode": null` compiled instead of refusing and stamped
`strict` into the artifact as a ruling nobody made; and four sentences overstated what the platform floor
guarantees — including "no agent can clear it" of a review thread, which is false twice over (an agent has
resolved one on his credentials, and Copilot resolved its own on #44), and a forward reference to an
await-Copilot rail that does not exist yet. **The pattern across all four: every one of them was a
sentence about an enforcer, written while implementing that enforcer.** The session that builds a gate is
the worst-placed to describe it.

**Seam scan clean** across files, commit message, and branch name.
