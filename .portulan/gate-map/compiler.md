# What the compiler emits and refuses — the full account

> The rest of the gate map's [What the compiler refuses](../gate-map.md#what-the-compiler-refuses), and the one
> account of the enforcement compiler: what it emits, the two backends and what each refuses, composition,
> guidance, the limits, how each watcher is observed, and the argument for each honest hole. The index
> carries each hole's rule. [`../../cli/compile.mjs`](../../cli/compile.mjs) carries each decision's argument
> beside the code that makes it, and this file names where.

## What `compile` emits

[`../../cli/compile.mjs`](../../cli/compile.mjs) reads [`../gates.json`](../gates.json), composes the gate
fragments the workspace's packs contribute, and writes two artifacts:
[`../../.claude/settings.json`](../../.claude/settings.json), whose permission rules and hooks are the Claude
Code backend, and [`../compile/github-ruleset.json`](../compile/github-ruleset.json), the platform floor as
an importable repository ruleset. From `slots.context` it also writes [guidance](#guidance). The hooks run the
runners `HOOK_RUNNERS` lists in compile.mjs — [`../../cli/gate.mjs`](../../cli/gate.mjs) on `PreToolUse`,
[`../../cli/stop-gate.mjs`](../../cli/stop-gate.mjs) on `Stop`, and the restart advisory — and each runner's
header says what it does. Every output is committed and byte-compared against its source by
[`../verify/compile.sh`](../verify/compile.sh), and both gate artifacts name what generated them.

**Where the outputs live is a decision.** In a repository that is also a plugin, a top-level `hooks/` fires
for everyone who installs it, while `.claude/settings.json` ships inert and activates only where this
repository is the project ([`../memory/a-plugin-payload-can-enforce-on-strangers.md`](../memory/a-plugin-payload-can-enforce-on-strangers.md)).
The ruleset lives in the workspace's `compile/` rather than `.github/` for the same reason: `.github/` is the
forge's reserved directory, and a generated file there makes the same bet.

**Regenerate with the root the rail checks:**

```
node cli/compile.mjs --workspace . --pack-root packs
```

Pack resolution is discovered-first and first-match-wins, so on a machine with the plugin installed a bare
`compile` would read the host's plugin cache while [`../verify/compile.sh`](../verify/compile.sh) reads the
tree. It refuses instead: a pack that resolved from a discovered root while the tree also carries it is exit
2, naming both roots and both ways to proceed (#316), so the pin above is what you type to proceed. The
artifact also records which world compiled it — `$portulan.packs` holds each declared pack's origin and
version, never a root path, which would make a tracked file machine-dependent — so a shadowed emit differs
in the diff (#264). Only the Claude Code artifact can carry that record; the ruleset's provenance is its
`name`, and `doctor` reports a shadowed pack for the workspace as a whole. `recordedOrigin` and `backends` in
compile.mjs carry the argument.

## Two layers, and which one is the gate

Every gate is emitted twice, as a permission rule and as a `PreToolUse` hook. **The permission rule is the
gate.** A hook that crashes fails open, so [`../../cli/gate.mjs`](../../cli/gate.mjs) steps aside on any
internal error and hands the decision back to the layer a syntax error cannot remove. **The hook covers what
a permission pattern cannot**: a command inside one shell wrapper, a gated command after a separator, and a
shell write to a path a `write:` rule protects. There the hook's decision and its sentence are what the agent
gets; where a permission rule matches, the host discards the hook's reason. The measurements are in gate.mjs's
header and [`../memory/two-layers-need-two-jobs.md`](../memory/two-layers-need-two-jobs.md).

`gated` compiles to `ask`, which prompts interactively and blocks headless, and `prohibited` to `deny`; the
hook returns the same decision as the permission rule. Why Gated is not `deny` is in compile.mjs's header.

**The host's prefix match respects token boundaries.** `Bash(git push --force:*)` does not match
`git push --force-with-lease`, which is Auto: measured on CLI 2.1.220, the lease push drew the same prompt
with the rule as without it. That one boundary case is all that was measured; how the host treats quoting,
subshells or flag order is not established. The policy leans on it, so re-measure it on every Claude Code
upgrade.

## What the compiler refuses

Every rule ends **compiled**, or **refused** with a stated reason — a rule a backend legitimately declines,
left out of an artifact that is still written, exit 0. The third outcome is not per rule: a policy that
cannot be enforced as written is **could-not-run**, exit 2, and no artifact is written. Besides a malformed
policy, the refusals that stop a whole compile include a `gates` key it will not read (whatever sits at the
conventional path), a `workspace.json` that does not parse into an object, which it would otherwise read
as declaring nothing, a pack that resolved from a discovered root while the tree also carries it, a pack
composition that would loosen a gate, and a `gated` or `prohibited` rule whose path target can never match
(hole 8). Filing the last as `refused` would let `doctor` count a gate the policy declares and nothing
enforces as ordinary non-coverage.

**Two backends read this policy, and their partitions are close to inverse.** The Claude Code backend
refuses three kinds of rule, all printed on every run:

| Refusal | Why |
|---|---|
| tier `auto` | Unattended by **policy**, not by the host. The compiler only ever adds restriction, on the maintainer's ruling, so the host prompts for every Auto action and the answers land in per-machine settings, unreviewed and in no diff. The ruling rests on an `allow` prefix reaching every spelling beneath it, including ones no rule names, not on precedence this repository has never measured; the comment above `HOST_GATE_TIERS` in compile.mjs carries both and the measured cost. |
| tier `propose` | Enforced by the platform floor — pull request, required check, review — not by a permission rule on one machine. **The floor backend compiles exactly these**, which makes this refusal a hand-off. |
| action `none` | No tool-level surface, or none a matcher could honestly cover, and the rule's own reason is what is printed. **Five**, and the enumeration is the count: `rename-or-transfer-a-repository`, `spend-money-or-register-a-domain` and `send-something-outside-this-repository` are declared here; `commit-without-the-hooks` and `self-certify-a-checkpoint` are composed from `rituals/checkpoints`. |

**The floor backend** compiles one branch ruleset for the ref `floor` names. The `propose` rules become a
pull-request requirement and required status checks, always strict and emitted together or not at all; the
exact spellings `git push --force` and `git push --delete` become `non_fast_forward` and `deletion`, and
`git push -f` is refused rather than generalised. Every other rule is refused with a reason scoped to this
export rather than to the platform: a path rule needs `CODEOWNERS` or a push ruleset, a tag or release needs
a tag ruleset, and `gh pr merge` is constrained by the floor but, with zero required reviews, needs nobody's
yes. The coarseness is printed in both directions — stricter (it blocks `--force-with-lease`, which is
Auto), narrower (one ref), partial (it adds a layer beside classic protection rather than replacing one).
It **generates and never applies**: importing a ruleset is a settings change, and Gated. A policy with no
`floor` compiles nothing here, `strict` cannot be declared, and `bypass_actors` is always empty. Section 3b
of compile.mjs carries the argument; [`platform-floor.md`](platform-floor.md) compares the artifact with the
floor in force.

**Five gates are compiled by neither backend**: the three declared ones above and both composed ones. Each is
a prompt-level habit until something reaches it. The count moves with composition, and `compile --matrix` and
`doctor` both read the policy the workspace yields — declared plus composed — through compile's own
`packContributions` and `composeFragments`, so they print the same list: a policy stating a gate nothing
enforces must never read as configured. A tool's own refusal of one spelling — `portulan feedback send`
without `--approve`, the telemetry export without a committed opt-in — is enforcement in that tool, not
coverage of the action; the rule's reason in [`../gates.json`](../gates.json) says why it still compiles to
nothing.

**The per-host matrix.** `node cli/compile.mjs --matrix` prints every rule against both backends and names the
gates no backend compiles. It leaves the `auto` rules out of that count, since an unattended rule enforced by
nothing is the tier working, and it is derived from the backends' own accounting rather than kept beside them.
`doctor` reports the same under its `enforcement` check. Neither prints a backend's notes; `compile` and
`compile --check` do.

**Composition.** `rituals/checkpoints` contributes `commit-without-the-hooks` (gated) and
`self-certify-a-checkpoint` (prohibited). Neither compiles, for the reasons in
[Gated](gated.md#commit-without-the-hooks-composed) and [Prohibited](prohibited.md#self-certify-a-checkpoint-composed).
The hook reads the same yielded policy as `compile`, with three differences gate.mjs argues: it wires no
discovery (hole 7), a refused composition falls back to the declared policy rather than stepping aside, and it
answers with the strongest matching tier rather than the first listed, so `ask` may become `deny` and never
the reverse.

## Pack-contributed gate rules

The cascade is `core < pack < workspace`, and a pack may contribute gate fragments (`contributes.gates` in its
`pack.json`). **Packs may only tighten**: a pack may raise a tier or add a prohibition, never demote another
layer's classification ([`0010`](../proposals/0010-prohibited-as-a-fourth-universal-tier.md)). A dependency
able to demote `push` would hold a lever on the gate that contains it, and the demotion would look like
configuration. The policy is a list of id-addressed rules with no dependence on being the only source, which
made this merge step an addition rather than a redesign. `compile` composes fragments before `parse` runs, so
a fragment is validated by the code that validates a hand-written rule, and prints each outcome:

| Outcome | What it means |
|---|---|
| **adds** | The fragment names an id no lower layer carries. |
| **tightens** | It names an existing id at a **stronger** tier, carrying that rule's action unchanged. Printed `from → to`. |
| **refused** | It would keep or weaken the tier, **or** change what the rule matches. The build stops, exit 2. |

**Tightening has two axes.** The tier may only rise, and the action may not change, because raising the tier
while replacing the matcher passes every tier comparison and removes the gate. The tier is compared first, so
a fragment that does both is refused as a demotion. A pack that wants to gate a different action contributes
a new id. The Pack Definition leaves `auto` out of its tier enum, which is the half a manifest's shape can
enforce; the comparison is the compiler's, and it re-checks `auto` anyway. Failing closed is right here and
wrong in the hook: this runs at build time against a file you can edit.
**Tighten-only binds packs, not the layer composing them**: the workspace owns its policy and may override
any of this in its own gate map, except core's `prohibited` entries, which only the evolution gate grants.
`composeFragments` in compile.mjs carries the argument.

## Guidance

A workspace may keep its guidance in `slots.context`, one Markdown unit per file, each declaring its load
tier ([`../../core/operating/context.md`](../../core/operating/context.md) defines the four,
[`../../spec/slots.md`](../../spec/slots.md) the unit). This is the one thing `compile` emits that is not
enforcement. Each unit lands in the Claude Code form of its tier: a rule in `.claude/rules/portulan/`,
unscoped or scoped by `paths:`, a project skill in `.claude/skills/`, or a line in
`.claude/rules/portulan/on-read.md`. `vendor --host` carries the same units into the vendored `AGENTS.md`,
where a tier the host cannot express degrades to a pointer, late and never lost; `compile --matrix` prints
that per unit, and `GUIDANCE_HOSTS` is the one table of which host expresses which tier. `compile` rewrites
and removes only what it wrote — the rules its `.compiled` marker lists and the skills carrying its mark —
writes nothing through a link, and refuses a slot inside a directory it writes. What it wrote from guidance a
workspace stops declaring goes on the next run, with a gate policy or without one. Section 3c of compile.mjs
carries each of those rules.

**This workspace declares four units** in [`../context/`](../context/): the boot card in the `always` tier,
and the gates, doctrine and records rules in the `on-path` tier, each scoped to the paths where it binds.
`compile` writes them into `.claude/rules/portulan/`, and the `compile` recipe is red while a written file
differs from what they compile to. [`../../cli/fixtures/guidance/`](../../cli/fixtures/guidance/) declares one
unit in each tier, and milestone 12's second demonstration compiles it and opens it in a running host, because
no test here can show that a host loads a rule when its path is first touched, and not before.

## The pressure valve

The compiler emits **restriction only** — `ask` and `deny`, never `allow` — on the maintainer's ruling:
output that can only add a gate cannot loosen a check by having a bug. The prompts that leaves are what tempt
an `allow` into the compiled file "just for now", after which the artifact stops being policy. So the valve
is named: **personal convenience belongs in `.claude/settings.local.json`**, which is git-ignored. The tracked
artifact carries policy and the untracked file carries taste, and a reviewer can tell which a diff touches.
What a broad local `allow` does beside the gates is hole 4.

## The limits

The honest holes below are what the gates do not reach. Three limits sit beside them.

- **This layer is a convenience above a rail, not the rail.** What must not happen, however it is spelled,
  belongs on the [platform floor](../gate-map.md#the-platform-floor), which refuses at the server whatever any
  local file says and is the only layer indifferent to spelling. [The floor audit](platform-floor.md) records
  the floor as three layers with one unverified, so neither layer is unconditional.
- **The Stop gate makes a red unmissable, not binding.** The host's Stop event fires at the end of every
  response, not of a task, so a gate that always blocked would make a red tree undriveable, including for the
  session opened to fix it. Its caps release a session after enough consecutive refusals for one reason, or
  at a ceiling that never resets, and CI still refuses the merge. The header of
  [`../../cli/stop-gate.mjs`](../../cli/stop-gate.mjs), `MAX_BLOCKS` and `MAX_TOTAL_BLOCKS` carry the arithmetic.
- **CI proves the artifact matches the policy, not that the host honours it.** CI installs no host, by stated
  doctrine — the boundary that keeps `claude plugin validate --strict` out of the recipes
  ([`../verify/README.md`](../verify/README.md)) — so whether the host loads the artifact is measured by the
  procedures below.

## How each watcher is observed

[`0007`](../proposals/0007-every-watcher-ships-with-its-observation-procedure.md) binds everything here:
anything whose job is to notice something ships with the procedure that would show it works, run once, with
its result recorded, and where there is none it says so. Everything the compiler emits is one.

| Watcher | The procedure |
|---|---|
| `permissions`, `ask` and `deny` | A headless session is told to push to a scratch bare remote: the push is refused and the remote holds no refs, while an ordinary command succeeds in the same session. The same command run by hand then succeeds, which tells *blocked* from *impossible*. |
| `permissions`, a write gate | With `Edit(./x.md)` alone denied, a `Write` and a `NotebookEdit` to that path are refused, and the same tools writing a different path succeed, which tells *refused* from *refuses everything*. This is hole 9's evidence. |
| [`gate.mjs`](../../cli/gate.mjs), a wrapper | The push written `bash -c "git push …"`: refused, carrying the rule's own sentence. |
| [`gate.mjs`](../../cli/gate.mjs), a write gate's shell half | Against a policy with a Prohibited `write:` rule, which this one has not declared since 2026-09-24, `<path>` being the path it guards. Payloads on stdin, as the host sends them: `echo x >> <path>`, `bash -c "sed -i .bak s/a/b/ <path>"` and `cp /tmp/x <path>` each return `permissionDecision: "deny"` with the rule's sentence, while `cat <path>` and `git status` print nothing and exit 0. In a live session a shell write to the path is refused with text beginning ``PORTULAN GATE `<id>` ``, which no permission rule produces: that shows the host invokes the hook for `Bash` and passes its sentence on. |
| [`stop-gate.mjs`](../../cli/stop-gate.mjs), the recipe | One dead link planted, and a session told to reply `done` is refused with the recipe's output naming the file and line, until it is released at its reason's cap, naming the reason. Green, it ends in one turn. |
| [`stop-gate.mjs`](../../cli/stop-gate.mjs), the handoff | The recipe left green, so a block can only come from this half; no handoff dated today, and a scratch file so the tree holds work. Refused naming the date until released at the handoff's own cap, not the ceiling. Run it in a clone where no session has written today's handoff. |
| [`github-ruleset.json`](../compile/github-ruleset.json) | Compared field by field with the live protection: `strict`, the required contexts and their app pin, the review count, conversation resolution, and the force-push and deletion blocks. It is never imported, which is Gated, so GitHub's acceptance of the file is inferred. The envelope and the fields to omit were read from live rulesets; the `pull_request` and `required_status_checks` parameter blocks come from GitHub's documented schema, not from any ruleset read here. |

**Where the rule settles for an admission**, said plainly: nothing proves the artifact still works after the
session that observed it. Each result is a fact about one CLI version, nothing re-runs these on a schedule, CI
cannot install a host to try, and the failure is silent — a hook the host stopped loading looks like a session
with nothing to block. **A runner's silence is not evidence. Re-run the table on every Claude Code upgrade.**

The dated runs and their results are at `git show 8a33f9b:.portulan/compile/README.md`.

## The honest holes

Each entry is the argument for the rule the index states. Holes 1, 2 and 8 are also recorded as data: the
gate corpus in [`../../evals/goldens/gates/`](../../evals/goldens/gates/) and the position table of
[`../../cli/fuzz-shell.mjs`](../../cli/fuzz-shell.mjs) cite them by number, and go red when an entry stops
being true. How each hole was found, and the dated corrections to this list, are at
`git show 8a33f9b:.portulan/gate-map/compiler.md`.

1. **Spellings neither layer sees.** The permission rule matches a literal prefix and the hook peels **one**
   shell wrapper (`spellings` in compile.mjs), so two wrappers, a heredoc whose target is interpolated, an
   interpolated variable, or a command assembled at runtime reach neither. For a `write:` rule's shell half
   the list is its own: an interpolated path, a language runtime writing the file itself
   (`python3 -c "open(…,'w')"`), a writer outside [the shell half's table](prohibited.md#the-shell-half-and-why-the-strongest-rule-here-had-the-weakest-layer)
   such as `ex`, and a program that **invokes** a writer (`find -exec cp`, `xargs cp`), because parsing those
   to find the real command is the ambitious parser this repository keeps refusing. Quoting is honoured to one
   level, so a write-shaped string inside a `node -e` script can be a false **red**. A heredoc naming the path
   literally is covered. Each of these is asserted as a test, and `shellWrites` in compile.mjs states the list
   beside the code, so anyone tempted to call this layer a rail meets the counterexample.

   **The prefix itself is compared literally.** The same act written another way — `git push -f`, a quoted
   `"git"`, or the flag after its arguments, `git push origin x --force` — does not match at the hook, and
   nothing measured here says the host's pattern matches it. No test pins these three.

   **A heredoc opener that opens nothing, whose delimiter word happens to appear on a later line anyway.**
   Openers are found on the raw line, so `<<EOF` inside a quoted string or after a `#` sets a delimiter on
   text that opened nothing. An unterminated opener is treated as no opener, which fails closed at the cost of
   a possible false red. What remains is the coincidence case, and closing it needs a quote-aware parser this
   repository refuses to grow.

   **A quoted command substitution.** `echo "$(git push --force origin main)"` is a command bash runs, and it
   reaches nothing: the segmenter's quote loop steps over the parentheses, so no split happens. The bare
   `echo $(git push --force origin main)` is caught, because `(` and `)` are in the operator class. One
   concept, two spellings, opposite answers, which is why the fuzzer's table is keyed on the spelling and
   never on the idea. Asserted on both matchers.
2. **A gated command that was not the first word on the line.** Closed for separators, open for leaders, and
   open at the permission layer. The hook splits a line on its separators — `;`, `&&`, `||`, `|`, `&`, a
   subshell, a newline — and matches each command, so `ls && git push --force origin main` reaches the gate.
   A word in front of a command *inside* a segment still escapes, and these forms are ordinary rather than
   exotic; each steps aside where the bare spelling answers `ask`:

   | Still escapes | Spelling |
   |---|---|
   | a leading assignment | `FOO=bar git push --force origin main` |
   | a command prefix | `env git push --force …`, `sudo git push --force …` |
   | a compound-statement keyword | `if true; then git push --force …; fi` |
   | a loop body | `for x in 1; do git push --force …; done` |
   | a brace group | `{ git push --force …; }` |

   Stripping a **named table** of leaders would close the common ones and is deliberately not done: that
   table has no natural edge — `nice`, `time`, `nohup`, `timeout`, `command`, `stdbuf`, `doas` — and one
   missing entry buys exactly the false confidence this list exists to deny. Asserted as tests.

   **A leading redirection is closed, and its grammar is why.** An optional file descriptor, one of `<` `>`
   `>>` `<>` `>&` `&>` `>|`, and a word: a closed grammar, so it is stripped with an edge a reader can check.
   The word is a shell word, quoted spans and escapes included, so `> "foo bar" git push --force …` is gated
   while the unquoted `> foo bar git push …` stays ungated, because there bash really does run `bar`. The
   suite asserts the rule rather than the spellings: whatever `shellWords` calls one word, the strip consumes
   whole. **This licenses no table of command prefixes**; that table is refused for a reason the redirection
   grammar does not share. The docblocks at `REDIRECTION_TARGET` in compile.mjs carry the argument.

   **A separator inside a wrapper is closed too.** `bash -c "ls; git push --force origin main"` is gated,
   because each spelling is segmented as well as the raw line. The unwrap budget is still one level:
   `bash -c "sh -c '…'"` escapes, asserted in the corpus and the suite. No closure may widen a gate:
   `git push --force-with-lease` is Auto by the maintainer's ruling and stays Auto mid-line, asserted as a
   control.

   The permission rule reaches none of this — `Bash(git push --force:*)` is a prefix pattern, and nothing in
   that DSL reaches a command in second position — so a gate's reach beyond the first word is the hook's alone.
3. **A gate whose only layer is the hook — and the hook is the one that fails open.** Everywhere else the
   permission rule is the gate and the hook adds reach. For the shell half of a Gated or Prohibited `write:`
   rule, [the constitution's](prohibited.md#the-shell-half-and-why-the-strongest-rule-here-had-the-weakest-layer)
   until 2026-09-24, the hook *is* the reach, because no `Bash(prefix:*)` pattern can name a path sitting
   anywhere in a command. An error in [`../../cli/gate.mjs`](../../cli/gate.mjs) removes tool-level coverage
   of shell writes to the path such a rule guards and leaves its `Edit` rule standing — which the host matches
   for every file-editing tool — so a partial gate looks from outside exactly like a whole one. `compile` and
   `compile --check` name the affected rules in a note for that reason, so every CI run through
   [`../verify/compile.sh`](../verify/compile.sh) prints it; this policy has none since 2026-09-24.
4. **A local `allow` rule beside the compiled gates is unmeasured.** `.claude/settings.local.json` is
   git-ignored, so an adopter's own allow rules sit invisibly beside these. A compiled `deny` or `ask` beats
   an `allow` on the same pattern; what a broad local `Bash` allow does to the wrapper spelling has not been
   measured, and is not claimed either way.
5. **A rule whose sentence is broader than its matcher.** Guarded against by splitting rather than by
   trusting prose: `rename-or-transfer-a-repository` compiles to nothing and says so, rather than hiding
   inside a neighbour's matcher.
6. **This repository ships a wrapper of its own, and holes 1 and 4 meet in it.**
   [`../tools/gh-bot`](../tools/gh-bot) runs `gh` under the agent identity, so `./.portulan/tools/gh-bot …`
   is a spelling no compiled rule sees: every shell gate here is a `Bash(<prefix>:*)` match against the
   literal command, and the hook's one level of unwrapping knows `sh -c` and nothing about this path. On the
   maintainer's machine the wrapper is also allowlisted by hand, which is hole 4 with the unmeasured part
   removed: the entries are for different spellings, so the wrapper simply runs unattended. It was found
   against a `gh api` gate [since removed](gated.md#the-gh-api-amendment), and the class stands, because the
   wrapper is a second name for `gh`.

   **What holds today is the App's permission set**, not the wrapper and not a matcher. Measured through the
   wrapper and recorded in [`../tools/README.md`](../tools/README.md): a ruleset change and a
   branch-protection read came back `403`, while a ruleset **read** returned `200`, because it rides on
   `metadata: read`. So the wrapper refuses any endpoint outside pull-request conversation before it mints a
   token. That allowlist is **stricter than the policy, deliberately**: the maintainer's credentials are his
   to spend, while the agent identity is a token this repository mints, whose reach should be the smallest
   thing that does its job.

   **Three things that guard is not.** It is not a rail: an agent with shell access can mint the token and
   call `gh` directly. It is not complete: `graphql` is one admitted endpoint carrying arbitrary queries. And
   it is not a *rule*: no entry in [`../gates.json`](../gates.json) targets the wrapper, on purpose. Gating
   `gh-bot api` wholesale would gate pull-request conversation, the one thing that identity exists for, and
   gating only the settings endpoints is not expressible — a permission prefix cannot discriminate on a path
   segment several deep, and the compiler refuses `:` in a shell target. **The standing risk** is the
   permission set itself: a live setting no file here pins, so widening the App would turn this documented
   gap into a live bypass with nothing in the tree to say so. It is read back at the supervised checkpoints.
7. **A pack the hook cannot resolve, where `compile` can.** [`../../cli/gate.mjs`](../../cli/gate.mjs)
   composes from the root derived from the workspace manifest's `tree` and wires no discovery, so a pack that
   resolves only from the host's plugin cache contributes to what a bare `compile` yields and not to what the
   hook composes. Deliberate: the hook runs on every tool call, and a gate whose answer moved with what is
   installed on the machine could not be reviewed from the repository. A workspace with no `tree` composes
   nothing there, and a refused composition falls back to the declared rules. Which resolution set is right
   for a rail is #264's question; this entry states which one the hook uses. Asserted as a test.
8. **A rule whose target is the whole repository matches nothing at runtime.** `matchesPath` strips a leading
   `./` and any leading `/`, which reduces `"./"` to the empty string, and the empty string is refused on
   purpose, because a target matching everything is likelier a malformed manifest than an intended rule. So
   `edit-on-a-working-branch` (`write: "./"`) and `read-anything-in-the-repository` (`read: "./"`) answer
   false for every input. Nothing is mis-enforced: both are `auto`, the compiler refuses that tier, and the
   hook reads only `gated` and `prohibited`.

   **Closed at the enforcing tiers, and only there** — #337's option 3, the narrowest of its three. The Claude
   Code backend refuses as could-not-run a `gated` or `prohibited` rule whose path target can never match, so
   a hollow gate of this class can no longer compile, and so cannot merge: `compile` exits 2 and `doctor` exits
   1, both inside the required `workspace-verify` check. The predicate is `neverMatches` in
   [`../../cli/compile.mjs`](../../cli/compile.mjs), whose docblock is the one carrier of the class's width: a
   comparison rather than a list, reaching targets that reduce to nothing, targets with an interior `.` or
   empty segment, and targets carrying a backslash. [`../../cli/compile.test.mjs`](../../cli/compile.test.mjs)'s
   `NEVER` and `CONTROLS` measure the spellings. The refusal sits beside `HOST_GATE_TIERS` rather than in
   `parse`, which holds no tier partition.

   **What remains.** What `./` should *mean* as a policy target is still nobody's ruling, so the two `auto`
   rules still match nothing, and the corpus holds them as `documented-hole` cases: a repair to `matchesPath`
   goes red until this entry is updated. The hook reads the policy through `parse`, which the refusal does not
   touch, so a workspace that has already committed such a rule still loads it and the hook steps aside
   because nothing matched; and nothing fires at commit time, since the hook validates no target. A **glob
   metacharacter** is a different shape the predicate deliberately does not read: `docs/**` at `gated` emits
   the same `Edit(./docs/**)` a real `docs/` target does, so the permission half works while `matchesRule`
   answers false and only the hook half is inert. Refusing it would delete a working gate, so the suite pins
   the divergence instead.
9. **A write gate's permission layer rests on one host behaviour.** `compile` emits `Edit(path)` as a write
   gate's only permission pattern, because Claude Code 2.1.240 discards `Write(path)` and `NotebookEdit(path)`
   and matches `Edit(path)` for every file-editing tool, measured with controls in both directions by the
   procedure above. **The hole is the dependency, not the behaviour.** If a later host stops treating
   `Edit(path)` as tool-general, `Write` and `NotebookEdit` fall to the hook, the layer that fails open, and
   nothing goes red: the artifact still byte-compares and the suite still passes. It runs backwards too. No
   earlier CLI was re-measured, and on a host that honoured all three patterns without treating `Edit` as
   tool-general this emission removes two working rules, which reaches every adopter who runs `compile`. So
   `compile` prints it as a note with a re-measure mandate, the pairing the token-boundary measurement above
   also takes.
