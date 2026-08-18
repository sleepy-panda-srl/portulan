# The compiled enforcement, and what it is worth

> The runtime half of the enforcement compiler, and one of its two emitted artifacts.
> [`../../cli/compile.mjs`](../../cli/compile.mjs) reads [`../gates.json`](../gates.json) and writes two
> files: [`../../.claude/settings.json`](../../.claude/settings.json), which points at the two runner
> scripts here, and [`github-ruleset.json`](github-ruleset.json), the platform floor compiled from the
> same policy.
>
> Core states the doctrine — the tiers ([`../../core/operating/autonomy.md`](../../core/operating/autonomy.md))
> and the Stop-gate contract ([`../../core/operating/verification.md`](../../core/operating/verification.md)).
> Both named milestone 4 as where the machinery arrives. This is that machinery.

> **MOVED AT MILESTONE 7.** `gate.mjs` and `stop-gate.mjs` no longer live in this directory — they are
> [`../../cli/gate.mjs`](../../cli/gate.mjs) and [`../../cli/stop-gate.mjs`](../../cli/stop-gate.mjs). They had to:
> `package.json`'s `files` never shipped `.portulan/`, so every adopter's compiled policy named two files
> they did not have, and a missing hook **fails open**. This directory now holds this README and the
> floor artifact. The file table below is kept because it still describes what each runner does; read
> the paths as `cli/`.


| File | What it is |
|---|---|
| [`gate.mjs`](../../cli/gate.mjs) | `PreToolUse` runner. Finds the rule an attempted action matches and returns its decision and its sentence. |
| [`stop.mjs`](../../cli/stop-gate.mjs) | `Stop` runner. Runs the workspace's default verify recipe and the session-end handoff check, and blocks the ending if either is unmet. |
| [`github-ruleset.json`](github-ruleset.json) | **Generated.** An importable GitHub repository ruleset — the platform floor as data. Nothing here applies it; see below. |

## Two layers, and only one of them is the gate

Every gate is emitted twice — as a `permissions` rule and as a hook. That is not redundancy for its
own sake, and the reason is a measurement rather than a preference.

**A hook that crashes fails open.** Measured on CLI 2.1.220: a `PreToolUse` hook exiting non-zero with
non-JSON output let the tool run normally, on the identical wiring that blocked when the hook was
healthy. A permission rule does not do this. So the permission rule is the gate, and
[`gate.mjs`](../../cli/gate.mjs) is written to **step aside silently on any internal error** — handing the
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

The split earns its place somewhere else: **the hook covers what the permission pattern cannot.** Two
things, now:

1. **The wrapper spelling.** `Bash(git push:*)` is a literal prefix match, so `bash -c "git push …"` is
   invisible to it — measured. [`gate.mjs`](../../cli/gate.mjs) peels one shell wrapper before matching, so that
   spelling reaches a gate. Demonstrated live, both directions.
