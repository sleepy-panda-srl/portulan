# The compiled enforcement, and what it is worth

> The runtime half of the enforcement compiler. [`../../cli/compile.mjs`](../../cli/compile.mjs) reads
> [`../gates.json`](../gates.json) and writes [`../../.claude/settings.json`](../../.claude/settings.json);
> the two scripts here are what that artifact points at.
>
> Core states the doctrine — the tiers ([`../../core/operating/autonomy.md`](../../core/operating/autonomy.md))
> and the Stop-gate contract ([`../../core/operating/verification.md`](../../core/operating/verification.md)).
> Both named milestone 4 as where the machinery arrives. This is that machinery.

| File | What it is |
|---|---|
| [`gate.mjs`](gate.mjs) | `PreToolUse` runner. Finds the rule an attempted action matches and returns its decision and its sentence. |
| [`stop.mjs`](stop.mjs) | `Stop` runner. Runs the workspace's default verify recipe and the session-end handoff check, and blocks the ending if either is unmet. |

## Two layers, and only one of them is the gate

Every gate is emitted twice — as a `permissions` rule and as a hook. That is not redundancy for its
own sake, and the reason is a measurement rather than a preference.

**A hook that crashes fails open.** Measured on CLI 2.1.220: a `PreToolUse` hook exiting non-zero with
non-JSON output let the tool run normally, on the identical wiring that blocked when the hook was
healthy. A permission rule does not do this. So the permission rule is the gate, and
[`gate.mjs`](gate.mjs) is written to **step aside silently on any internal error** — handing the
decision back to the layer that cannot be removed by a syntax error.

Refusing loudly on error *is* available — a hook exiting 2 blocks — and it is still the wrong choice
here, for a reason worth stating precisely rather than with the hand-wave an earlier draft used. If this
runner failed closed, then a malformed [`../gates.json`](../gates.json) would deny **every** matched tool
call until somebody fixed it: an undriveable session, and the file you would need to edit is inside the
repository you can no longer edit. What is lost by stepping aside is bounded and known — the wrapper
coverage and the sentences — because the permission layer never reads that file at runtime.

**So what is the hook for?** Not the thing its author first assumed. The plan was that it would supply
a better sentence than "permission denied" — and measurement killed that: when a permission rule
matches, the host runs the hook and then **discards its reason**. A canary recorded the invocation and
the command it saw; the agent still received the generic message. A component emitted only to improve
a message it cannot reach would be inert while reading as active, which is the defect
[`../memory/a-manifest-field-can-validate-and-load-nothing.md`](../memory/a-manifest-field-can-validate-and-load-nothing.md)
already exists to name.

The split earns its place somewhere else: **the hook covers what the permission pattern cannot.**
`Bash(git push:*)` is a literal prefix match, so `bash -c "git push …"` is invisible to it — measured.
[`gate.mjs`](gate.mjs) peels one shell wrapper before matching, so that spelling reaches a gate, and in
exactly that case the permission layer has nothing to say, so the hook's decision *and* its sentence
are what the agent gets. Demonstrated live, both directions.

Two layers, two jobs: one cannot fail open, the other covers more ground.

## Why Gated is `ask` and the constitution is `deny`

[`../gate-map.md`](../gate-map.md) defines Gated as *explicit human approval, per action* — which is
what `ask` is. Interactively it prompts; headless, where nobody can approve, it blocks. Measured: a
`git push` under an `ask` rule in `claude -p` is refused and the remote receives nothing.

Compiling Gated to `deny` would have been the *prohibition* semantics wearing the Gated tier's name,
and it would have flattened the one rule that has no approval path at all — nobody edits
[`../../docs/vision.md`](../../docs/vision.md) — into an ordinary push. That is why the policy carries
four tier classes where core names three: `prohibited` is not a stronger `gated`, it is a different
answer to a different question.

## The pressure valve, named so it does not get opened quietly

The compiler emits **restriction only** — `ask` and `deny`, never `allow`. That is a maintainer's
ruling and it holds a real line: a compiler whose output can only ever *add* a gate cannot loosen an
existing check by having a bug.

It also creates prompt fatigue, and fatigue is what erodes a decision informally — one `allow` added
to the compiled file "just for now", and the artifact stops being policy. So the valve is stated
rather than left to be improvised: **personal convenience belongs in `.claude/settings.local.json`**,
which is git-ignored and yours. The tracked artifact carries policy; the untracked file carries taste.
Anyone reviewing a diff can then tell which they are looking at, which is the whole reason to separate
them.

