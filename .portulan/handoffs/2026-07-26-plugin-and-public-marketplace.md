# Handoff — the plugin, and what measuring two validators cost

**State.** Milestone 3, session 0 of 1–2. Shipped: the plugin
([`../../.claude-plugin/plugin.json`](../../.claude-plugin/plugin.json), a populated
[marketplace entry](../../.claude-plugin/marketplace.json), the [boot skill](../../plugin/skills/portulan/SKILL.md),
three [agents](../../plugin/agents/)), the packaging validator
[`../../cli/plugin-lint.mjs`](../../cli/plugin-lint.mjs) with its suite, a fifth verify recipe
[`../verify/plugin.sh`](../verify/plugin.sh), [`../../CODEOWNERS`](../../CODEOWNERS), and one new rule.
Task [`0003`](../tasks/0003-plugin-and-public-marketplace.md) is complete on its session-0 half.
**Milestone 3 does not close here** — the tag and the fresh-machine install both need a push.

## Decisions + why

- **The repository root is the plugin root.** Forced, not preferred. Plugin component paths must start
  with `./` and stay inside the plugin root, so a plugin rooted at `plugin/` cannot reference
  `../core/skills/`; it could only carry copies, and two copies of the engine's skills is the drift class
  milestone 2 spent itself building a lint against. Rooting at the repository makes the skills `core/`
  documents and the skills a user installs the same files — and the practical test of the constitution's
  "standards first" claim passed on the way: nothing had to be *added* to a skill to make it shippable.

- **The payload is the whole repository, and that was the maintainer's call.** An install copies
  `docs/`, `examples/`, `cli/`, `spec/` and this workspace into the plugin cache. The session-open
  supervisor found the alternative the implementer had not considered — the platform dereferences
  symlinks resolving within a marketplace, so `plugin/skills/x → ../../core/skills/x` would ship an
  engine-only payload — and it is recorded in [`../../plugin/README.md`](../../plugin/README.md) with the
  reason it was not taken (local-directory installs *skip* symlinks resolving outside the plugin
  directory, which is exactly how this gets tested before a release). A decision record that never
  mentions the alternative is not a decision record.

- **The boot skill searches the project, never its own bundle.** The consequence of the payload decision
  is that every installation contains two valid workspace manifests — this repository's and the demo's.
  A skill looking for "a `.portulan/` nearby" would find one inside `${CLAUDE_PLUGIN_ROOT}`, load another
  team's identity, gate map and definition of done, and look exactly like success. Also caught at
  session-open, before it was written.

- **The persona bindings are lossy, and each says which kind it is.** Of three charters, one survives
  translation into a tool grant: the reviewer *does not edit the code under review*, so its agent gets no
  write tool and the firewall becomes a rail. The implementer's Auto/Gated line cannot be drawn on a host
  where one `Bash` grant covers both running a verify recipe and pushing. The librarian's *drafts
  everything, accepts nothing* is a constraint on what it may conclude, not on what it may call. Stated
  in each agent file, so nobody reads a frontmatter list as the gate.

- **`CODEOWNERS` ships with its enforcing setting off, and says so in its own first paragraph.** Turning
  on *Require review from Code Owners* would require an approval nobody present can give: GitHub forbids
  approving your own pull request, there is one human, and `enforce_admins` has no exemption for him. So
  the file routes review and records ownership, and `docs/vision.md` remains protected by prohibition
  rather than by the platform. Shipping it silently as though it were a rail would have been the overclaim
  [`../dod.md`](../dod.md) condition 4 exists to prevent.

## The verification, run rather than asserted

**The suite was written first and went red on the right module** — the distinction that cost a previous
session a transcript, when a bare-directory argument produced a red about the invocation:

```
$ node --test "cli/plugin-lint.test.mjs"
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/cli/plugin-lint.mjs'
ℹ tests 1   ℹ pass 0   ℹ fail 1                                                       exit: 1
```

**Then red for a better reason.** With the validator implemented and the plugin not yet written, 55 of 57
passed and the two failures were *"this repository lints green"* and *"this repository is exit 0"* — the
suite had become the milestone's specification. Both are green now, at 59 tests; the combined recipe runs
141 across two suites.

**The first-party validator was measured, not cited.** This is the session's most useful hour and it
reversed the implementer's own proposal.

