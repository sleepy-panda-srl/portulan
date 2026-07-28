# cli/

Eventually the `npx` CLI that wraps the file-based mechanics for hosts beyond Claude Code:
`init` (interview + codebase scan → drafted workspace) · `doctor` · `compile` (gates/verify → host
enforcement) · `vendor` (self-contained `AGENTS.md` + `.portulan/`) · `index` · `upgrade`. That
packaging is **milestone 7**.

Two of those exist now — `doctor` because milestone 2 needed it, `compile` because milestone 4 did —
plus one tool that is not on that list at all, because milestone 3 needed it.

## What is here today

| File | What it is |
|---|---|
| [`doctor.mjs`](doctor.mjs) | The Workspace Definition validator. Zero dependencies, no install step, run from the repository root. |
| [`doctor.test.mjs`](doctor.test.mjs) | Its test suite, on node's own runner. Written before the validator. |
| [`plugin-lint.mjs`](plugin-lint.mjs) | The packaging validator: the plugin and marketplace manifests, the skills they declare, and the agents at `./agents/` that nothing declares. |
| [`plugin-lint.test.mjs`](plugin-lint.test.mjs) | Its test suite, likewise written first. |
| [`compile.mjs`](compile.mjs) | The enforcement compiler: a workspace's [`../.portulan/gates.json`](../.portulan/gates.json) becomes host enforcement. One backend today — Claude Code `permissions` + `hooks` — and the vocabulary it reads stays the workspace's, so a second backend translates the same policy instead of forcing it to be rewritten. Also the one definition of what an action pattern matches and what an autonomy **mode** means, imported by the runtime gate so the two can never disagree. |
| [`compile.test.mjs`](compile.test.mjs) | Its test suite, likewise written first. Emission fidelity only — nothing in here can establish that a host *honours* what the compiler emits, which is a fact about a running host. |
| [`mode.mjs`](mode.mjs) | Reads, or **tightens**, the current session's autonomy mode. Touches no tracked file and no other session; it refuses to loosen, because the compiled permission rules were emitted at the workspace default. |
| [`stop-gate.test.mjs`](stop-gate.test.mjs) | The exception to "written first": it covers the Stop-gate runner ([`../.portulan/compile/stop.mjs`](../.portulan/compile/stop.mjs)), and it exists because a supervisor found a fail-open and a forever-block in a runner nothing tested at all. Its cap arithmetic and date handling — deliberately not its I/O. |
| [`fixtures/`](fixtures/) | Known-bad manifests, and a workspace whose repo card has drifted from its tree. |

```
node cli/doctor.mjs <workspace-dir> [<workspace-dir> ...]
node cli/plugin-lint.mjs <plugin-root> [<plugin-root> ...]
node cli/compile.mjs [--workspace <dir>] [--check]
node cli/mode.mjs [autonomous|ship-gate|strict|--clear]
```

The two validators: exit `0` when every workspace or plugin root validates · `1` when at least one does
not · `2` could not run. `compile`: exit `0` when it wrote, or agreed under `--check` · `1` only under
`--check`, when the artifact is missing or has drifted · `2` could not run — writing never returns `1`,
because a run that rewrites the artifact has nothing to disagree with. Both workspaces this repository
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
  ([`../.portulan/compile/stop.mjs`](../.portulan/compile/stop.mjs), milestone 4), and it runs the
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

Zero-dependency ESM on Node rather than TypeScript, deliberately and for now: a build step would mean
this repository could no longer be checked by cloning it, which is the property
[`../.portulan/identity.md`](../.portulan/identity.md) is protecting when it says nothing here is
installed before it runs. The CLI at milestone 7 absorbs this file and takes the build with it.
