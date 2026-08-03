# cli/

The `npx` CLI that wraps the file-based mechanics for hosts beyond Claude Code:
`init` (interview + codebase scan → drafted workspace) · `doctor` · `compile` (gates/verify → host
enforcement) · `vendor` (materialise a workspace where it is needed — into a host, and the reverse) ·
`index` · `upgrade` · `new` · `feedback`. That packaging is **milestone 7**, and as of session 0 the
entry point exists:
[`portulan.mjs`](portulan.mjs), reached as `portulan <subcommand>` through the `bin` in the
repository's `package.json`.

**Five of the eight dispatch; three exit 2.** `doctor`, `compile` and `index` exist because milestones
2, 4 and 5 needed them; `init` was built at milestone 7 session 1 and `new` at session 2. The entry
point calls each one's exported `run` and returns the code unchanged. `vendor`, `upgrade` and
`feedback` are named in `docs/vision.md` — all three — are not built, and say
so: they exit **2 — could not run**, naming where they arrive, because a stub exiting 0 would be a
fail-open where a user is most likely to trust silence.

**Why eight.** `docs/vision.md` names all eight and is human-owned. It named six until 2026-08-03:
`new` and `feedback` reached the CLI first, licensed by row 7 naming them in its own ratified text, and
the maintainer then folded both into the constitution — so the two-carrier state that licence created
lasted one pull request. Worth one sentence rather than none, because the *shape* recurs: a subcommand
may be licensed by the row before the constitution catches up, and while that holds, the tool has to say
which document names it.

Beside those eight sit **two** tools that are not on any of the lists, because milestone 3 and
milestone 5 needed them. Being off the list is a fact about `docs/vision.md`, which names these eight
subcommands and
is human-owned: whether `plugin-lint` or `librarian` ever joins them is the maintainer's call and not
an implementer's, so neither is described here as *coming to the CLI* — and neither is wired behind
the entry point, which is the same rule expressed in code rather than in a sentence.

## What is here today