2. **A shell write to a path a `write:` rule protects.** `Edit(./docs/vision.md)` denies three tools;
   `echo x >> docs/vision.md` is a fourth way to the same bytes, and it was gated by neither layer until
   the matcher grew a shell half. See [the boundary below](#the-shell-half-of-a-write-gate-is-a-table).

In exactly those cases the permission layer has nothing to say, so the hook's decision *and* its sentence
are what the agent gets.

Two layers, two jobs: one cannot fail open, the other covers more ground. **The second case is the one
place where that trade is uncomfortable**, because there the ground is covered *only* by the layer that
fails open — which is why it is in the honest-holes list in [`../gate-map.md`](../gate-map.md) and why
`compile` prints it as a note on every run.

## The shell half of a write gate is a table

A `write:` rule names a **path**, not a tool. For one milestone it compiled to `Edit`, `Write` and
`NotebookEdit` and stopped there, so a `Bash` call reached neither layer: the permission rule rejects the
tool, and the shared matcher returned false because `action.shell` was undefined. `echo x >> docs/vision.md`
was therefore an ungated write to this repository's constitution — the one file whose rule says that an
agent able to edit it "can launder any other change past its own grader".

[`../../cli/compile.mjs`](../../cli/compile.mjs) now answers for `Bash` on a `write:` rule, over the same
one-wrapper spellings as everything else. It recognises exactly two shapes:

| Shape | Example |
|---|---|
| A `>` or `>>` redirection into the path, at any point in a list or pipeline | `ls && echo x > docs/vision.md` |
| A command from a **named table** naming the path — `cp`, `mv`, `ln`, `rm`, `tee`, `dd`, `install`, `truncate`, `shred`, `patch`; and `sed`, `gsed`, `perl`, `ruby` **under an in-place flag** | `sed -i '' s/a/b/ docs/vision.md` |
| …or naming a **directory the path lives in**, for that same table | `rm -rf docs` |

Both halves read a line the way a shell does: commands are separated by `;`, `&&`, `|`, a subshell **and a
newline**, and a writer sitting behind `{`, `then` or `do` is still a writer. Paths are normalised before
comparison, so `docs/./vision.md` and `docs//vision.md` are the same file.

**Why a table and not a parser.** The same reason the floor backend recognises ref rules by exact spelling:
a limit a reader can measure is worth more than a matcher clever enough to be wrong quietly. This closes the
spelling reached for by accident or convenience; it does not close one constructed on purpose, and nothing
at this layer could.

**What it leaves open**, and this list is now the corrected one:

- an interpolated path — `echo x > $VISION`, or a heredoc whose *target* is a variable;
- a command assembled at runtime, or a language runtime writing the file itself (`python3 -c`);
- a writer absent from the table (`ex`);
- a program that **invokes** a writer — `find . -exec cp {} docs/vision.md \;`, `xargs cp`. Parsing *their*
  flags to find the real command is the ambitious parser this design refuses to become;
- two shell wrappers, as everywhere else here;
- and in the other direction, a false **red**: quoting is honoured to one level of nesting, so a
  write-shaped string inside a `node -e` script trips the gate. Measured on this repository's own tooling
  while testing this change.

A heredoc naming the path *literally* — `cat > docs/vision.md <<'EOF'` — **is** covered. An earlier draft
listed it as a hole, which is the same defect as overstating coverage: it makes the list untrue.

**Heredoc bodies are skipped, and that is a correctness fix rather than a concession.** A body is text
being written; no shell runs it. It only became a question when a newline started separating commands,
which turned every body line into its own segment — and the cost was immediate and literal: **the commit
fixing the newline hole was refused by this gate**, because its message quoted `cp /tmp/x docs/vision.md`
as the escape being closed. A matcher that will not let you describe an attack has stopped being cautious.
The opening line still gates, and a command after the terminator is still a command; both are asserted.

The absentee worth naming is **`git`**: `git checkout -- docs/vision.md` and `git restore` overwrite the
file and are not gated. Deliberate — the head of those commands is `git`, so covering them would gate
`git diff docs/vision.md` and `git log` in the same stroke, and reading the constitution is Auto. The
generic sentence would have hidden the one escape a session here is actually likely to take.

**This list was wrong when it was first written.** It had four entries and was missing five, the plainest of
them a newline: `git status\ncp /tmp/x docs/vision.md` folded into a single command whose head was `git`,
and reached nothing. A fresh-context supervisor found all five in under an hour by *attacking* the matcher
rather than reading it. Recorded because the lesson is not "we fixed it" — it is that a hole list is a claim
like any other, and the only thing that checks a claim about coverage is somebody trying to get past it.

**Two deliberate asymmetries**, both of which look like bugs until you have the reason:

- **Reads are untouched.** `cat`, `grep`, `git diff` and `sed -n` all pass, and the in-place editors are
  gated only under their flag. Reading the constitution is Auto in this policy, and a matcher that
  contradicts a declared tier is worse than one that admits a gap.
- **Every argument of a writing command counts, not just its destination.** `cp docs/vision.md /tmp/backup`
  only reads, and is refused anyway. Argument grammars differ per command (`dd of=`, `tee f1 f2`,
  `install -t dir src`), so "the last word is the destination" holds for a subset only, and being wrong
  about it is a false **green** on the file that must not change. A false red costs one prompt on a rare
  operation; a false green costs the laundering the rule exists to prevent.

**No permission pattern accompanies it.** `Bash(prefix:*)` matches a command prefix while the path sits at
an arbitrary position, so that DSL cannot express *any command writing this file*; the patterns that would
fit — `Bash(cp:*)`, `Bash(sed -i:*)` — gate the utility rather than the path, which is a much larger rule
than the policy declares. The compiler does add `Bash` to the emitted `PreToolUse` matchers for a write
gate, and that line is load-bearing: without it the runner is never invoked for a Bash call and the whole
shell half is a matcher nothing reaches. It changes no artifact in *this* repository, whose policy already
gates shell commands — which is exactly why its absence would not have been noticed here, and why the suite
asserts it against a policy carrying only a write rule.

`compile` names the affected rules in a note whenever it compiles the policy — `compile` and
`compile --check`, so on every CI run through [`../verify/compile.sh`](../verify/compile.sh). Not
`--matrix`, and not `doctor`: neither has ever printed a backend's notes, which is an inherited convention
rather than anything this change introduced. (An earlier draft of this paragraph claimed "every run", which
is the kind of small overstatement that this section otherwise exists to prevent.)

## The same defect, one action kind over

The supervisor pass on the write gate turned up its sibling in the **shell** matcher, and it was worse.
`matchesRule` prefix-matched the whole command string, so a gated command reached its gate **only when it
came first on the line**:

```
git push --force origin main          → ask   (the gate holds)
ls && git push --force origin main    → nothing
git status; gh pr merge 60            → nothing
cd . && gh repo delete foo            → nothing
```

Every Gated outward action in [`../gates.json`](../gates.json) — merge, publish, release, repository
delete — was defeated by typing anything at all in front of it. Fixed in the same change rather than left
as a sibling nobody returns for, which is this repository's standing ruling on defect classes: the hook now
splits a line on its SEPARATORS and matches each command.

**Separators, and not leaders.** A word sitting in front of a command inside a segment still escapes —
`env`, `sudo`, a leading `FOO=bar`, a `then` or `do` branch, a brace group, a leading redirection. That
qualification was missing here and from the gate map until 2026-07-28, where it read "closed" flat; the
spellings are tabled and asserted there now.

**The permission layer still cannot do any of it**, which the gate map's honest-holes list carries — by
description rather than by ordinal, since two changes landed holes in that list on the same day and every
number in it moved. `Bash(git push --force:*)` is a prefix pattern on the host, and nothing in that DSL
reaches a command in second position. What the fix must not do is widen a gate, and the control is asserted —
`git push --force-with-lease` is **Auto** by the maintainer's ruling and stays Auto, mid-line or not.

## Why Gated is `ask` and the constitution is `deny`

[`../gate-map.md`](../gate-map.md) defines Gated as *explicit human approval, per action* — which is
what `ask` is. Interactively it prompts; headless, where nobody can approve, it blocks. Measured: a
`git push` under an `ask` rule in `claude -p` is refused and the remote receives nothing.

Compiling Gated to `deny` would have been the *prohibition* semantics wearing the Gated tier's name,
and it would have flattened the one rule that has no approval path at all — nobody edits
[`../../docs/vision.md`](../../docs/vision.md) — into an ordinary push. That is why the policy carries
four tier classes where core names three: `prohibited` is not a stronger `gated`, it is a different
answer to a different question.

## The permission pattern respects token boundaries — measured, not assumed

`force-push-without-a-lease` compiles to `Bash(git push --force:*)` while `git push --force-with-lease`
is **Auto**. Those two look like they must collide: one string is a prefix of the other, and this
runner's own matcher has to enforce a word boundary explicitly. A review on
[#31](https://github.com/sleepy-panda-srl/portulan/pull/31) raised exactly that — if the permission
layer matched naively, the load-bearing layer would be **stricter than the policy**, re-gating an action
the maintainer had just ungated.

Measured on CLI 2.1.220, with both controls, because the failure mode here is a denial that looks like
your rule and is not:

| Rule present | Command | Result |
|---|---|---|
| `Bash(git push --force:*)` | `git push --force origin HEAD` | **"Permission to use Bash with command … has been denied"** — the rule's own wording. It fired. |
| `Bash(git push --force:*)` | `git push --force-with-lease origin HEAD` | "This command requires approval" |
| *no rule at all* | `git push --force-with-lease origin HEAD` | "This command requires approval" — **identical** |

The last two rows are the answer. With and without the rule the outcome is byte-identical, so the rule
**never matched** `--force-with-lease`: the host's `Bash(prefix:*)` matching is token-aware, not naive
string-prefix. The finding was a false positive and is refused with a measurement rather than an
argument — the second time that has been the right response to a review here.

**What was measured is one boundary case**, and the claim is scoped to it: a longer token beginning with
the pattern's final token is not matched. Nothing here establishes how the host treats quoting,
subshells, or flag reordering, and `git push origin x --force` reaches neither layer — which is in the
honest-holes list in [`../gate-map.md`](../gate-map.md) rather than here.

Re-test on upgrade. This is a fact about one CLI version, and the policy above leans on it.

## The floor backend, and why its refusals are the interesting half

[`github-ruleset.json`](github-ruleset.json) is the second backend's artifact: a GitHub repository
ruleset compiled from the same [`../gates.json`](../gates.json), carrying the three rule types the
milestone-4 criterion names — a pull-request requirement, required status checks (**strict**), and a
block on force-pushes — plus `deletion`, because the policy gates that spelling too.

The criterion positions it as **the floor backend**: what every host falls back to, and all that a host
with no hook system has. `../../core/operating/autonomy.md` says the floor is the floor *"because it
holds when everything above it fails"* — quoted verbatim, since a paraphrase inside quotation marks is the
small version of the defect this file is about — and promises that the enforcement compiler generates
it. This is
that promise, discharged — and it is why the tier partition had to move.

**The two backends disagree about `propose`, and that disagreement is the design.** The Claude Code
backend refuses every `propose` rule with the words *"enforced by the platform floor — pull requests,
required checks, review — not by a tool-level permission rule on this machine"*. That sentence names
this backend. For one session it lived in the shared stage, refusing `propose` before any backend ran —
so the floor backend, when it arrived, would have found the rules it exists to compile already thrown
away, and would have emitted an empty ruleset while reporting success. Recorded as
[`../memory/a-shared-stage-must-not-hold-one-backends-opinion.md`](../memory/a-shared-stage-must-not-hold-one-backends-opinion.md).

**It generates and never applies.** Importing a ruleset is a repository-settings change: outward,
Gated, the maintainer's, per the [`0001`](../proposals/0001-platform-floor-on-main.md) precedent. The
compiler writes a file and stops. Nothing here calls an API.

### What it refuses, and why the refusals are scoped rather than absolute

Seven of this repository's twenty-four rules compile; seventeen refuse, each by name and with its own
sentence. The reasons are scoped to **this export** rather than to GitHub, because the convenient
blanket version — *"the platform gates a ref, not a path"* — is simply false, and
[`../memory/a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
binds any sentence containing *cannot*:

- **A write-scoped rule** refuses for scope. `CODEOWNERS` gates owned paths and is named as part of the
  floor by `autonomy.md` itself; push rulesets gate file paths. This export emits one branch ruleset and
  neither of those, and this repository's `CODEOWNERS` is separately non-enforcing.
- **`git tag` and `gh release`** would be reached by a **tag** ruleset targeting `refs/tags/*`. Not
  emitted, so out of scope — not beyond the platform.
- **`gh pr merge`** is the one worth reading twice. The floor *constrains* it — required checks green,
  and with strict checks a head that is not behind the base — but with a required review count of 0 it
  does not require anyone's yes, which is what the Gated tier means. Reported as **not compiled** rather
  than as covered, because overstating a guarantee in the artifact whose subject is guarantees is the
  worst place to do it.
- **Everything else** — `gh api`, `gh repo …`, `npm publish` — has no ruleset of any target.

### The coarseness runs in both directions

Stated in the compiler's own output, because a backend reporting only where it is weaker than the policy
would be flattering itself:

- **Stricter.** On `refs/heads/main`, `non_fast_forward` blocks *every* force-push, including
  `git push --force-with-lease`, which this policy classifies **Auto**. The floor gates a ref and cannot
  read a command's flags.
- **Narrower.** Every rule applies to one declared ref and nothing else. A policy rule about any other
  branch is uncovered even where it "compiled".
- **Partial.** The export carries the three named rule types and no more. Imported beside classic branch
  protection it **adds** a layer rather than replacing one — and removing classic protection afterwards
  would drop whatever this ruleset does not carry.

### Recognition is by exact spelling, and that is a limit

The action vocabulary has no `ref` kind — a rule says `{"shell": "git push --force"}` — so this backend
matches command strings against a two-entry table. `git push -f` is the same action to a human and is
**refused, loudly**, rather than silently gated. A matcher clever enough to generalise would be clever
enough to be wrong quietly, and false reds are what get a check switched off.

### The floor declaration, and the one thing a policy may not declare

`floor` names what the export would otherwise have to invent: the branch, the required check contexts
(with their app pins), the required review count, and whether conversation resolution is required. No
defaults — a compiler that invents the ref it gates has stopped compiling policy and started writing it.

What a policy may **not** declare is `strict`. A pull request may not merge from behind its base
([`0011`](../proposals/0011-no-merge-from-behind-main.md), applied live), so the export forces it. A
declarable `strict: false` would be a compiled artifact quietly undoing a ruling, in a diff nobody would
read as one. `bypass_actors` is empty for the same class of reason: a floor carrying an exemption for
the only actor who can act is not a floor.

The emitted JSON carries only GitHub's **input** fields, and the provenance of that claim is worth
splitting, because half of it is read and half is not. The **envelope** — `name`, `target`, `enforcement`,
`conditions.ref_name`, `rules`, `bypass_actors` — and the list of server fields to omit (`id`, `node_id`,
`source`, `source_type`, `created_at`, `updated_at`, `_links`, `current_user_can_bypass`) were **read from
two live rulesets** on 2026-07-27: the organisation's default-branch ruleset and this repository's
Copilot-review one. Neither of those carries a `pull_request` or a `required_status_checks` rule, so the
**parameter blocks for the two rules that matter most come from GitHub's documented schema, not from any
ruleset read here.** They were checked against that documentation at the pre-commit checkpoint and are
correct; they are simply not observed the way the envelope is, and
[`../memory/a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
sits three lines away and does not permit rounding that up. An export asserting facts it cannot know is a
worse file than a shorter one — and so is a README asserting a provenance it did not have. The generated-ness lives in the ruleset **name**, since JSON has no comments and a
ruleset has no description field — the same job the `$portulan` header does in the other artifact, done
in the one field the settings UI shows.

## The per-host backend matrix

`node cli/compile.mjs --matrix` prints every rule against every backend, plus the line that matters most:
**the gates no backend compiles at all.** For this repository that is three —
`rename-or-transfer-a-repository`, `spend-money-or-register-a-domain`,
`send-something-outside-this-repository` — each a rule with no tool-level surface and no ruleset, and so
a prompt-level habit until something reaches it. `doctor` reports the same accounting under the
`enforcement` check.

Two things it deliberately does not do. It does not pad that number with the five `auto` rules no backend
compiles: an unattended rule enforced by nothing is the system working, and reporting eight where three
are real is how a report gets skimmed. And it is **derived from the backends rather than maintained
beside them** — a matrix written by hand is a claim about compilers, and a coverage claim that drifts
does not look wrong, it looks like enforcement that quietly stopped covering something.

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

## Pack-contributed gate rules — designed for at milestone 4, built at milestone 6

The cascade is `core < pack < workspace`, and
[`../../packs/tools/README.md`](../../packs/tools/README.md) has promised since it was written that a tool
pack ships "with the gate classification for each" — so pack-contributed rules are **promised**, not merely
unprecluded. Marius agreed the direction on 2026-07-27, with one constraint that is the whole of why it is
safe:

> **Packs may only tighten.** A pack may raise a tier or add a prohibition. It may never demote another
> layer's classification.

The reason is supply-chain shaped rather than aesthetic: a composed-in third-party artifact that could
quietly demote `push` from Gated to Auto would be a dependency with the power to disarm the gate that
exists to contain it — and the demotion would look exactly like configuration. Tighten-only means the worst
a hostile or careless pack can do is make a workspace *more* cautious, which is a bug rather than a breach.
The **workspace** may still override explicitly in its own gate map, because it owns its policy — with
core's `prohibited` entries excepted, since those are grantable only through the evolution gate.

**This was designed for and deliberately not built at milestone 4** — no pack existed, and a slot before
its consumer is the mistake the Workspace Definition was written to avoid. What was done instead was
smaller, and is the same move as modelling `products` as an array with one product: the policy is a
**list of id-addressed rules with no dependence on being the only source**, so the merge step would be an
addition rather than a redesign.

**It was built at milestone 6, and the prediction held** — the merge is an addition. `compile` now
resolves the packs a workspace declares, reads each `pack.json`, and composes its `contributes.gates`
fragments onto the policy **before `parse` runs**, so a fragment is validated by exactly the code that
validates a hand-written rule. Three outcomes, all printed:

| Outcome | What it means |
|---|---|
| **adds** | The fragment names an id no lower layer carries. A pure addition. |
| **tightens** | The fragment names an existing id at a **stronger** tier, carrying that rule's action unchanged. The tier is raised and the move is printed, `from → to`. |
| **refused** | The fragment would move an id to the same tier or weaker, **or** would change what the rule matches. **This throws**, and the build stops. |

**Tightening has two axes, and the second one was nearly missed.** A first version compared only the
tier. That is not tighten-only: a fragment naming an existing id at a stronger tier **replaces the whole
rule, including its action**, so raising the tier while swapping the matcher passes every rank check and
removes the gate. Measured against this repository's live policy before it was closed — a fragment
`{id: force-push-without-a-lease, tier: prohibited, action: {none: …}}` was reported as
`tightens gated → prohibited` and the emitted `Bash(git push --force:*)` gate **disappeared**, leaving
the workspace strictly less cautious about the exact action the rule exists to gate. Rule ids are
greppable by design and ship in `core/`, so knowing one is not a barrier.

So a fragment naming an existing id must carry that rule's action **unaltered**. A pack that wants to
gate a different action contributes a **new id**; changing what an existing rule matches belongs to the
workspace, which owns its policy. The tier is checked first, so a demotion is still reported as a
demotion rather than as an action change.

_Found by the pre-commit supervisor, on a session whose own pre-commit checkpoint was the thing that
caught it. That is the argument for the checkpoint restated as evidence, and it is the second time a
fresh context has found a hole in this file's subject by attacking the matcher rather than reading it._

**A demotion is refused loudly rather than dropped quietly**, because the two are different events: a
backend refusing a rule it cannot express is a coverage gap, while a pack moving `gated` to `propose` is
an attempt to disarm a gate, and a build that continues past it has published an artifact weaker than the
policy it claims to compile. Failing closed is right *here* and wrong in [`gate.mjs`](../../cli/gate.mjs) for a
reason worth keeping straight: this runs at build time against a file you can edit, while that runs on
every tool call and a refusal there makes the session undriveable.

**Two layers enforce tighten-only, and neither is sufficient alone.** The Pack Definition leaves `auto`
out of its tier enum, so a schema-valid pack cannot express a demotion to unattended *at all* — that is
the half a manifest's shape can enforce without seeing the layer beneath it. The relative comparison is
this compiler's, because tightening is relative to the tier an id already holds and no manifest can see
that. The compiler re-checks `auto` anyway: it does not depend on the schema having been applied, and
`doctor` and `compile` have no ordering between them.

**What the check cannot see**, stated because a guarantee is only as good as its boundary: the workspace
may still override any of this explicitly in its own gate map — it owns its policy — with core's
`prohibited` entries excepted, since those are grantable only through the evolution gate. Tighten-only
binds packs, not the layer composing them.

## The limits, stated where somebody will meet them

- **One level of wrapper unwrapping, and no more.** Deeper nesting, a heredoc, an interpolated
  variable, a command assembled at runtime — all still escape. Asserted as a test rather than only
  written here, so that anyone tempted to call this layer a rail meets the counterexample. What must
  not happen *regardless of spelling* belongs on the platform floor.
- **The shell half of a `write:` gate is a table of writers, and only the hook carries it.** Its
  contents and its holes are above; the part that belongs in a limits list is that this **half** has
  no permission rule beneath it, so a broken hook removes it silently while the `Edit`/`Write`
  denials stay standing and the gate still reads as whole from outside. (The rule as a whole *does*
  have permission rules — three of them. It is the shell half that stands alone, and the shorter
  phrasing an earlier draft used was wrong about which.)
- **Matching a gated command past the first word is also the hook's alone.** Same shape, different
  action kind: the host's `Bash(prefix:*)` cannot reach `ls && git push --force`, so what closes it
  is the runner splitting the line — and that too is gone if the hook is.
- **This layer is a convenience above a rail, not the rail.** The floor — branch protection, required
  checks, PR-as-gate — refuses a push at the server whatever any local file says. `autonomy.md` calls
  the floor "the gate that holds when everything above it fails", and this is the thing above it.
- **The Stop event is not the doctrine's "end of task".** It fires when the agent finishes any
  response, so a gate blocking on every red would make a red working copy undriveable — including by
  the session opened to fix the red. Hence the cap — a real weakening, stated as one: an agent refused
  enough times ends anyway, with the unresolved problems printed each time. CI still refuses the merge.
  This gate makes a red *unmissable*, not *binding*.
- **The cap counts three CONSECUTIVE refusals PER REASON, and a reason's count clears only when that
  reason clears** — because it exists to end a *futile-retry episode*, not to ration a long honest session
  that hits and properly fixes several unrelated reds, which would be ceremony that cannot scale down.
  (Maintainer's ruling, 2026-07-27, generalised in
  [`../tasks/0007-per-reason-stop-gate-counters.md`](../tasks/0007-per-reason-stop-gate-counters.md).)
  Three riders. **Refusals, not stops** — the first version charged every Stop event, so a session spent
  its budget on green turns and a genuine red then passed with a note. An **absolute ceiling of nine**
  that does not reset, which closed a hang the first reset rule created and survives its removal as the
  backstop that guarantees the gate can always stop — including for a reason added later that nobody
  remembered to give a clearing condition. And **one refusal is one charge against the ceiling however
  many reasons it names**, or a two-reason session would reach nine in half the attempts. What the
  per-reason counters removed is the asymmetry the ruling itself named: a missing five-line handoff used
  to ride to nine on the strength of a green recipe, while a failing suite got three.
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
| [`gate.mjs`](../../cli/gate.mjs) | the same push written `bash -c "git push …"`, the spelling the permission pattern cannot see: refused, carrying this policy's own sentence verbatim. |
| [`gate.mjs`](../../cli/gate.mjs), shell half of a write gate | **Runner:** five payloads on stdin, 2026-07-28, as the host would send them. `echo x >> docs/vision.md`, `bash -c "sed -i .bak s/a/b/ docs/vision.md"` and `cp /tmp/x docs/vision.md` each returned `permissionDecision: "deny"` carrying `edit-the-constitution`'s own sentence; `cat docs/vision.md` and `git status` produced no output and exit 0 — the runner stepping aside, the control that distinguishes *refused* from *refuses everything*. **Host: observed, not inferred.** This row said "inferred" for one draft, and then the checkpoint closed it twice by accident, which is the only way this particular fact was ever going to be caught. The supervisor's own scratch script — `printf … > …/docs/vision.md` under `/private/tmp` — was refused by the host, and the text it received was verbatim `gate.mjs` output, ``PORTULAN GATE `edit-the-constitution` (prohibited) — …``. No permission rule produces that string: the deny list holds only `Edit`, `Write` and `NotebookEdit`. The implementing session then hit the identical refusal on an inline `node -e` probe. So **the host does invoke this hook for a `Bash` call, and the hook's decision and its sentence both reach the agent.** Both incidents were also false reds — one on an unrelated tree, one on a quoted string — which is the coarse direction this design chose on purpose, met in the wild within the hour. |
| [`stop.mjs`](../../cli/stop-gate.mjs), recipe half | one dead link planted; a session told to reply `done` was refused three times carrying the recipe's output naming file and line, then released at the cap. Green, it ended in one turn. |
| [`stop.mjs`](../../cli/stop-gate.mjs), handoff half | recipe left **green** so the block could only come from this half; today's handoff moved aside and a scratch file making the session count as work. Refused three times naming the exact date, then released. **Run before the reset ruling**, when there was one cap of three and no reset at all — so that release came from the single cap. Under the arithmetic session 0 *ended* with, the same run's bound would have been the ceiling of nine, which is exactly the asymmetry the maintainer named; per-reason counters return it to the handoff's own cap of three. |
| [`stop.mjs`](../../cli/stop-gate.mjs), per-reason counters | the recipe half re-run live on the real tree after the change: one dead link planted, four attempts, blocked at `recipe 1/3`, `2/3`, `3/3`, then released naming *"the cap of 3 consecutive refusals for `recipe`"* — the reason, not just the number. A green tree allowed the stop in one attempt as the positive control. The handoff half was **not** re-run live by the session that made the change, and this row said so rather than quietly counting it as covered — the branch cannot fire in this tree on a day when any session has already written a dated handoff. **The milestone-4 close checkpoint then ran it**, in an isolated clone where that constraint does not apply: recipe green throughout, blocked `handoff 1/3 → 3/3`, released on the fourth naming its own cap of three rather than the ceiling of nine. So the one acceptance criterion of [`../tasks/0007-per-reason-stop-gate-counters.md`](../tasks/0007-per-reason-stop-gate-counters.md) that was suite-only is now a live observation too, and it was made by a fresh context rather than by the session that wanted it to pass. |
| [`github-ruleset.json`](github-ruleset.json) | **The weakest row here, and it says so.** The emitted JSON was compared field by field against the repository's live protection — `strict` true, both required contexts with their app pin, 0 required reviews, conversation resolution on, force-pushes and deletion blocked — and every value matches the floor in force. Read **twice, independently**: once by the implementing session and once by the fresh-context supervisor at the pre-commit checkpoint, which is the only reason the comparison is worth more than the diff's own word for it. What was **not** done is an import, because importing is a settings change and therefore Gated. So: envelope observed, values observed twice, the two load-bearing parameter blocks taken from GitHub's documented schema, and *acceptance by GitHub's importer* inferred rather than demonstrated. |

**Where the rule settles for an admission rather than evidence**, which it says to state plainly: nothing
proves the artifact still works *after this session*. Each row above is a fact about one CLI version on one
day. There is no scheduled re-run, CI cannot install a host to attempt one, and the failure mode is silent —
a hook the host quietly stopped loading looks exactly like a session with nothing to block. **This runner's
own silence is not evidence.** Re-run the table on every Claude Code upgrade.

## Why these files are here and not in a top-level `hooks/`

Because this repository **is** a plugin whose payload is the whole tree, and that makes the obvious
location dangerous. Measured: a plugin shipping `hooks/hooks.json` has those hooks **fire for anyone
who installs it**, in projects unrelated to this one — a positive control ran the same command
successfully with the plugin absent. A top-level `hooks/` here would push Sleepy Panda SRL's own gate map
onto every installer's machine, denying *their* pushes and blocking *their* sessions.

`.claude/settings.json`, by contrast, ships as inert data: measured, a plugin carrying one has no
effect on the installer. It activates only when this repository is the project — which is exactly the
dogfooding this milestone is for, and nothing wider.

This is the `agents/` lesson from milestone 3 repeating with higher stakes: for a repo-rooted plugin,
top-level directory names are **platform-reserved**, and the cost of picking one by accident is paid
by strangers.

The same reasoning chose this directory for [`github-ruleset.json`](github-ruleset.json) over the
obvious `.github/`. It ships in the payload either way and is inert either way — it is data nothing
reads unless a human imports it — but `.github/` is the forge's reserved directory, and putting a
generated file there is the same bet that lost twice already. A compile output belongs beside the
compiler's other outputs.
