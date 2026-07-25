# cli/

Eventually the `npx` CLI that wraps the file-based mechanics for hosts beyond Claude Code:
`init` (interview + codebase scan → drafted workspace) · `doctor` · `compile` (gates/verify → host
enforcement) · `vendor` (self-contained `AGENTS.md` + `.portulan/`) · `index` · `upgrade`. That
packaging is **milestone 7**.

One of those exists now, because milestone 2 needed it.

## What is here today

| File | What it is |
|---|---|
| [`doctor.mjs`](doctor.mjs) | The Workspace Definition validator. Zero dependencies, no install step, run from the repository root. |
| [`doctor.test.mjs`](doctor.test.mjs) | Its test suite, on node's own runner. Written before the validator. |
| [`fixtures/`](fixtures/) | Known-bad manifests, and a workspace whose repo card has drifted from its tree. |

```
node cli/doctor.mjs <workspace-dir> [<workspace-dir> ...]
```

Exit `0` every workspace validates · `1` at least one does not · `2` could not run. Both workspaces this
repository owns are validated on every pull request, because
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

## What it does not do, and will not pretend to

- **It never runs a verify recipe.** It reads them. Executing them is the Stop-gate runner, milestone 4 —
  which is also why a recipe needing a tool it did not declare passes.
- **It never dereferences a link.** "Resolvable" means well-formed. A gate that needs the network fails
  for reasons unrelated to the change under test.
- **It never judges truth.** A fabricated sealed stamp passes exactly as a real one does; a path that
  resolves says nothing about whether the document at the end of it is still accurate.
- **It does not score agent-legibility.** The `affordances` slot is the input such an audit would read.
  The audit is not built, and calling this a score would be an overclaim.
- **It cannot see live settings.** The gate-map lint compares a claimed status-check name against job ids
  in the tree. Whether branch protection actually requires that check, and which app it is pinned to, are
  API facts `doctor` does not fetch.
- **It has no per-host capability report.** That belongs with the enforcement backends, milestone 4.

## Why it lives here rather than in the workspace

`doctor` validates *any* workspace, so it is product surface rather than customer-zero tooling —
[`../.portulan/verify/`](../.portulan/verify/) holds this repository's own recipes and
[`../.portulan/tools/`](../.portulan/tools/) holds operator tooling. Putting a universal validator in
either would have made it look local to the one workspace it happened to be written beside.

Zero-dependency ESM on Node rather than TypeScript, deliberately and for now: a build step would mean
this repository could no longer be checked by cloning it, which is the property
[`../.portulan/identity.md`](../.portulan/identity.md) is protecting when it says nothing here is
installed before it runs. The CLI at milestone 7 absorbs this file and takes the build with it.