| File | What it is |
|---|---|
| [`portulan.mjs`](portulan.mjs) | **The entry point** the published package exposes as `portulan`, added at milestone 7. It dispatches and adds nothing: each subcommand's module is imported **on demand** — so `portulan --help` does not pay for `doctor`, and a tool that fails to parse takes down only its own subcommand — and the tool's exit code is returned **unchanged**, because re-mapping it here would put a second opinion about a workspace between the tool and its user. Verified byte-identical to direct invocation for the three built subcommands it wrapped when it landed; `init` joined them at session 1 and is exercised through the entry point as well as directly. |
| [`portulan.test.mjs`](portulan.test.mjs) | Its test suite, written first. **Dispatch only**: which module is reached, that arguments arrive unchanged, that exit codes come back unchanged, and that every refusal exits `2`. It injects the loader rather than shelling out, because re-asserting what `doctor` or `index` already prove would make this file a second carrier of it — with one deliberate exception, a case that imports the real modules to check they still export `run`, since that is the single assumption the entry point rests on. |
| [`init.mjs`](init.mjs) | **The onboarding subcommand**, added at milestone 7 session 1: it drafts a workspace for a repository that has none. It **asks** where that workspace resides — in the repository, or in a workspace that names it — and has **no default**, because a repository is governed by exactly one workspace and that answer is the one that cannot be guessed. It refuses ahead of the first byte written: never over an existing residence, and never a name, governor or pack id a validator would misread. What it emits is a **draft** — including a verify recipe that exits 2 until the adopting team declares what green means for them. |
| [`init.test.mjs`](init.test.mjs) | Its test suite, written first. Its last group is the one that matters: it runs the real `doctor` against real drafted directories, in both residences, because a workspace nothing validated is a workspace nobody can trust. That group is what caught a drafted gate policy that parsed cleanly and compiled to a floor no rule reached. |
| [`doctor.mjs`](doctor.mjs) | The Workspace Definition validator. Zero dependencies, no install step, run from the repository root. Two repeatable roots, both **named rather than discovered** because this tool does no discovery: `--pack-root` is where declared packs are looked up, and `--repo-root` (2.7) is where the repositories a workspace's cards NAME are checked out, so the residence ruling's cross-repository refusal has somewhere to look. Without a `--repo-root` that check reports that it did not run rather than passing quietly. |
| [`doctor.test.mjs`](doctor.test.mjs) | Its test suite, on node's own runner. Written before the validator. |
| [`plugin-lint.mjs`](plugin-lint.mjs) | The packaging validator: the plugin and marketplace manifests, the skills they declare, and the agents at `./agents/` that nothing declares. |
| [`plugin-lint.test.mjs`](plugin-lint.test.mjs) | Its test suite, likewise written first. |
| [`compile.mjs`](compile.mjs) | The enforcement compiler: a workspace's [`../.portulan/gates.json`](../.portulan/gates.json) becomes host enforcement. One backend today — Claude Code `permissions` + `hooks` — and the vocabulary it reads stays the workspace's, so a second backend translates the same policy instead of forcing it to be rewritten. |
| [`compile.test.mjs`](compile.test.mjs) | Its test suite, likewise written first. Emission fidelity only — nothing in here can establish that a host *honours* what the compiler emits, which is a fact about a running host. |
| [`index.mjs`](index.mjs) | The index generator, over **two** series since Workspace Definition 2.5: the memory store, which is size-budgeted so a breach is a red, and the handoff series, which is not — an append-only series has no consolidation to offer, so every remedy a budget could ask for is already barred. Every field on every line is derived from what it points at, so neither file has a hand-maintained half; the *carriers* differ per series and on evidence, a record's title being its filename and a handoff's its H1. It writes an over-budget index rather than refusing to — the remedy is consolidation, and consolidating needs the artifact to consolidate from. |
| [`index.test.mjs`](index.test.mjs) | Its test suite, written first. Derivation, drift and cost only — nothing in here can establish that the index is any good at *recall*, which is an eval question. |
| [`stop-gate.test.mjs`](stop-gate.test.mjs) | The exception to "written first": it covers the Stop-gate runner ([`stop-gate.mjs`](stop-gate.mjs)), and it exists because a supervisor found a fail-open and a forever-block in a runner nothing tested at all. Its cap arithmetic and date handling — deliberately not its I/O. |
| [`librarian.mjs`](librarian.mjs) | The scheduled librarian's pass: reindex over both series, record age from git, the sealed-stamp re-validation nag, proposal nagging, demotion drafts, **mining** — incidents nothing in the curated layer points back at, and paths pull-request reviewers keep leaving findings on — and **consolidation**, read as budget distance plus the records citing one incident. The one tool here that reads **history** — `doctor` reads the tree and says so — which is why it belongs to a scheduled job rather than to a verify recipe: a check that reads history is a false-red generator in a shallow checkout. It renders no verdict, so it has no exit 1, and it **writes nothing itself**: the command writes, and only after the pass's own handoff is on disk, because that handoff is a member of the series one of the indexes covers. |
| [`librarian.test.mjs`](librarian.test.mjs) | Its test suite, written first, on real scratch git repositories rather than an injected clock — a fake history proves nothing about the one call this tool exists to make. |
| [`fixtures/`](fixtures/) | Known-bad manifests, and a workspace whose repo card has drifted from its tree. |

```
portulan <subcommand> [options]          # or: node cli/portulan.mjs <subcommand> [options]

node cli/init.mjs --residence <in-repo|pointer> [options] <repository-dir>
node cli/doctor.mjs <workspace-dir> [<workspace-dir> ...]
node cli/plugin-lint.mjs <plugin-root> [<plugin-root> ...]
node cli/compile.mjs [--workspace <dir>] [--check]
node cli/index.mjs [--check] <workspace-dir> [<workspace-dir> ...]
node cli/librarian.mjs [--as-of YYYY-MM-DD] [--write] [--log <path>] [--reviews <path>] <workspace-dir> [...]
```

The two validators: exit `0` when every workspace or plugin root validates · `1` when at least one does
not · `2` could not run. `compile`: exit `0` when it wrote, or agreed under `--check` · `1` only under
`--check`, when the artifact is missing or has drifted · `2` could not run — writing never returns `1`,
because a run that rewrites the artifact has nothing to disagree with. `init` has only **two** codes —
`0` it wrote · `2` it could not run — and the missing `1` is the point: it renders no verdict about
anybody's workspace, so it has no red to report. `index` uses the same three
codes and differs from `compile` in one way worth knowing before reading it: **writing can still return
`1`**, because a budget breach is a verdict about the store rather than about the artifact, and the
artifact is written anyway so there is something to consolidate from. Both workspaces this repository
owns are validated on every pull request, because
[`../.portulan/workspace.json`](../.portulan/workspace.json) declares
[`../.portulan/verify/doctor.sh`](../.portulan/verify/doctor.sh) as a verify recipe and CI runs every
recipe the manifest declares.

