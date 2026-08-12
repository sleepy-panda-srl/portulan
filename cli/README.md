# cli/

The `npx` CLI that wraps the file-based mechanics for hosts beyond Claude Code:
`init` (interview + codebase scan → drafted workspace) · `doctor` · `compile` (gates/verify → host
enforcement) · `vendor` (materialise a workspace where it is needed — into a host, and the reverse) ·
`index` · `upgrade` · `new` · `feedback`. That packaging is **milestone 7**, and as of session 0 the
entry point exists:
[`portulan.mjs`](portulan.mjs), reached as `portulan <subcommand>` through the `bin` in the
repository's `package.json`.

**Seven of the eight dispatch; one exits 2.** `doctor`, `compile` and `index` exist because milestones
2, 4 and 5 needed them; `init` was built at milestone 7 session 1, `new` at session 2, `vendor` at
session 3, and `feedback` at session 6. The entry point calls each one's exported `run` and returns the
code unchanged. `upgrade` is named in `docs/vision.md`, is not built, and says so: it exits **2 — could
not run**, naming where it arrives, because a stub exiting 0 would be a fail-open where a user is most
likely to trust silence.

**Why eight.** `docs/vision.md` names all eight and is human-owned. It named six until 2026-08-03:
`new` and `feedback` reached the CLI first, licensed by row 7 naming them in its own ratified text, and
the maintainer then folded both into the constitution — so the two-carrier state that licence created
lasted one pull request. Worth one sentence rather than none, because the *shape* recurs: a subcommand
may be licensed by the row before the constitution catches up, and while that holds, the tool has to say
which document names it.