One consequence is honest and unmeasured: a broad local `Bash` allow sits invisibly beside these
gates. A compiled `deny`/`ask` beats an `allow` on the *same* pattern; what a broad local allow does to
the **wrapper** spelling has not been measured and is not claimed either way.

## The limits, stated where somebody will meet them

- **One level of wrapper unwrapping, and no more.** Deeper nesting, a heredoc, an interpolated
  variable, a command assembled at runtime — all still escape. Asserted as a test rather than only
  written here, so that anyone tempted to call this layer a rail meets the counterexample. What must
  not happen *regardless of spelling* belongs on the platform floor.
- **This layer is a convenience above a rail, not the rail.** The floor — branch protection, required
  checks, PR-as-gate — refuses a push at the server whatever any local file says. `autonomy.md` calls
  the floor "the gate that holds when everything above it fails", and this is the thing above it.
- **The Stop event is not the doctrine's "end of task".** It fires when the agent finishes any
  response, so a gate blocking on every red would make a red working copy undriveable — including by
  the session opened to fix the red. Hence the cap of three **refusals** per session — a real weakening,
  stated as one: an agent refused enough times ends anyway, with the unresolved problems printed each
  time. CI still refuses the merge. This gate makes a red *unmissable*, not *binding*. **Refusals, not
  stops:** the first version charged every Stop event, so an ordinary session spent its budget on green
  turns and a genuine red then passed with a note. A green stop is free.
- **Nothing here is checked by CI.** The `compile` recipe proves the artifact matches the policy. It
  cannot prove the host honours it, because CI installs nothing by stated doctrine — the same boundary
  that keeps `claude plugin validate --strict` out of the recipes
  ([`../verify/README.md`](../verify/README.md)). Loading is measured at the supervised checkpoints.

## The observation procedure, because a watcher earns its place by being watched

[`../proposals/0007-every-watcher-ships-with-its-observation-procedure.md`](../proposals/0007-every-watcher-ships-with-its-observation-procedure.md)
was adopted the same day this landed, and it binds everything here: anything whose job is to *notice*
something ships with the procedure that would demonstrate it works, run once, with its result recorded.
Both runners are watchers. So:

| Watcher | The procedure that was run |
|---|---|
| `permissions` deny/ask | a headless session was told to push to a **scratch bare remote**; the push was refused and the remote held 0 refs, with an ordinary command succeeding in the same session as the positive control. The maintainer then ran the same command by hand and it succeeded — so *blocked* is distinguishable from *impossible*. |
| [`gate.mjs`](gate.mjs) | the same push written `bash -c "git push …"`, the spelling the permission pattern cannot see: refused, carrying this policy's own sentence verbatim. |
| [`stop.mjs`](stop.mjs), recipe half | one dead link planted; a session told to reply `done` was refused three times carrying the recipe's output naming file and line, then released at the cap. Green, it ended in one turn. |
| [`stop.mjs`](stop.mjs), handoff half | recipe left **green** so the block could only come from this half; today's handoff moved aside and a scratch file making the session count as work. Refused three times naming the exact date. |

**Where the rule settles for an admission rather than evidence**, which it says to state plainly: nothing
proves the artifact still works *after this session*. Each row above is a fact about one CLI version on one
day. There is no scheduled re-run, CI cannot install a host to attempt one, and the failure mode is silent —
a hook the host quietly stopped loading looks exactly like a session with nothing to block. **This runner's
own silence is not evidence.** Re-run the table on every Claude Code upgrade.

## Why these files are here and not in a top-level `hooks/`

Because this repository **is** a plugin whose payload is the whole tree, and that makes the obvious
location dangerous. Measured: a plugin shipping `hooks/hooks.json` has those hooks **fire for anyone
who installs it**, in projects unrelated to this one — a positive control ran the same command
successfully with the plugin absent. A top-level `hooks/` here would push Sleepy Panda's own gate map
onto every installer's machine, denying *their* pushes and blocking *their* sessions.

`.claude/settings.json`, by contrast, ships as inert data: measured, a plugin carrying one has no
effect on the installer. It activates only when this repository is the project — which is exactly the
dogfooding this milestone is for, and nothing wider.

This is the `agents/` lesson from milestone 3 repeating with higher stakes: for a repo-rooted plugin,
top-level directory names are **platform-reserved**, and the cost of picking one by accident is paid
by strangers.