## What `doctor` checks

- **Schema conformance** against [`../spec/workspace.schema.json`](../spec/workspace.schema.json),
  naming the violated constraint and its location. The validator implements exactly the JSON Schema
  subset [`../spec/README.md`](../spec/README.md) names, and **refuses a schema that reaches outside it**
  rather than ignoring the keyword — a validator that skips what it does not know reports conformance it
  never checked.
- **Path slots resolve**, as files or directories per the schema. A slot resolving outside the workspace
  is reported, never failed; `constitution` and `tree` are expected to.
- **Cross-references hold** — `verify.default` names a real recipe, `products[].repos` names real cards.
- **Claims against the tree**, where the workspace declares one: a repo card's build/test/run and layout
  paths, and the status check the gate map says `main` requires.
- **Rule provenance** — every `type: rule` memory record carries a well-formed link or sealed stamp, and
  the **sealed proportion** is reported, because a workspace where every rule is sealed has opted out of
  retirement altogether.
- **The store's growth is reported, never judged** — record count and total size on every run, plus a
  note naming any record that states no `Retire when:` condition, because a record no condition can
  demote is how a store only grows. Notes, not failures: no rule mandates the field. Ages are absent on
  purpose — doctor reads the tree, never git, and in a fresh clone every mtime is checkout time, so an
  age report from here would be fabrication; staleness is the librarian's (milestone 5).

## What it does not do, and will not pretend to

- **`doctor` never runs a verify recipe.** It reads them — which is why a recipe needing a tool it did
  not declare still passes it. Executing one is the Stop-gate runner
  ([`stop-gate.mjs`](stop-gate.mjs), milestone 4), and it runs the
  *default* recipe only.
- **It never dereferences a link.** "Resolvable" means well-formed. A gate that needs the network fails
  for reasons unrelated to the change under test.
- **It never judges truth.** A fabricated sealed stamp passes exactly as a real one does; a path that
  resolves says nothing about whether the document at the end of it is still accurate.
- **It does not score agent-legibility.** The `affordances` slot is the input such an audit would read.
  The audit is not built, and calling this a score would be an overclaim.
- **It cannot see live settings.** The gate-map lint compares a claimed status-check name against job ids
  in the tree. Whether branch protection actually requires that check, and which app it is pinned to, are
  API facts `doctor` does not fetch.
- **The per-host report covers two backends, and two is not many.** `compile --matrix` and `doctor`'s
  `enforcement` notes account for every rule against the Claude Code host and the GitHub repository
  ruleset. A host with neither — a different agent runtime, a different forge — has no column here, and
  the matrix says nothing about it rather than implying coverage.
- **Exported-versus-live drift is not checked by anything automatic.** `compile` proves the exported
  ruleset matches the policy. Whether the repository's *live* settings match the export is a fact about
  an API `doctor` does not call and a recipe may not reach; it is compared at the supervised checkpoints,
  by hand, and the milestone-4 row says so.
- **`compile` cannot tell whether the host honours what it emits.** It proves the artifact matches the
  policy. That a permission rule or a hook is actually enforced is a fact about a running host, measured
  at the supervised checkpoints — see
  [`../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md`](../.portulan/memory/a-manifest-field-can-validate-and-load-nothing.md)
  for what it costs to assume otherwise.

## What `plugin-lint` checks

Both manifests parse and are objects; `plugin.json` has a kebab-case `name` and, if it declares one, a
SemVer `version`; `marketplace.json` has a name, an owner, and **at least one plugin**; every entry has a
name and a source; every relative source and every component path starts with `./`, stays inside the
tree, and resolves; the marketplace entry that points at the plugin root agrees with `plugin.json` about
name and version; every declared skill — and every agent at `./agents/`, which the manifest cannot
declare without suppressing it — is a real file with frontmatter, a kebab-case
`name`, and a non-empty `description`. A skill found in the tree but covered by no declared path is
**reported** — declared is what ships, and an undeclared skill is one its author believes is shipping.