Beside those eight sit **five** runnable tools that are on none of the lists — `plugin-lint`,
`librarian`, `control-chars`, `discover` and `rule-carriers` — because milestone 3, milestone 5, issue
[#68](https://github.com/sleepy-panda-works/portulan/issues/68), milestone 7's plugin-cache discovery
and [`../.portulan/verify/rule-carriers.sh`](../.portulan/verify/rule-carriers.sh) needed them.
**Five** more files in this directory are neither subcommands nor tools: `gate` and `stop-gate` are the
**compiled-hook runners**, invoked by generated host configuration rather than by a person, and
`recipe-set`, `skills-set` and `manifest` are modules other tools import — the first two runnable in
their own right, each printing the set it carries.

_(Two counts moved at milestone 7 session 8 and both were wrong before it. The runnable tools read
**four** while `rule-carriers` had been one since 2026-08-10 and appeared in this file **zero** times;
the line below it read **two** while naming four. Corrected in the change that added a sibling rather
than left to the next reader — the rule this repository applies to
[`../.portulan/identity.md`](../.portulan/identity.md)'s rosters, and the one a first draft of this very
parenthetical broke by invoking it while leaving `rule-carriers` uncounted. Found at the pre-commit
checkpoint. A count is a claim, which is [#187](https://github.com/sleepy-panda-works/portulan/issues/187)'s
subject; the missing table rows are [#203](https://github.com/sleepy-panda-works/portulan/issues/203)'s.)_

Being off the list is a fact about `docs/vision.md`, which names these eight subcommands and is
human-owned: whether any of the five ever joins them is the maintainer's call and not an implementer's,
so none is described here as *coming to the CLI* — and none is wired behind the entry point, which is
the same rule expressed in code rather than in a sentence.

**This paragraph is the one carrier of that roster.** It said *three* and named a different three from
the two other places that also named one — `portulan.mjs` listed `plugin-lint`, `librarian` and
`discover`; the root `README.md` listed `plugin-lint`, `librarian` and `control-chars`; four were on
disk. One rule with three carriers is obeyed at the narrowest, and the repair is
[`0020`](../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s where the rule
cannot be a function: state it once, and let the others cite. Both now cite this file.

The table below would be the check on it, and today it is not quite: **nine files in this directory
have no row** — `gate`, `stop-gate`, `recipe-set` and its two suites, `collisions.test`, `gh-bot.test`,
and `rule-carriers` with its suite. It was **eleven** when milestone 7 session 6 measured it; that session
added rows for the four it introduced and left the rest to
[#203](https://github.com/sleepy-panda-works/portulan/issues/203) rather than growing an unscheduled
sweep inside a feature change; session 8 added rows for the three it introduced and did the same.
A table headed *What is here today* that is nine files short is still a claim its own directory
falsifies, which is why the issue exists and why the number is stated here rather than left for a
reader to count.

_(This number was wrong twice in one session, and the second time is the instructive one. It read
**seven**, omitting `rule-carriers` and its suite. A first correction said **eight** and claimed to have
been "re-derived by walking `cli/*.mjs` against the table" — but the walk matched the filename **anywhere
in the table**, so `stop-gate.mjs` counted as having a row on the strength of a link inside
`stop-gate.test.mjs`'s description. **A row is an anchor at the start of a line**, and re-derived that
way the answer is nine. The method was named accurately and executed differently, which is the failure
this paragraph is otherwise about. Found at the pre-commit re-check.)_

## What is here today

| File | What it is |
|---|---|
| [`portulan.mjs`](portulan.mjs) | **The entry point** the published package exposes as `portulan`, added at milestone 7. It dispatches and adds nothing: each subcommand's module is imported **on demand** — so `portulan --help` does not pay for `doctor`, and a tool that fails to parse takes down only its own subcommand — and the tool's exit code is returned **unchanged**, because re-mapping it here would put a second opinion about a workspace between the tool and its user. Verified byte-identical to direct invocation for the three built subcommands it wrapped when it landed; `init` joined them at session 1 and is exercised through the entry point as well as directly. |
| [`portulan.test.mjs`](portulan.test.mjs) | Its test suite, written first. **Dispatch only**: which module is reached, that arguments arrive unchanged, that exit codes come back unchanged, and that every refusal exits `2`. It injects the loader rather than shelling out, because re-asserting what `doctor` or `index` already prove would make this file a second carrier of it — with one deliberate exception, a case that imports the real modules to check they still export `run`, since that is the single assumption the entry point rests on. **Two cases spawn the real binary** — `init --help` and `feedback --help` — because injection can show that the dispatcher *would* reach a module and never that the module is reachable. The second of the two earned its place the hour it was written: it caught an import cycle that made `portulan feedback` exit 13 printing nothing, invisible to every injected case. |
| [`manifest.mjs`](manifest.mjs) | The two facts read out of `package.json` — the published `version`, and the repository derived from `bugs.url` that `feedback` files into. It exists as its own file rather than living in the entry point because a subcommand importing the entry point back is a **cycle**, and that cycle hung the command line on an unsettled top-level await. It imports nothing of ours, which is the property that makes it safe for anything here to import. |
| [`init.mjs`](init.mjs) | **The onboarding subcommand**, added at milestone 7 session 1: it drafts a workspace for a repository that has none. It **asks** where that workspace resides — in the repository, or in a workspace that names it — and has **no default**, because a repository is governed by exactly one workspace and that answer is the one that cannot be guessed. It refuses ahead of the first byte written: never over an existing residence, and never a name, governor or pack id a validator would misread. What it emits is a **draft** — including a verify recipe that exits 2 until the adopting team declares what green means for them. |
| [`init.test.mjs`](init.test.mjs) | Its test suite, written first. Its last group is the one that matters: it runs the real `doctor` against real drafted directories, in both residences, because a workspace nothing validated is a workspace nobody can trust. That group is what caught a drafted gate policy that parsed cleanly and compiled to a floor no rule reached. |
| [`doctor.mjs`](doctor.mjs) | The Workspace Definition validator. Zero dependencies, no install step, run from the repository root. Two repeatable roots, **named by default and never discovered unasked**: `--pack-root` is where declared packs are looked up, and `--repo-root` (2.7) is where the repositories a workspace's cards NAME are checked out, so the residence ruling's cross-repository refusal has somewhere to look. Without a `--repo-root` that check reports that it did not run rather than passing quietly. **One thing IS discovered, as of milestone 7 — a pointer's `governed_by`**, through [`discover.mjs`](discover.mjs); the row said *this tool does no discovery* until then. It is **reported and never graded**, so no host's install state moves this tool's verdict, and a pack root gained `auto` in the same milestone — `--pack-root auto` reads that record too, only when asked, and `./auto` still names a directory. `--repo-root` stays named-only: a repository checkout is not something a plugin record lists. |
| [`doctor.test.mjs`](doctor.test.mjs) | Its test suite, on node's own runner. Written before the validator. |
| [`discover.mjs`](discover.mjs) | **Host plugin-cache discovery**, added at milestone 7: it reads `<config>/plugins/installed_plugins.json` and dereferences a pointer's `governed_by` to the directory the governing workspace was installed to. Four verdicts — `resolved`, `not-installed`, `ambiguous` (two or more answering to one name: **refused and both named**, never ranked) and `could-not-look` — because a resolver with two answers spends *could not look* as *not installed*. It matches on the governing **manifest's** `name`, constrained by the pointer's `feed` where it declares one, and looks in a **named pair** of locations inside a payload rather than walking it. Nothing is fetched: the record is read from disk and no path here touches the network. Also runnable — `node cli/discover.mjs [--json] <workspace-dir>` — which is the seam [`../plugin/skills/portulan/SKILL.md`](../plugin/skills/portulan/SKILL.md) reads at the boot, and **deliberately not a ninth `portulan` subcommand**: `docs/vision.md` names eight and is human-owned, so this sits beside `plugin-lint` and `librarian` and joins that list only if the maintainer says so. |
| [`discover.test.mjs`](discover.test.mjs) | Its test suite. Every case builds a whole fake host in a temp directory and points `CLAUDE_CONFIG_DIR` at it, because a suite that consulted the real machine would be green on the author's laptop and meaningless anywhere else. |
| [`plugin-lint.mjs`](plugin-lint.mjs) | The packaging validator: the plugin and marketplace manifests, the skills they declare, and the agents at `./agents/` that nothing declares. Since milestone 7 session 7 it also holds **`core/personas/` and `agents/` to each other** — both directions fail, because a persona this bundle ships and does not bind is doctrine the host never registers, and a binding whose persona is gone registers a role with no charter. It is the one location a host loads agents from, exported here as `AGENT_DIR` and imported by `doctor` rather than spelled twice. |
| [`plugin-lint.test.mjs`](plugin-lint.test.mjs) | Its test suite, likewise written first. |
| [`skills-set.mjs`](skills-set.mjs) | **The registrable set**, added at milestone 7 session 8: the one carrier of *what a plugin manifest must declare so a composed pack's skills register*. It reads each composed pack's `contributes.skills` and derives the paths, relativised to the plugin root — `--check` reports drift (1) and `--write` derives the key rather than leaving it hand-typed. Row 7 clause (b)'s adopter half, [#184](https://github.com/sleepy-panda-works/portulan/issues/184): until it landed, registration was a property of `.claude-plugin/plugin.json` **alone**, so a composed pack's skill was invocable by coincidence of a path someone typed. It holds `HOST_SKILL_DEPTH` — the platform fact the derivation rests on, measured in `plugin-lint` and moved here when that file became a consumer. **Deliberately not a ninth `portulan` subcommand**, on `discover`'s precedent above. |
| [`skills-set.test.mjs`](skills-set.test.mjs) | Its test suite, written first. Every refusal has a sibling in `recipe-set.test.mjs`, because those were found by review rather than by design and a second carrier of the same shape should not have to rediscover them. |
| [`skills-set.live.test.mjs`](skills-set.live.test.mjs) | The same derivation against **this** repository rather than against fixtures — the guard for *a harness you write to check your own change inherits your change's blind spot*, which this project has now measured seven times, two of them in the session that added this file. Its load-bearing assertion is that the derived set equals what `.claude-plugin/plugin.json` already declares. |
| [`new.mjs`](new.mjs) | **The authoring subcommand**, added at milestone 7 session 2: it scaffolds a skill · persona · pack · workspace · gate-policy · repo-card from a core template **into a layer you own, never into `core/`**. The refusal is resolution-based rather than pattern-based, because every interesting escape — `packs/../core`, a symlinked destination — parses fine and only fails once resolved. Two codes, `0` wrote and `2` could not run: it renders no verdict, so it has no red. |
| [`new.test.mjs`](new.test.mjs) | Its test suite, written first. It establishes *never into `core/`* against the filesystem rather than against an argument check, and runs the real `doctor` and `plugin-lint` over what was scaffolded — a scaffold nothing validates is one nobody can trust. |
| [`vendor.mjs`](vendor.mjs) | **Materialises a workspace where it is needed**, added at milestone 7 session 3 when the maintainer widened the constitution's gloss to cover both directions. `--host` writes a self-contained `AGENTS.md` — core's kernel inlined, the workspace's slots named, packs named-not-composed — beside a copied `.portulan/`, for a host that cannot install the plugin. `--switch` changes residence, feed-side ↔ in-repo, under proposal [`0017`](../.portulan/proposals/0017-one-repository-one-governing-workspace.md): materialise at the new residence, leave a pointer or nothing at the old, `doctor` green at **both** ends before the old one is retired. Every handled failure leaves exactly one governing workspace; the residence is **never inferred** from a path, which is `init`'s rule for `init`'s reason. |
| [`vendor.test.mjs`](vendor.test.mjs) | Its test suite, written first. The group that matters *forces* a failure after each named write step, because the property this tool exists to protect is what a failure partway leaves on disk — an ordering nothing can interrupt is an ordering nobody has checked. Every end state is graded by the real `doctor`, never by a second opinion about what valid means. |
| [`feedback.mjs`](feedback.mjs) | **The inbound half**, added at milestone 7 session 6: it files an issue from a report the user previewed, seam-scanned before it leaves the machine, under the Gated tier. Three verbs — `draft` writes a report into the workspace's `feedback/` directory, `preview` prints the exact bytes, `send --approve` files them through the user's own `gh` login. The payload is assembled from a **closed list** rather than filtered, so nothing here reads a workspace name, a repo card, a gate map, memory, a remote or a path. It ships **no seam terms** — the list is the adopter's and is looked for at `--seam-terms`, `$PORTULAN_SEAM_TERMS`, then `<workspace>/seam-terms.txt`; a hit refuses the send with **1**, a named list that cannot be read refuses it with **2**, and no list at all is *stated in the sentence the user approves* rather than passed over. Approval is per send and is never inherited from a draft or a preview. |
| [`feedback.test.mjs`](feedback.test.mjs) | Its test suite, written first, against `.portulan/tasks/0012-a-feedback-pipe-points-out-of-the-seam.md`'s *Done when* list. Nothing here reaches the network: `gh` arrives injected. The one property injection cannot prove — that the approved bytes are the sent bytes — is not proven by comparison but held by construction, and the suite asserts the construction: the previewed body **is** `payload()`'s return value, not a second rendering that agrees with it today. |
| [`feedback.live.test.mjs`](feedback.live.test.mjs) | The rail on the pair that cannot be collapsed. `package.json`'s `files` does not ship `.github/ISSUE_TEMPLATE/`, so the sender must carry the forms' field ids, labels, required flags, dropdown options and acknowledgement texts — one fact, two carriers, and the repair is `0020`'s: one carrier plus a rail. This reads the real forms and fails when the two disagree. Its own instrument is guarded first: if the reader stops understanding a form and returns nothing, the test goes **red** rather than vacuously green. |
| [`compile.mjs`](compile.mjs) | The enforcement compiler: a workspace's gate policy becomes host enforcement. Two backends — Claude Code `permissions` + `hooks`, and a GitHub repository ruleset for the platform floor — and the vocabulary it reads stays the workspace's, so a third backend translates the same policy instead of forcing it to be rewritten. `--workspace` takes a repository root **or the workspace directory itself**, which is how a feed-side workspace is reachable at all: it keyed on `.portulan` until milestone 7 session 3, when running the parity demonstration found it exiting 2 on the feed-side end of a switch. |
| [`compile.test.mjs`](compile.test.mjs) | Its test suite, likewise written first. Emission fidelity only — nothing in here can establish that a host *honours* what the compiler emits, which is a fact about a running host. |
| [`index.mjs`](index.mjs) | The index generator, over **two** series since Workspace Definition 2.5: the memory store, which is size-budgeted so a breach is a red, and the handoff series, which is not — an append-only series has no consolidation to offer, so every remedy a budget could ask for is already barred. Every field on every line is derived from what it points at, so neither file has a hand-maintained half; the *carriers* differ per series and on evidence, a record's title being its filename and a handoff's its H1. It writes an over-budget index rather than refusing to — the remedy is consolidation, and consolidating needs the artifact to consolidate from. |
| [`index.test.mjs`](index.test.mjs) | Its test suite, written first. Derivation, drift and cost only — nothing in here can establish that the index is any good at *recall*, which is an eval question. |
| [`stop-gate.test.mjs`](stop-gate.test.mjs) | The exception to "written first": it covers the Stop-gate runner ([`stop-gate.mjs`](stop-gate.mjs)), and it exists because a supervisor found a fail-open and a forever-block in a runner nothing tested at all. Its cap arithmetic and date handling — deliberately not its I/O. |
| [`librarian.mjs`](librarian.mjs) | The scheduled librarian's pass: reindex over both series, record age from git, the sealed-stamp re-validation nag, proposal nagging, demotion drafts, **mining** — incidents nothing in the curated layer points back at, and paths pull-request reviewers keep leaving findings on — and **consolidation**, read as budget distance plus the records citing one incident. The one tool here that reads **history** — `doctor` reads the tree and says so — which is why it belongs to a scheduled job rather than to a verify recipe: a check that reads history is a false-red generator in a shallow checkout. It renders no verdict, so it has no exit 1, and it **writes nothing itself**: the command writes, and only after the pass's own handoff is on disk, because that handoff is a member of the series one of the indexes covers. |
| [`control-chars.mjs`](control-chars.mjs) | **The rail on bytes a reader cannot see**, added for [#68](https://github.com/sleepy-panda-works/portulan/issues/68): no tracked file may carry a byte in the C0 range other than TAB and LF, nor DEL. It reads a `Buffer` and **never decodes**, because decoding invalid UTF-8 yields U+FFFD — which both hides bytes and invents a character that was not there. That rule holds end to end and cost three review rounds to make true: the file contents, the file list on stdin, and a symlink's target all arrive as bytes, and a path is kept only if it round-trips through UTF-8. A binary asset is exempt **by name**, never by a content test: every binary sniff in use is keyed on NUL, so a sniff would have skipped the one file this exists to catch. The declaration is audited three ways — stale, never-read, or dead — each exit `2`. |
| [`control-chars.test.mjs`](control-chars.test.mjs) | Its test suite, written first. Its fixtures build their forbidden bytes with `String.fromCharCode` rather than carrying them literally — a suite that carried one would be a tracked file the check must go red on, and a rail red on its own tests is a rail somebody switches off. Its last group scans this repository's own tracked set. |
| [`librarian.test.mjs`](librarian.test.mjs) | Its test suite, written first, on real scratch git repositories rather than an injected clock — a fake history proves nothing about the one call this tool exists to make. |
| [`fixtures/`](fixtures/) | Known-bad manifests, and a workspace whose repo card has drifted from its tree. |

```
portulan <subcommand> [options]          # or: node cli/portulan.mjs <subcommand> [options]

node cli/init.mjs --residence <in-repo|pointer> [options] <repository-dir>
node cli/new.mjs <kind> <name> [--into <dir>] [options]
node cli/vendor.mjs <workspace-dir> --into <dir> --residence <in-repo|feed-side> (--host <id> | --switch)
node cli/doctor.mjs <workspace-dir> [<workspace-dir> ...]
node cli/plugin-lint.mjs [--payload] <plugin-root> [<plugin-root> ...]
node cli/compile.mjs [--workspace <repository-dir | workspace-dir>] [--check]
node cli/index.mjs [--check] <workspace-dir> [<workspace-dir> ...]
node cli/librarian.mjs [--as-of YYYY-MM-DD] [--write] [--log <path>] [--reviews <path>] <workspace-dir> [...]
```

The two validators: exit `0` when every workspace or plugin root validates · `1` when at least one does
not · `2` could not run. `compile`: exit `0` when it wrote, or agreed under `--check` · `1` only under
`--check`, when the artifact is missing or has drifted · `2` could not run — writing never returns `1`,
because a run that rewrites the artifact has nothing to disagree with. `init` and `new` have only **two** codes —
`0` it wrote · `2` it wrote nothing — and the missing `1` is the point: they render no verdict about
anybody's workspace, so they have no red to report. _(The second code read "it could not run" until
milestone 7 session 7, when `init`'s interview introduced a way to write nothing that is not a failure
at all: a human declining at the confirmation, or ending the input. The code is unchanged and the gloss
now covers every way of reaching it — widening the sentence rather than minting a third code, since `0`
must keep meaning **it wrote** for anything chaining on it. `new`'s two are unaffected.)_ `vendor` **does** have a `1`, and the asymmetry is
worth a sentence: it runs the real validator at both ends of a switch and reports its verdict, so
collapsing *the workspace I materialised is invalid* into *I could not run* would leave a caller unable
to tell a bad workspace from a missing flag. `index` uses the same three
codes and differs from `compile` in one way worth knowing before reading it: **writing can still return
`1`**, because a budget breach is a verdict about the store rather than about the artifact, and the
artifact is written anyway so there is something to consolidate from. Both workspaces this repository
owns are validated on every pull request, because
[`../.portulan/workspace.json`](../.portulan/workspace.json) declares
[`../.portulan/verify/doctor.sh`](../.portulan/verify/doctor.sh) as a verify recipe and CI runs every
recipe the manifest **yields** — the workspace's own, plus those the packs it composes contribute.

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
- **It scores agent legibility, and the score moves no exit code.** **Seven** dimensions, every one of them
  optional in the Workspace Definition so it can genuinely be absent, printed as one line naming what
  was missed. *Whether the workspace declares verification at all* was an eighth until a checkpoint
  measured it: the schema requires `verify` of every workspace the score can reach, so it was a
  constant dressed as a measurement. The `affordances` slot is the named input and not the only one — six manifest keys are
  read beside it, because a score confined to the slot could not tell two workspaces apart. What it
  cannot do is judge the prose: the limits dimension is a **form** check over a named heading table, so
  a section with an empty body passes it. _(This bullet said the audit was not built, which was true
  from milestone 2 until milestone 7 session 7.)_
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