```
$ claude plugin validate . --strict        # with "agents": ["./plugin/agents/"]
  ❯ plugins[0] plugin.json → agents: Invalid input                                    exit: 1
$ node cli/plugin-lint.mjs .               # the same file, same moment
  GREEN — 0 failure(s) … 3 agent(s)                                                   exit: 0
```

The lint had resolved the path, walked the directory and read every agent behind it. It was not lazy; it
does not own that contract. `agents` requires explicit `.md` files — probed four ways, only the explicit
list passes.

And the same measurement in the other direction, three separate forced reds inside a shipped skill:

```
$ printf '# Clarify\n' > core/skills/clarify/SKILL.md    # frontmatter deleted
$ claude plugin validate . --strict        ✔ Validation passed                        exit: 0
$ node cli/plugin-lint.mjs .               FAIL skills … has no usable frontmatter    exit: 1
```

Repeated with the `description` emptied and with a non-kebab-case `name`: passed, passed. Narrowed
further with minimal probes — at a **marketplace root** it validates no skills at all, and in **plugin**
form it validates only skills under the default `./skills/` directory. Every skill this repository ships
sits behind a declared custom path, so it examines **none** of them.

**Which means the criterion as first drafted would have been weaker than the one it replaced.** The
implementer proposed `claude plugin validate --strict` as the successor to `skills-ref validate`;
`skills-ref` at least reads a `SKILL.md`. The amended clause names both checkers because neither contains
the other. Recorded as
[`../memory/a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md).

**`skills-ref` was run before it was amended away**, on the maintainer's instruction, with lifecycle
scripts disabled — because an amendment that has not been tested against the thing it removes is
indistinguishable from fleeing a red:

```
$ skills-ref validate core/skills/clarify   Valid skill: …                            exit: 0
$ skills-ref validate core/skills/codify    Valid skill: …                            exit: 0
$ skills-ref validate <repository root>     Validation failed …                       exit: 1
```

Both skills pass it today, so nothing was fled. It is not a no-op either — it rejects missing
frontmatter, a missing description and an empty one, measured on purpose-built fixtures. It simply has no
concept of a plugin or a marketplace, which is two thirds of what this milestone ships.

**A defect in the new validator, found by running it rather than by testing it.** Called with a relative
root — which is how the recipe calls it — every shipped skill was reported as *not covered by any
declared skills path*, while the same run counted three skills through those very paths. Declared paths
resolved absolute; the tree walk stayed relative; the set membership test never matched. Every fixture in
the suite passes an absolute temporary directory, so the suite could not have caught it. Now normalised
at the boundary, with a test that runs the same tree both ways.

**Every check in the new recipe forced red before its green was believed**, on the real tree rather than
on a fixture, and the two exit codes kept distinct:

| Forced condition | exit |
|---|---|
| `marketplace.json` declares no plugins | `1` FAIL market |
| the marketplace entry and `plugin.json` disagree about the name | `1` FAIL agree |
| a declared skills path does not resolve | `1` FAIL paths |
| a shipped skill has no `description` | `1` FAIL skills |
| `cli/plugin-lint.mjs` absent | `2` could not run |
| a second `plugin.json` in the tree, not in `PLUGIN_ROOTS` | `2` could not run |
| no `node` on `PATH` | `2` could not run |

The last two matter most. A missing validator arriving as `1` would be a red verdict about packaging
nothing had looked at — the defect a reviewer found in `doctor.sh` — and the audit is the mirror hole:
`packs/` will ship plugins, and a second `plugin.json` added and not listed would be linted by nothing.
_(The `no node` measurement was taken twice: the first attempt emptied `PATH` so thoroughly that `sh`
itself was gone, and reported `127` — a measurement of the harness, not of the recipe.)_

**Proposal 0004's mechanism, third payout:**

```
$ git diff --stat -- .github/workflows/verify.yml
(no output — the workflow was not touched, and CI now runs five recipes)
```

All five green locally: `docs`, `json`, `doctor`, `tests`, `plugin`.

## What the session-open checkpoint found

**APPROVE-WITH-ADJUSTMENTS, ten required, all folded in.** Four changed the work rather than the prose:
the symlink alternative the implementer had never considered; the boot-skill false green; that
`clarify` and `codify` had to be *named* as shipped skills, since the entire root-source argument
collapses if only the boot skill ships; and the instruction to **measure** the first-party validator's
coverage by forced red rather than cite it — which is what produced the finding above and changed the
amendment. Also: two `CODEOWNERS` claims missing from the sweep list
([`../gate-map.md`](../gate-map.md) and [`../products/portulan/affordances.md`](../products/portulan/affordances.md)),
a warning not to freeze the platform's reserved-name list into a repo-owned lint, and the requirement
that the deferred harness get a task file rather than a third forward-reference.

## Open questions

1. **The tag and the install demonstration are session 1, and the install has a wrinkle worth recording
   now.** GitHub `owner/repo` shorthand sources clone over SSH by default, so a machine authenticated
   over HTTPS needs `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` or a full URL. Noted at session-open so the
   demonstration does not misread an auth failure as a packaging failure.
2. **`claude plugin validate` is not a standing rail, by design, and nothing re-runs it.** It runs at the
   supervised checkpoints and must run before the `v0.1.0` tag. That is a mandate with a human behind it
   rather than a machine, which this workspace has a rule about
   ([`../memory/a-mandate-nothing-checks-is-already-broken.md`](../memory/a-mandate-nothing-checks-is-already-broken.md));
   it is named here rather than assumed.
3. **Nothing tests the five verify recipes.** Now [`0004`](../tasks/0004-a-harness-for-the-verify-recipes.md)
   rather than a sentence in a handoff. Seven fail-opens of one class.
4. **No hooks ship.** They belong with the enforcement compiler at milestone 4; packaging a hooks file
   before the gate map compiles would be shipping an enforcement that does not exist.
5. **The symlink behaviour recorded in [`../../plugin/README.md`](../../plugin/README.md) is read from
   documentation, not measured.** That a marketplace install dereferences an in-marketplace symlink, and
   that a local-directory install skips one resolving outside the plugin directory, is the stated reason
   the engine-only payload was not taken. Session 1 installs this plugin both ways and is the natural
   place to confirm it — or to correct the record, which would reopen the payload decision rather than
   settle it quietly.
6. **The `version` in both manifests reads `0.1.0` and no such tag exists yet.** Ordinary — you bump,
   then tag — but until session 1 cuts it, the manifests name a version the repository has never
   published. If the tag slips, that is the sentence that goes stale first.

## Found while performing the gated action, not before it

**The agent identity cannot open a pull request.** `portulan-agent[bot]` was tried first and GitHub
refused with `not all refs are readable` — creating a pull request needs repository-**contents** read,
which this App is deliberately denied. That denial is the load-bearing part of the whole mechanism, so
the answer is not to widen it: buying nicer attribution on one artifact by granting the token the
ability to write code trades the guarantee for the cosmetic. [#18](https://github.com/sleepy-panda-works/portulan/pull/18)
was opened with the maintainer's credentials and its first line says an agent wrote it — the fallback
this repository used before the App existed, which serves the rule's real purpose: a reader can tell.
Conversation on the pull request comes from the bot as usual. Recorded in
[`../gate-map.md`](../gate-map.md) and [`../tools/README.md`](../tools/README.md).

This is the second capability the identity turned out to lack, after thread resolution, and both were
found by attempting the action rather than by reading the permission list. Worth noting as a pattern:
the App's *stated* scope — "pull-request conversation" — reads as covering more than it does.

**Also confirmed on the remote rather than locally:** CI ran all five recipes, `plugin` included, with no
workflow edit — proposal 0004's mechanism demonstrated a third time and for the first time on a check
that was gating a real merge.

## Next action

**Session 1:** `claude plugin validate --strict` re-run and recorded, `v0.1.0` tagged, and a machine with
no local copy of this repository adding the marketplace, installing, and booting the engine — with the
transcript recording which visibility it ran under, because a private repository's install path is
authenticated and a public one's is not. Then milestone-close.

## Recoverability

Documentation, two new manifests, four new Markdown artifacts, one new script and its tests, one new
verify recipe, and a `CODEOWNERS` file that changes no behaviour. Nothing outward was taken and no
repository setting was changed. All five recipes are green, so the tree can be committed or discarded
whole. The push, the pull request, the merge, and the tag are Gated and are the maintainer's.