Two of those are **stricter than the platform**, on purpose, and are this repository's invariants rather
than claims about the contract. `name` is optional to Claude Code: omit it and the invocation name is
inherited from the layout — the directory name for a skill in a `skills/<dir>/` subdirectory, but the
*install* directory for a path pointing straight at one, which on a marketplace install is a version
string that changes with every update. Requiring it makes a skill's name a property of the skill.
And a component path is required to resolve **after canonicalisation**, not merely lexically, so a
symlink out of the tree is caught rather than read as containment.

**What it is not.** It is not an implementation of the Claude Code plugin contract, and describing it as
one would be the overclaim this repository forbids. `claude plugin validate --strict` is that authority
and runs at the supervised checkpoints rather than in CI, because CI here installs nothing and a recipe
declaring the `claude` binary would exit `2` on every run. The two are not nested in either direction:
on the day both were adopted, this lint passed a `plugin.json` the platform refused, and the platform
passed three separately-broken skills this lint fails. Recorded as
[`../.portulan/memory/a-checkers-coverage-is-measured-not-named.md`](../.portulan/memory/a-checkers-coverage-is-measured-not-named.md).

Deliberately **not** checked: the platform's reserved-marketplace-name list, which the platform re-checks
on every load and has already changed — a copy frozen here would drift into a false verdict in one
direction or the other.

## Why it lives here rather than in the workspace

`plugin-lint` is the harder case of the two, and it is placed here on the same rule with a caveat worth
stating: it validates *any* plugin root, so it is product surface in shape — but the invariants it
enforces are this repository's own, and a customer's plugin may reasonably differ. Treat it as a tool
this repository owns and others may run, not as a contract shipped to them.

`doctor` validates *any* workspace, so it is product surface rather than customer-zero tooling —
[`../.portulan/verify/`](../.portulan/verify/) holds this repository's own recipes and
[`../.portulan/tools/`](../.portulan/tools/) holds operator tooling. Putting a universal validator in
either would have made it look local to the one workspace it happened to be written beside.

Zero-dependency ESM on Node rather than TypeScript — and as of **2026-07-31 that is a ruling rather
than a "for now"**. The maintainer settled it at milestone 7's session-open, against
[`../.portulan/identity.md`](../.portulan/identity.md)'s older *TypeScript on Node* line, on exactly
the ground this paragraph already gave: a build step would mean this repository could no longer be
checked by cloning it. So the CLI does **not** bring a build with it. The `package.json` milestone 7
adds declares no dependencies and exists to carry the `bin`; `npm install` fetches nothing, and every
tool here still runs as `node cli/<tool>.mjs` from a fresh clone.

_(This paragraph previously closed with "the CLI at milestone 7 absorbs this file and takes the build
with it" — a sentence whose "this file" had no clear referent and which predicted the opposite of
what was ruled. Replaced rather than annotated, since nothing in it survived.)_

## Environment the compiled runners read

`cli/gate.mjs` and `cli/stop-gate.mjs` are invoked by the hooks `compile` emits, and they are **told**
where the workspace is rather than deriving it from where they sit — which is what lets them ship in the
package at all (before milestone 7 they resolved `HERE/..`, which is true in exactly one layout).

| variable | what it does | when unset |
|---|---|---|
| `CLAUDE_PROJECT_DIR` | the repository the policy governs; the host sets it, and the emitted hook interpolates it | falls back to the process's working directory, which is where a hook runs |
| `PORTULAN_WORKSPACE` | the workspace directory's **name** inside that repository | `.portulan` |

**Two honest limits.** `PORTULAN_WORKSPACE` is read and nothing sets it — it exists so a workspace under
another name is not unreachable, not because anything ships that way. And the two runners **differ** when
no workspace is found: `stop-gate.mjs` blocks loudly, because a Stop-gate that cannot read the workspace
has nothing beneath it; `gate.mjs` steps aside silently, because a `PreToolUse` hook that cannot read the
policy must not block every tool call, and the compiled permission rules still hold under it. That
asymmetry is deliberate and is the kind that should be written down rather than discovered.

