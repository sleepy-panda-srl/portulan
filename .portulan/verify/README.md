# Verify recipes

> The executable half of "done". Core defines the hierarchy — *it compiles < the tests pass < the
> behaviour was exercised* — and the Stop-gate contract that makes climbing it non-optional
> ([`../../core/operating/verification.md`](../../core/operating/verification.md)). A workspace supplies
> the recipes themselves, because what "green" means is a property of the repository.

## The recipes

The recipes in this directory are declared in [`../workspace.json`](../workspace.json), and since
milestone 7's composition amendment the **runnable** set is larger than that: it is what
[`../../cli/recipe-set.mjs`](../../cli/recipe-set.mjs) yields — these, plus the ones this workspace's
composed packs contribute, namespaced by pack. This prints the live set:

```
node cli/recipe-set.mjs --workspace .portulan --repo-root .
```

_(This paragraph carried the counts — "nine declared, ten in the runnable set" — and they went stale the
moment a tenth was declared, in the very change that added a rail against stale carriers. The figures are
**gone rather than corrected**, which is this directory's own repair: `#77`'s count was removed for the
same reason, because the command cannot be wrong and a hand-maintained number always can. The roster
below stays, because it is there to copy from rather than to count.)_

The manifest is also where the **default** is named — [`docs.sh`](docs.sh), the one the Stop-gate now
actually runs when nothing more specific applies.

The composed one is `tools/github:actions-pinned`, contributed by the
[`tools/github`](../../packs/tools/github/README.md) pack this workspace composes. It is **not** in this
directory and is not declared in `workspace.json`: a composed recipe lives in its pack, is namespaced by
it, and reaches the runnable set through [`../../cli/recipe-set.mjs`](../../cli/recipe-set.mjs). The
default can never be one of them — `verify.default` is a bare slug and a composed id is not — which is
row 7's contract holding by construction rather than by a check. To see the set as CI sees it:

```
node cli/recipe-set.mjs --workspace .portulan --repo-root .
```

Run any of the recipes declared here from anywhere in the tree:

```
./.portulan/verify/docs.sh
./.portulan/verify/json.sh
./.portulan/verify/doctor.sh
./.portulan/verify/tests.sh
./.portulan/verify/plugin.sh
./.portulan/verify/compile.sh
./.portulan/verify/workflow-filters.sh
./.portulan/verify/index.sh
./.portulan/verify/control-chars.sh
./.portulan/verify/rule-carriers.sh
./.portulan/verify/pack-version.sh
./.portulan/verify/eval-bundle.sh
./.portulan/verify/pack-identity.sh
./.portulan/verify/version-carriers.sh
./.portulan/verify/goldens.sh
```

_(**It happened again, and the second time was worse.** The block listed **thirteen** while the manifest
declared **fourteen** — `version-carriers.sh` had been in the table below and not here since it landed —
and milestone 8 session 0 arrived to add a fifteenth. Both were swept in that change rather than one,
because the class sets a fix's scope and not the task's literal boundary. That this list drifts every
time somebody adds a recipe, twice now in the same shape, is the argument for deriving it:
`node cli/recipe-set.mjs --workspace .portulan --repo-root . --pack-root packs` prints it, and this
block is a hand-maintained copy. Filed as the standing case for a rail, not repaired here.)_

_(The block above listed ten while the manifest declared eleven — `pack-version.sh` was in the table
below and not here. Swept in the change that added `eval-bundle.sh` rather than left for the next
reader: adding a twelfth line while walking past the missing eleventh is the class
[`../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)
names.)_

| Recipe | Covers | Needs |
|---|---|---|
| [`docs.sh`](docs.sh) — default | links · kernel budget · repo map · record correspondence · the proposal series · the milestone table | `bash`, `git`, POSIX text utilities |
| [`json.sh`](json.sh) | every tracked `.json` file parses | the above, plus `node` |
| [`doctor.sh`](doctor.sh) | both workspaces validate: schema, paths, cross-references, claims against the tree, provenance — plus the memory store's growth report (count, size, records stating no retirement condition; notes, never failures) | `bash`, `git`, `node` |
| [`tests.sh`](tests.sh) | every `*.test.mjs` under [`../../cli/`](../../cli/) passes — counted by `find` first, then run by a recursive glob over that same set | `bash`, `node` |
| [`plugin.sh`](plugin.sh) | the packaging: both manifests parse and agree, component paths resolve, declared skills and agents are real | `bash`, `git`, `node` |
| [`compile.sh`](compile.sh) | both compiled artifacts — [`../../.claude/settings.json`](../../.claude/settings.json) and [`../compile/github-ruleset.json`](../compile/github-ruleset.json) — are exactly what [`../gates.json`](../gates.json) compiles to | `bash`, `node` |
| [`workflow-filters.sh`](workflow-filters.sh) | every jq **and awk** program the workflows run, lifted out of the parsed `run:` scalars and executed against null-bearing and real-body fixtures — exact stdout, exact exit status | `awk`, `bash`, `jq`, `node` |
| [`index.sh`](index.sh) | every generated index a workspace declares — the memory store's, and since 2.5 the handoff series' — is exactly what its source renders, and neither the store index, nor the store, nor any single record in it is over the budget its manifest declares | `bash`, `git`, `node` |
| [`control-chars.sh`](control-chars.sh) | no tracked file carries a byte in the C0 range other than TAB and LF, nor DEL — scanned as bytes, because the one tool that would have shown the last one is the tool the byte silences | `bash`, `git`, `node` |
| [`rule-carriers.sh`](rule-carriers.sh) | a rule an incident reduced to **one** carrier stays reduced — a registered spelling appears only in its carrier or beside a citation of it. Covers **only registered rules**, which is a ratchet over what incidents have taught it and never coverage of doctrine | `bash`, `git`, `node` |
| [`pack-version.sh`](pack-version.sh) | a pack whose `contributes` differs from the **merge-base** also moved its `portulan.version` — [#265](https://github.com/sleepy-panda-srl/portulan/issues/265), arm 3, and a **prose-only** edit to a fragment's `reason` counts. **The only recipe here that reads a *diff* rather than the tree**, so it refuses at **2** where the base ref or merge-base is unreachable, and [`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml) sets `fetch-depth: 0` for it | `bash`, `git`, `node` |
| [`pack-identity.sh`](pack-identity.sh) | every file `npm pack` would emit is byte-identical to its **staged** blob (`git show :<path>`), and every one is tracked at all — the rail [#149](https://github.com/sleepy-panda-srl/portulan/issues/149) asked for, built after the first publish measured the property by hand. Compares against the **tree, not the registry**: that form needs the network and a published version, so it could not run before a first publish or offline. Reads the **index** rather than `HEAD` so it is green BEFORE a commit, as [`../dod.md`](../dod.md) requires; in CI the two coincide. Refuses at **2** when `npm` is unusable — npm not running is not a finding about the bytes | `bash`, `git`, `node`, `npm` |
| [`version-carriers.sh`](version-carriers.sh) | every current-version claim in **live prose** equals `package.json`'s version, and every file that must carry one still does — the rail for a sentence this repository got wrong **twice**, with the sibling pairing recorded both times. `README.md` ships inside the npm package and npm **freezes a README per version**, so a wrong claim that reaches a publish costs a release to fix. The **record layer is excluded by path**, deliberately: dated records quote retired versions, and a rail forbidding that would forbid the record. Refuses at **2** when `git` or `package.json` cannot be read | `bash`, `git`, `node` |
| [`goldens.sh`](goldens.sh) | every gate in the policy this workspace **yields** carries adversarial fixtures in [`../../evals/goldens/gates/`](../../evals/goldens/gates/), and each case still answers as recorded — graded through the compiler's own exported `matchesRule`, the function the hook calls at tool time, never a re-implementation. Milestone 8 clause (a). **Two rails:** a rule that compiles to a matcher and carries no fixture is red, so coverage is measured rather than named; and a `documented-hole` case that starts being CAUGHT is red too, so a hole record cannot go stale in either direction. **A case is data and is never executed** — the corpus holds `git push --force` and constitution-write spellings by design, and the suite asserts the runner imports no process-spawning API. **What it does not establish is adequacy:** it is a presence floor, one trivial fixture per rule satisfies it, and the runner prints that limit on every green. Rules with `action.none` are exempt and **named on every run**, because writing the next gate `none`-shaped is the way to dodge this rail. Every case also records **which branch of `matchesRule` it exercises**, derived from the action kind and the tool rather than declared, so the one asymmetry that matters — a `then` leader is caught on the write path and escapes on the shell path — reads as an asymmetry instead of a contradiction; the green prints the per-path census including the zeroes. An **unexpected throw is could-not-run, not a red**, because a crash that exits 1 arrives here as a verdict about a corpus nothing finished grading. It went red on its first run and found gate-map hole 8 | `bash`, `node` |
| [`eval-bundle.sh`](eval-bundle.sh) | a clean evaluation bundle cuts from the **index** (wrapped as an unreferenced probe commit, so the pre-commit gate judges what is about to ship) — [`../../cli/eval-bundle.mjs`](../../cli/eval-bundle.mjs) `--check` materialises the payload for a fixture recipient into scratch it always deletes, renders the evaluation terms from the template **at that same commit**, and refuses when the **top-level payload partition** stops matching the tree, when the **machine-read license census** stops equalling the patch list, or when a machine-read Apache assertion survives the transforms. Day to day it is the roster-drift rail: a new top-level path, or a new manifest asserting Apache in the payload, goes red here with a repair menu instead of silently thinning or mislicensing the next bundle. A payload entry that is neither a plain nor an executable blob (a symlink, a gitlink) is **could-not-run — 2, named** — no licensing verdict can be formed from a payload the tool will not materialise | `bash`, `git`, `node` |

Exit `0` green · `1` red · `2` could not run — and that third code is why each recipe declares its needs
in the manifest rather than discovering them: a recipe that *could not run* must never be mistaken for
one that ran and passed.

**Every recipe but [`docs.sh`](docs.sh) is a wrapper, and the wrapper is the point.** Each one whose
**Needs** column above names `node` delegates to it, and each checks for it first — since 2026-07-27
as one entry in that recipe's `for need in …` guard rather than as a standalone `command -v node`, the
same mechanism spelled once for every dependency — so a new recipe joins this paragraph by
declaring that dependency rather than by being counted into it. `bash -c "node …"` on a machine without `node` exits `127`, which is
neither a verdict about the repository nor "could not run" — the wrapper is where that gets turned into a
`2` deliberately.

**The seventh arrived on 2026-07-28 and did exactly that**, with a dependency this directory had not
had before: [`workflow-filters.sh`](workflow-filters.sh) declares `jq`, guards it in the same
`for need in …` line as `node`, and needed no edit to this paragraph or to CI to be enforced.

**The eighth is [`index.sh`](index.sh)**, and it is [`compile.sh`](compile.sh)'s shape applied to
generated artifacts: an index is emitted by [`../../cli/index.mjs`](../../cli/index.mjs) from the
series it covers, committed so a change to what is always loaded is reviewable in a diff, and
byte-compared here so a hand-edit survives exactly until the next run. It carries **distinct reds for
distinct repairs** — *out of date* is fixed by running the generator, *over budget* by consolidating
the store ([`../../core/skills/consolidate/SKILL.md`](../../core/skills/consolidate/SKILL.md)), a
disagreeing heading by editing the record, an undated handoff by renaming it — because a recipe
reporting one verdict for all of them would send an author to regenerate a file that is already
correct and still too big.

**Since Workspace Definition 2.5 it covers two series, and only one of them is budgeted.** The handoff
series gets an index and no rail on its size, which is the argued absence rather than an oversight:
consolidation is a budget's only permitted remedy, and a handoff series is append-only — held to the
Session log by the `record` check above, one per session. Retiring a handoff to buy headroom would
either red that check or destroy the record it exists to keep, so every repair such a budget could ask
for is already barred. A rail whose only legal answer is *do nothing* is one that gets switched off,
which is the failure this whole file is written against. [`../../spec/slots.md`](../../spec/slots.md)
carries the argument; whether the series wants a rail on some other axis is the maintainer's question
and is deferred, not answered.

**The ninth is [`control-chars.sh`](control-chars.sh)**, and it exists because of a byte that got past
every other one. A raw NUL shipped inside [`workflow-filters.mjs`](workflow-filters.mjs) as the
separator in a template literal, where the escape `\u0000` was meant; a reviewer caught it, and nothing
here did. The reason is the part worth writing down: `file` classified the source as *binary data*, and
`grep -n "identity = "` against the line that plainly contains that text **exited 1** — a silent false
negative. **[`docs.sh`](docs.sh) — the default recipe, the one a Stop-gate runs when nothing more
specific applies — is built out of `grep` throughout**, so the tool most likely to have shown the byte
is the tool the byte silences. _(Named rather than counted, after two corrections. This sentence first
claimed **every** recipe here was built out of `grep`, and six of the ten invoke it zero times —
`plugin.sh`, `tests.sh`, `workflow-filters.sh`, `compile.sh`, `control-chars.sh` and `rule-carriers.sh`,
of which **`compile.sh` and `control-chars.sh` carry the word in comments only and the other four never
mention it at all** — named rather than placed, because "the middle two" was a position in a list, and a
position is a count wearing a word — **which is why this said three until 2026-08-10**: an instrument
that counts occurrences answers a different question from the sentence's verb, and the retrospective
pass over this very pull request found it, then itself said four by leaving out the recipe the
paragraph is about. Third time on one page. The correction then asserted `seventeen invocations`, a
figure taken from a word count that included comments, which is [#77](https://github.com/sleepy-panda-srl/portulan/issues/77)'s lesson walked into twice on one page. A false
universal inside the paragraph doing the persuading is this page's own dominant defect class, and it sat
in the passage introducing the rail against claims nobody measured. Found by Copilot on
[#167](https://github.com/sleepy-panda-srl/portulan/pull/167) in the suppressed channel, in two
carriers; a third was swept with them.)_ `git` rendered the diff as text only because the byte
sat past its first 8000 bytes; a few hundred lines earlier and the whole instrument would have arrived
in review as `Binary files differ`, a file nobody could read in a pull request that looked complete. It
then reproduced twice more while being fixed. The defect was repaired in
[#64](https://github.com/sleepy-panda-srl/portulan/pull/64) and the *rail* was filed as
[#68](https://github.com/sleepy-panda-srl/portulan/issues/68) under
[`a-review-loop-needs-a-bound`](../memory/a-review-loop-needs-a-bound.md) rule 4; this is that rail.

**It scans BYTES, and its exemption is a NAME rather than a sniff.** Both follow from the incident.
Reading bytes rather than decoded text is what makes it exact — decoding invalid UTF-8 yields U+FFFD,
which hides bytes and invents a character that was not there. And a *binary test* is refused outright,
which is the half a reader will assume went the other way: every binary sniff in general use is keyed on
NUL, so a check that skipped what `file` and `git` call binary would have skipped the single file it
exists to catch. A repository that later carries a real binary asset says so by name, in the `EXEMPT`
array in the recipe — one reviewable line — and the scanner **audits that array three ways**, each at
exit `2`: an entry naming nothing in the list is stale; an entry over a file that is tracked and not on
disk was **never read**, so the run cannot say whether the exemption is live; and an entry over a file
carrying no control character is dead. The middle case was reported as *dead* until a reviewer separated
them, which would have sent a maintainer to delete an exemption still doing its job — a verdict about a
file nothing opened, inside the check whose whole subject is that. An exemption nobody audits is the
allow-list defect this project has already paid for
once, in [`../../cli/vendor.mjs`](../../cli/vendor.mjs).

**CR is refused, and that is a decision rather than an oversight.** No tracked file carries one, so the
rail costs nothing today and stops CRLF arriving unnoticed in a tree that is uniformly LF. `DEL` is
refused too, though it is outside C0: it is the same defect, invisible, and `cat -v` prints it as `^?`.

**[`compile.sh`](compile.sh) never writes.** It recompiles in memory and byte-compares. A verify recipe
that repairs what it is checking always passes, which is a fail-open dressed as a convenience — and this
is the recipe most tempting to write that way, because the repair is one function call away.

**And it cannot tell you the enforcement works.** It proves the artifact matches the policy. Whether the
host *honours* the artifact is a fact about a running host, and CI installs nothing by stated doctrine —
the same boundary that keeps `claude plugin validate --strict` out of the recipes. Both halves were
measured at this milestone's checkpoints, and the measurement is version-stamped in
[`../compile/README.md`](../compile/README.md) because it is a fact about one CLI version.

**What [`plugin.sh`](plugin.sh) deliberately does not run.** `claude plugin validate --strict` is the
authority on the Claude Code plugin contract, and it is **not** a recipe: CI installs nothing by stated
doctrine, so declaring the `claude` binary would exit `2` on every pull request — permanently red. It runs
at the supervised checkpoints and before a release instead. The two are not nested and neither is a
superset: the first-party validator refused a manifest this lint passed, and passed three broken skills
this lint fails. Measured rather than assumed —
[`../memory/a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md).

**[`doctor.sh`](doctor.sh) names the workspaces it validates, and audits that list against the tree.**
Naming rather than discovering closes the enumeration fail-open recorded below: a scan finding no
manifests would run nothing and report green. But naming opens the mirror hole — a workspace *added* to
the tree and not added to the list is validated by nothing, and nothing says so. That was demonstrated
before it was closed: a third manifest dropped into the tree, and the recipe exited `0` having ignored it.

[`plugin.sh`](plugin.sh) carries the same structure for plugin roots, because the hole is the same one:
this repository is about to ship packs as plugins, and a second `plugin.json` added to the tree and not
added to the list would be linted by nothing.

So the named list is what **runs** and a discovery pass **audits** it; disagreement in either direction
exits `2`. The ordering is the whole design. Discovery cross-checks and never decides, so it cannot
reintroduce the fail-open it was avoided for — a scan finding nothing now disagrees with a non-empty list
and fails loudly, where a scan that *drove* the run would have passed in silence. Fixtures under
`cli/fixtures/` are excluded by prefix, because they are broken on purpose and validating them would fail
by design. **This is why the recipe needs `git`** — the audit reads the index, and the manifest declares
that dependency alongside `bash` and `node`.

Two limits, stated because the audit is easy to read as stronger than it is. It compares against the
**index**, so a manifest deleted from disk while still tracked passes the audit — `doctor` then goes red
on it, exit `1`, which is the right code for a workspace it read and judged. And the audit answers *is the
list complete*, never *is the list right*: naming a directory that is not a workspace is caught by the
manifest being absent, not by the audit.

`docs.sh` needs `bash`, `git`, and a handful of POSIX utilities — `grep`, `sed`, `awk`, `wc`, `sort`,
`cut`, `tail`, `tr`, `dirname`, `mktemp`, and `rm` as of milestone 4 — and nothing else, which is worth
preserving: a recipe that needs a toolchain is a recipe that stops being run. The `record` work of
2026-07-28 added no utility to that list: a first draft compared two date lists with `comm` and would
have, but counting per date is a `grep -c` and the dependency came back out.

**Every recipe now checks its own list before it runs a check**, exiting `2` — and **the `for need in …`
line inside each recipe is the source of truth** for what that recipe requires. The Needs column above
and `requires` in [`../workspace.json`](../workspace.json) name only the substantial dependencies
(`bash`, `git`, `node`, and since 2026-07-28 `jq`) and are summaries rather than lists: `tests.sh` genuinely needs `find`, and
neither says so, deliberately — a manifest that declared `awk` would be noise nobody reads. The
paragraph above is the one place a full list is written out in prose, and it is `docs.sh`'s alone,
because that is the default recipe and the only one whose dependencies are all POSIX utilities; it is
edited together with that recipe's guard. It is not defensive coding — until 2026-07-27 the recipes
guarded only `git` or `node`, and the rest of the list was assumed. See Provenance below for the cost.

**Why `json.sh` breaks that rule, deliberately.** Milestone 2 introduced the first JSON this repository
*depends* on rather than merely carries, and well-formedness is a parser's judgement: bash can only
approximate it, and an approximation would pass files it does not understand — a false green, which is
worse than no check at all. So the dependency was accepted for one recipe rather than smuggled into the
default, and the cost is stated in [`../identity.md`](../identity.md) instead of left for someone to
discover on a machine without `node`.

**Why `workflow-filters.sh` needs `jq`, and why it is a recipe rather than a test.** The thing under
test *is* an external interpreter's behaviour: two merge-gate workflows branch on what jq prints for
null, and only jq can answer for that. That makes the dependency unavoidable, and where a check with
an unavoidable external dependency lives is decided by the third exit code. `node --test` has two
outcomes, not three — a skipped test still exits `0`, so the suite would report green over a check
that never ran, and a failing one would say the repository is broken when only the environment is.
Both are named on this page as the failures to avoid. `2` is the honest answer and only this layer
has it. The second reason is smaller and still real: keeping the codes honest inside the suite would
mean adding `jq` to [`tests.sh`](tests.sh)'s guard, so a machine without it could run none of the
suite rather than one fewer check. And unlike `claude plugin validate --strict`, this dependency does
not make a permanently-red recipe: `jq` ships on `ubuntu-latest`, so CI runs the check rather than
skipping it, and installs nothing to do so.

**Why `eval-bundle.sh` needs no `tar`, although its subject is an archive.** The cut is materialised
through git plumbing — `ls-tree` and `cat-file` — and hashed with node's own crypto, so this recipe
adds **nothing** to the directory's dependency floor. The pre-port script piped `git archive` into
tar, and porting that shape would have made every pull request's green depend on a binary the checks
never otherwise need — the exact "recipe that needs a toolchain" this page warns stops being run. The
only tar invocation in the tool lives on its issuance path, which no recipe reaches: a machine
without tar can run every check here and cannot issue a bundle, which is the right way round.
Equivalence of the plumbing transport with `git archive | tar -x` is not assumed — the suite asserts
the two materialise byte-identical trees, executable bits included — **and that one equivalence test
is the suite's single use of tar**: it skips by name on a machine without it, so `tests` stays green
with the gap stated rather than red about the environment. _(The first draft of this paragraph said
no recipe needs tar while the suite failed four tests without it, turning `tests` red — the page's
own could-not-run-reported-as-red class, found by the pre-commit checkpoint with tar taken off the
`PATH`.)_

**What `json.sh` does not do.** It does not validate the manifest against
[`../../spec/workspace.schema.json`](../../spec/workspace.schema.json), and it does not check that the
paths a manifest names exist. That is [`doctor.sh`](doctor.sh), and well-formed is a long way from
correct — which is why both recipes exist rather than one replacing the other.

## Where this sits in the hierarchy — honestly

Until milestone 2 this repository shipped no product code, so there was nothing to compile and no suite
to pass, and the honest description of every check here was that it exercised *documents* the way a
linter exercises source. `doctor` is the first code, and `tests.sh` is the first recipe that runs a test
suite rather than a linter — so the promise this section used to make, that real tests would join these
rather than replace them, is kept rather than pending.

The claim is still bounded, and the bound was demonstrated within hours of being written. The suites are
read off the tree rather than named in a list: `tests.sh` counts every `*.test.mjs` under
[`../../cli/`](../../cli/) with `find`, then runs that same set through a recursive glob — so a suite
added to `cli/` is covered without this paragraph changing.
_(This sentence used to end with the count, and [#77](https://github.com/sleepy-panda-srl/portulan/issues/77)
is filed about exactly that: a paragraph claiming to be self-maintaining and then hard-coding the
number that makes it not. It was stale when filed and stale again twice since. The figure is gone
rather than corrected, because `tests.sh` prints the live one on every run and that carrier cannot be
wrong. `spec/README.md` carried a sibling of this defect and lost its count in the same change.)_
**Nothing tests the recipes themselves** — every recipe in this directory is verified by being run, which
is a weaker claim than it sounds, and it is weakest on `workflow-filters.sh`: its reader of the workflow
files is code that can be subtly wrong, and what stands behind that reader is a second, independent
reading of the same file that has to agree with it — not a suite. _(**That sentence used to enumerate the recipes, and the enumeration went stale twice.** It named
nine while twelve sat beside it — `rule-carriers.sh` and `pack-version.sh` having joined the tree
without joining the sentence — swept when `eval-bundle.sh` was added; then it named **twelve while
fifteen sat beside it**, `pack-identity.sh` and `version-carriers.sh` having done the same, with
`goldens.sh` about to make a third. **The enumeration is deleted rather than corrected a second time**,
2026-08-24: a roster that goes stale on the schedule of *somebody adds a recipe* is a worse carrier
than the sentence's own subject, which is the directory. The claim is about every recipe here, so it
now says every recipe here. Same repair, same day, as the recipe counts in
[`../repos/portulan.md`](../repos/portulan.md) and the enumeration in
[`../identity.md`](../identity.md), on the [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)
ground the run-list above cites — and found by the pre-commit checkpoint, which noticed that this
change repaired the run-list block in this very file and walked past the enumeration below it.)_ **`index.sh` and `control-chars.sh`
are not in that position**: everything in either that could be subtly wrong lives in
[`../../cli/index.mjs`](../../cli/index.mjs) and
[`../../cli/control-chars.mjs`](../../cli/control-chars.mjs), which the suite does cover, and each
wrapper itself does dependency guarding, a named-list audit, and exit-code passthrough — the three
things every recipe here has had a defect in, and the three the paragraphs above exist to explain.
Neither is the *smallest*, which their shape might suggest; both sit near the top of this directory by
size, because the audit and the guard are what take the room. `rule-carriers.sh`, `pack-version.sh`,
`eval-bundle.sh`, `pack-identity.sh`, `version-carriers.sh` and `goldens.sh` are in that same
position: each wrapper is a dependency guard, a precondition and an exit-code passthrough, and the
judgement lives in
[`../../cli/rule-carriers.mjs`](../../cli/rule-carriers.mjs),
[`../../cli/pack-version.mjs`](../../cli/pack-version.mjs),
[`../../cli/eval-bundle.mjs`](../../cli/eval-bundle.mjs),
[`../../cli/pack-identity.mjs`](../../cli/pack-identity.mjs),
[`../../cli/version-carriers.mjs`](../../cli/version-carriers.mjs) and
[`../../cli/goldens.mjs`](../../cli/goldens.mjs), which the suite covers. _(Three of the six joined
this sentence on 2026-08-24. `pack-identity.sh` and `version-carriers.sh` had been suite-backed
wrappers sitting outside it since they landed; `goldens.sh` would have been the third omission had the
pre-commit checkpoint not counted the list against the directory.)_ _(The
missing-module precondition was real in two of the three only after the pre-commit checkpoint: a
deleted module made `pack-version.sh` and `eval-bundle.sh` print RED about work nothing had judged —
node's module-not-found exits 1 — where `control-chars.sh` and `rule-carriers.sh` already refused at
2. Both now carry the `[ -f ]` guard, on the sweep [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)
asks for at the first fix.)_
_(That sentence used to carry `index.sh`'s line count, and the count was stale by eleven lines when this
paragraph was next edited. The figure is gone rather than corrected, on the repair
[#77](https://github.com/sleepy-panda-srl/portulan/issues/77) already established for a sibling of it
two paragraphs above: a number nothing regenerates is a claim that rots, and `wc -l` is one command.)_
That gap now has a task of its own rather than a mention in a handoff:
[`../tasks/0004-a-harness-for-the-verify-recipes.md`](../tasks/0004-a-harness-for-the-verify-recipes.md). Every defect ever found in them was found by a human or a reviewer, and
the two most recent were found by a reviewer on the pull request that introduced them, in the two recipes
this file had just finished describing:

- **`doctor.sh` reported a missing validator as a red verdict.** `node cli/doctor.mjs` on a missing file
  exits `1`, which the wrapper passed through — so "the validator is not there" arrived as "the two
  workspaces do not validate", about two workspaces nothing had looked at. The `node` guard beside it had
  been written precisely to stop that shape, one dependency over.
- **`tests.sh` piped `find` into `wc -l` and never checked `find`.** A total failure is harmless — the
  count comes back `0` and the recipe exits `2`. A **partial** failure is not: with one unreadable
  subdirectory `find` exits `1` and still lists what it reached, so the count is plausible-but-short and
  the suite runs a subset while reporting on the whole. Measured at two files, one unreadable directory,
  count `1`.

Both are now preconditions that exit `2`. The pattern across them, and across the three earlier ones, is
worth stating once: **the guard is never where the check is — it is in the scaffolding around it.**

Saying all this matters: a recipe that implies more coverage than it has makes every later green worth
less.

## What each check enforces, and why it is a rail

| Check | The rule | Why it is machinery rather than a reminder |
|---|---|---|
| `links` | Every relative Markdown link resolves **in the repository** — against the tracked set, not against the disk the check is running on. | The engine is a web of cross-references between doctrine, templates, personas, and skills — progressive disclosure *is* those links. A dead link in a framework about context engineering is a product defect, not a docs defect. And the domain is half the rule: a check that asks the filesystem answers a question about one machine, which is how a green stood in front of an author while CI went red on the same commit ([#121](https://github.com/sleepy-panda-srl/portulan/issues/121)). |
| `kernel` | [`../../core/engine.md`](../../core/engine.md) stays within 60 lines. | The always-loaded layer is the scarcest thing the framework spends, and the budget is constitutional. A budget that lives only in prose is the first thing a busy session negotiates with. |
| `map` | Every top-level entry appears in the root `README.md` layout table. | Agent legibility: a repository whose own map omits directories teaches an agent a false shape of the ground. This one exists because that had already happened — see below. |
| `record` | The Session log and `../handoffs/` correspond **both ways** — every log date since 2026-07-25 has a handoff of that date, and every date carries at least as many log entries as it has handoffs; no Markdown file in `../handoffs/` escapes that count by being named without a date; every log entry dated after 2026-07-28 is within the log's 10-line budget; and the newest entry carries a seam attestation. | The Session log and the handoffs are the repository's memory of *how* things were decided, and a session that leaves no record cannot be audited afterwards — which stopped being hypothetical the day a merged doctrine rewrite (#32/#33) turned out to have neither, and again when a two-day review found **five** handoff-documented sessions with no log entry. The budget half exists because the same review found entries at 105 lines against a log that asks for one line per session: an entry that swells into a record makes the file every session must read to boot cost more each time, and moves the *why* out of the handoff written to hold it. Both floors are forward-only cutoffs — the day each rule became a ruling — because a rule cannot bind a record written before it without rewriting that record to suit it. |
| `parse` | Every tracked `.json` file is well-formed. | From milestone 2 the repository's policy layer *is* JSON. A manifest that does not parse gates nothing, and it fails at the moment it is needed rather than when it is written. |
| `doctor` | Both workspaces conform to the Workspace Definition, their paths resolve, their claims match the tree, and every rule carries checkable provenance. It also reports the memory store's count and size, and names any record stating no `Retire when:` condition — reported, never failed, because nothing legislates the field. The budget rail that *does* fail arrived at milestone 5 and is [`index.sh`](index.sh), one recipe over; the retirement condition stays a note here, because it is still the field nothing legislates. For this repository the suite is stricter: a live record without the field turns `tests` red. | The workspace layer is where a team's policy lives, and until this existed every "this workspace conforms" sentence in the repository was an assertion. Its first run found three rules whose provenance the repository had already mandated and not held. |
| `tests` | The test suites pass. | The validators are the first things here that can be *subtly* wrong rather than visibly broken — a schema keyword silently ignored looks identical to one enforced. A linter can be judged by reading it; a validator cannot. |
| `compile` | [`../../.claude/settings.json`](../../.claude/settings.json) is byte-identical to what [`../gates.json`](../gates.json) compiles to. | The artifact is generated *and* committed — generated so the policy is the single source, committed so the gate wiring is reviewable in a diff. That combination invites exactly one failure: a hand-edit that works until the next compile silently reverts it. This is the check that makes that loud. |
| `filters` | Every jq and awk program in [`../../.github/workflows/`](../../.github/workflows/) produces exactly the bytes and exactly the exit status the shell around it branches on. The programs are read out of the parsed `run:` scalars and never restated here; the fixtures carry null and empty inputs alongside ordinary ones. | Two merge gates are decided by jq's answer for null — `copilot-review.yml` refuses a pull request whose `head.sha` came back empty from `join("|")`, and the required `pr-labeled` check treats *no output from `jq -er`* as "the policy declares no labels". Both behaviours were asserted by prose and by a harness that stubs `gh`, and executed by nothing. A filter is the one kind of code in this repository that can be wrong in a way review cannot see: it looks like a selector and behaves like a program. |
| `index` | Each workspace's committed memory index is byte-identical to what its store renders, no record's heading disagrees with its filename, and neither the index's line count, nor the store's size, nor any single record's size is over the budget the manifest declares. **The per-record cap arrived at Workspace Definition 2.8** (proposal `0025`), and this workspace declares it in place of the store total: an aggregate over individually-authored records is a commons — the record that grew never felt the rail at write time and three unrelated changes hit it instead — and it had also run out of legal repairs, which `../../spec/slots.md` had already named as the state that gets a recipe switched off. A per-record cap makes the breach local and gives it a live repair menu: split, compress, demote. | `core/operating/memory.md` has promised a *generated, size-budgeted* index since milestone 1, and until milestone 5 both halves were prose: the index did not exist, and the budget was a sentence binding review. A budget that lives only in prose is the first thing a busy session negotiates with — the same argument the `kernel` row makes, applied to the layer that decides what else gets loaded. The heading check is here because the store may hold two carriers of a record's name and must not hold two answers; it found a real disagreement on its first run. |
| `proposal` | Every Markdown file in [`../proposals/`](../proposals/) is a numbered `NNNN-slug.md`; every proposal records an outcome under `**Decision.**` or `**Status.**`; and every proposal names, by full URL, the pull request that filed it. | `core/operating/evolution.md` has said since milestone 1 that a rule change is a *proposal as a pull request* — "reviewable, diff-able, and revertable". All fourteen had in fact arrived that way and **not one recorded which pull request**, so the sentence bound a convention: nothing could get from a rule to the review that accepted it, and a proposal committed straight to `main` would have looked identical to one that went through the gate. Red-first against the real tree — all fourteen failed before the pointers were resolved, mechanically, through GitHub's own commit→pull-request mapping. What it deliberately does **not** check is whether a proposal is accepted, pending or rejected: that reading is `cli/librarian.mjs`'s, where a wrong answer costs a line in a report, while here it would be a grep classifying prose and a red on a proposal whose only fault is the maintainer's phrasing — which is how a whole recipe gets switched off. |
| `plan` | No milestone row in [`../../docs/plan.md`](../../docs/plan.md) carries an amendment argument (`**Criterion amended`) or a session note (`[Ss]ession N of`); every row parses into its five cells; and every row's Status cell stays within 500 **bytes**. The two text patterns are matched **inside a milestone-table row only**. | The table is what a session reads to learn what it must build, and it had become the archive of how each row got that way: 63,420 characters of row, **11% of it criterion**, one Status cell holding 16,505 characters on a single line. None of that history was junk — it is the amendment arguments, the expansion/narrowing verdicts and the close evidence that make a criterion auditable — but in the row it buried the binding words, and the file every session boots from paid for it on every boot. The history now lives in [`../../docs/milestones/`](../../docs/milestones/), moved verbatim, and this is what stops it flowing back. The Status budget is a **byte** count: the cell is one line by construction, so a line budget would be the number 1 and bound nothing — and bytes are what `awk`'s `length()` actually measures on the `mawk` Ubuntu runners ship, in cells full of three-byte em dashes. Labelling it *characters* would have printed a number the reader could not reproduce, inside the check whose subject is claims that outrun their measurement. Unlike `record`'s two floors this rail is deliberately **retroactive**: there, a cutoff was mandatory because a rule written after a record cannot bind it without rewriting the record to suit the rule; here the remedy is *relocation*, which preserves a merged record byte-for-byte, so every historical row can comply without one word being lost. Retroactivity is honest exactly when compliance destroys nothing. |
| `plugin` | Both packaging manifests parse and agree; every component path resolves inside the tree — after canonicalisation, so a symlink out of it is an escape rather than containment; every declared skill and agent is a real artifact with a kebab-case `name` and a non-empty `description`. | From milestone 3 the repository *is* a distribution channel, and a marketplace declaring no plugins — or a skill path resolving to nothing — installs cleanly and delivers nothing. The platform's own validator reports the empty-marketplace case as a *warning*, which is the severity a milestone walks past. |
| `chars` | No tracked file — nor anything new and not ignored — carries a byte in the C0 range other than TAB and LF, nor DEL. Read as bytes and **never decoded**, from the file list through to a symlink's target, which is read as its target's *bytes* rather than followed. A path this repository declares binary is exempt by NAME, and that declaration is audited three ways, each exit `2`: an entry naming nothing in the list is stale, an entry over a file tracked-and-not-on-disk was never read, and an entry over a clean file is dead. | A NUL shipped in an instrument here and **nothing in this repository could see it**: `file` called the source binary data, and `grep` against a line that plainly contains the text it was given exited `1` — a silent false negative, in the tool [`docs.sh`](docs.sh) is built out of — the default recipe, the one a Stop-gate runs when nothing more specific applies. That is what makes this a rail rather than a matter of taste: the failure mode is not *somebody wrote something wrong*, it is *the checks went quiet*. It is red rather than one of `doctor`'s notes because an invisible byte is not a question of judgement, and the exemption is a name rather than a content test because every binary sniff in use is keyed on NUL — the one byte a sniff would therefore have hidden. |
| `pack-version` | A pack whose `contributes` block differs from the **merge-base** also moved that pack's `portulan.version`. Ruled on [#265](https://github.com/sleepy-panda-srl/portulan/issues/265): arm 3, the whole `contributes` block rather than only `gates`, and a **prose-only** edit to a fragment's `reason` counts. Manifests are compared as **values**, so reindenting or reordering keys is correctly not a change. An added pack passes — it has no prior state to bump from — and a pack that changed `contributes` while declaring no version at all is red, which is what makes an optional schema field mandatory *for a pack that changes*. | Changing a pack's `contributes` changes what **every composing workspace yields**, and a consumer pinning that pack has nothing but this field to pin on. Nothing read `portulan.version` at all before this — measured across `cli/`, zero readers — so the field was documentation. **This is the only recipe here that reads a diff rather than the tree**, which is why it refuses at `2` on an unreachable base or merge-base rather than reporting green on a history it could not see; a shallow clone reaches that refusal by two different routes and both are named in the message. What it does *not* see is content the block points at — a skill's body, a persona file, the script a contributed recipe names — which is [#259](https://github.com/sleepy-panda-srl/portulan/issues/259)'s class and is stated rather than closed. |

## Provenance

The `map` check was added in milestone 1, session 3, after a fresh-context supervisor noticed that
`.claude-plugin/` — the manifest that makes this repository a plugin marketplace — had been missing from
the root README's layout table since the repository was created. The check was written **before** the
fix, went red on two entries, and went green only once the table was corrected. Recorded as
[`../memory/readme-map-must-match-shape.md`](../memory/readme-map-must-match-shape.md).

That sequence is the doctrine's own loop — mistake → rule → rail, with the incident carried along so the
rule can be retired if it ever stops applying
([`../../core/operating/evolution.md`](../../core/operating/evolution.md)).

The `parse` check was written in milestone 2 **before** the JSON it guards, on the reasoning that a
schema shipped with nothing that even parses it sits below the bar this repository already holds its
Markdown to. It earned its keep immediately, and against itself: the first draft mis-indexed `node -e`'s
argument vector and reported a perfectly good file as malformed — a **false red**, the one outcome the
limits below say to avoid at any cost. The argument handling was removed rather than repaired (the file
list now arrives on stdin), and the red→green transcript is in
[`../handoffs/2026-07-25-workspace-definition-v1.md`](../handoffs/2026-07-25-workspace-definition-v1.md).
Worth recording because the lesson generalises past this check: a false red is not a milder failure than
a false green, it is the one that gets the whole recipe switched off.

**The `links` check kept its rule and changed its DOMAIN on 2026-07-30**, which is the more interesting
half of a check's design and the one this recipe had got wrong since milestone 1. The rule was always
*every relative link resolves*; the domain was `[ -e ]`, the filesystem — so the check answered a question
about the machine it ran on. The two diverge exactly when git cannot carry what the disk holds, and in
milestone 6 they diverged inside a **generated** file: a link to a deliberately empty directory, green in
front of the author who had just created it, red in CI on the clean checkout
([#121](https://github.com/sleepy-panda-srl/portulan/issues/121), and the retirement condition in
[`../memory/a-generated-file-must-not-point-at-what-git-cannot-carry.md`](../memory/a-generated-file-must-not-point-at-what-git-cannot-carry.md)).
Resolution now reads `git ls-files --cached`; **enumeration** deliberately still reads
`--cached --others --exclude-standard`, because the two lists want opposite directions — scanning more
files can only find more defects, while resolving against more paths can only hide them.

**Seven shapes passed the old test, and counting them is the point.** Forced red before the change and
re-run after it, in a throwaway clone of this tree so that symlinks, submodules and non-ASCII names could
actually be committed — twenty-five link shapes in three documents. Green before and red after, every one:
an **empty directory**; an **ignored** path; a **wrong-case file**; a **wrong-case directory**; an
**untracked** path; a path that **escapes the root and re-enters** through the absolute filesystem (`..`
that walks off the top and lands somewhere real); and an **absolute** target from a root-level document,
which resolves here and 404s in every renderer because a leading slash means the *site* root.

Also red before and after, and correctly: an absent target, a trailing slash on a tracked file, an escape
that lands nowhere, and a path reached by walking *through* a tracked symlink. Also green before and after,
and correctly: a tracked file, a tracked symlink itself, `a/../b` landing back inside, a name with a space,
a directory with and without its trailing slash, `./`, `.`, `../` naming the root, and a `#fragment`.

That is **one defect with seven faces**, not seven defects, and the same-class sweep is why six of them
were found at all — the reported instance was the empty directory, and the other six came from asking what
else answers "is this on my disk" when the question is "does the repository carry it".

**Two false REDS the change would have introduced, both found by a fresh context attacking it rather than
by any run.** Neither fires on a path this tree carries today, which is why nothing would have caught them
until the day someone committed one. First: `git ls-files` **C-quotes** any path with a byte outside
printable ASCII, so a committed `docs/naïve.md` comes back as `"docs/na\303\257ve.md"` and the resolution
table keys the quoted spelling — a correctly tracked file reported as untracked, with `git add` unable to
discharge it. `core.quotePath=false` on both `ls-files` reads closes it, and it closes the same latent
defect in the `map` check, which shares the enumeration and would have reported a top-level entry named
`"docs`. (**Both** was right about this recipe on the day it was written and is no longer the whole
count — #209's sweep found the same unclosed defect at four more reads, one of them the cli-table
enumeration in this very file, and added the setting there too. The narrative above is left as it was
rather than restated, because it records what that change did; `../../cli/list-quoting.live.test.mjs`
is the rail that now holds the property across every recipe, which is what stops the count going stale
again.) Second: `normalize()` returned the same value for a `..` that walks off the root and for a path
that lands exactly *on* the root, so `./`, `.` and `../` from a subdirectory were red as *"escapes the
repository root"* — a false red carrying a confidently wrong reason, which is worse than either alone.

**Two limits this review surfaced and did not fix**, recorded under Known limits below on this page's own
rule that a limit written down is not a limit managed: a `%`-encoded target (`two%20words.md`) is a false
red, because a renderer decodes the escape and this check does not; and a target containing nested
parentheses is truncated at extraction. Both predate this change and neither is reachable from a path in
this tree.

**Two findings from writing it, both worth more than the fix.** The first draft's *diagnosis* was
misaligned — awk emitted an empty middle field, bash treats a run of tabs as one delimiter because tab is
IFS whitespace, and every field after it shifted left, so three of the seven reds named the wrong repair
while the count was perfectly correct. Caught only because the drill asserts the **message**; a drill that
had checked the number would have passed. And the diagnosis arm had no fallback, so an unknown code would
have silently reused the previous iteration's `note` and attached one link's explanation to another's
line. Both are the recipe's own recurring class — a fail-open in the scaffolding around a check rather than
in the check — and the cost of the fix is honest: **+0.09s**, one extra `git ls-files` and one `awk` pass.
Measured rather than estimated, three alternating pairs on the same tree: 0.802–0.817s before,
0.891–0.959s after, so about **11%** on the recipe the Stop-gate runs at every commit. Worth stating
because a default recipe's runtime is a budget like any other, and the honest version of this number is a
range rather than the flattering single reading.

The `record` check was added 2026-07-27, after a fresh-context audit found that the day's #32/#33
doctrine-rewrite arc had merged with **no handoff and no Session log entry**, and that the newest log
entry had closed without the seam attestation its siblings carry. Written red-first against the tree it
was aimed at: on the pre-repair record it failed on exactly the missing attestation (`docs/plan.md:714`)
and went green only once the record was repaired. Its observation procedure is one move — delete the
seam line from the newest entry and run the recipe ([the 0007 rule](../gate-map.md): a watcher earns its
place by being watched). Forcing the date half red is a bigger move on today's tree: every logged date
has more than one handoff, so it takes deleting all of a date's handoffs, not one.

**The counting direction, the stray-file audit and the entry budget were added 2026-07-28**, from the
two-day review that found five handoff-documented sessions with no Session log entry and entries grown
to 105 lines against a log asking for one per session.

**Red-first here means the real record, not a fixture.** Run against `docs/plan.md` as it stood on
`origin/main` — the record the review was written about — the counting direction exits **1** and names
the arrears exactly:

```
FAIL  record — date(s) with fewer Session log entries than handoffs
        2026-07-27 — 14 handoff(s), 13 Session log entr(ies)
        2026-07-28 — 5 handoff(s), 2 Session log entr(ies)
```

With the reconstructions written it exits **0**. Nothing else in the recipe moved between those two runs.

**That is the second design, and the first one is the lesson.** The direction was drafted as *presence*
— every handoff date has at least one entry of that date — and it was **green on the exact record it was
minted from**, because each of the five unlogged sessions shared its date with a sibling that had been
logged. A rail that passes its own founding incident is decoration with a green next to it, and this
repository already fails other people's prose for less. Caught at the session-open supervisor
checkpoint, which is where the design was still cheap to change. Counting costs the same `grep` and
catches five of the six incidents the presence form catches none of.

Observations, each run on this tree and reverted, with the tree asserted clean afterwards:

| Move | Result |
|---|---|
| clean tree | green; `31 handoff(s)`, `0 entr(ies) dated after 2026-07-28` |
| the base record from `origin/main` | **red**, naming 2026-07-27 and 2026-07-28 with both counts |
| a handoff dated 2026-07-29, no entry of that date | **red** on the counting direction alone — 4a stayed green, which is what makes the two separable |
| a log entry dated 2026-07-29, eleven lines | **red** on the budget, naming file, line, date and count |
| the same entry trimmed to ten | green, and the count printed as `1` rather than `0` |
| the cutoff lowered to 2026-07-24, binding 36 entries | **red** on 30, including both merged 2026-07-28 entries — and on **none** of the six added here, which is how their length is a measurement rather than a hand count |
| a Markdown file in `../handoffs/` whose name carries no date | **red**, naming the file; correspondence still runs |
| `../handoffs/` holding **only** undated Markdown | **red** naming the files, plus a second red saying neither correspondence check could run — it was **exit 2 naming nothing** until the reorder below |
| an undated **non**-Markdown file (`notes.txt`) beside real handoffs | green — the audit's scope is `*.md`, measured rather than assumed |
| `../handoffs/` holding **only** a `notes.txt`, or nothing at all | **exit 2**, and — after the second reorder — printing no verdict line at all beforehand |
| `../handoffs/` emptied | **exit 2** — could not check correspondence |
| every entry removed from the log | **exit 2** — could not enumerate the record |
| the whole recipe under `LC_ALL=C`, `en_US.UTF-8`, `tr_TR.UTF-8` | green and identical in all three |
| an attestation wrapping between "seam" and "scan" | green — it was **red** before the fix noted below |
| an attestation following an unindented `- 2026-…` bullet **inside** an entry | green — it was **red** until 2026-07-29, see below |
| an entry carrying no attestation at all | **red**, unchanged — the negative control for both seam fixes: each widens what the scan can *see*, and neither may widen what counts as an attestation |

`tr_TR.UTF-8` is in that list on purpose: it is the locale where case-insensitive matching stops
behaving, and the seam half of this same check is a `grep -i`.

**The procedure found a false green in the check it was written for, one step after it was written** —
the 0007 rule arriving on its own machinery. The first draft read handoff dates straight out of the
manifest, and the manifest is the git **index** plus untracked files. Emptying `../handoffs/` therefore
left four dates standing and printed `ok … (4 date(s))` over a directory with nothing in it. The `[ -f ]`
test the older direction had always carried was the thing the rewrite dropped; it is back, with the
reason in the code rather than in this file alone. Reading a *derived* list is not reading the tree, and
the derived list is the one that stays confident once the tree is gone.

**And a third false red in the same half, fixed 2026-07-29 — this one because the check held two
definitions of one thing.** The seam scan re-derived where the newest entry *ends* with its own regex,
`^- 2[0-9][0-9][0-9]-`, looser than the `^- YYYY-MM-DD ·` the entry parser requires. An unindented
`- 2026-…` without the middle dot therefore did not start a new entry as far as every other check was
concerned, but did end this one's scan — so an attestation sitting after such a line read as absent.

The fix is not a tighter regex. **The scan now reads the entry's start and length from the parser**, so
the second definition is gone rather than corrected, and the two cannot drift apart again. That is the
repair `core/operating/evolution.md` prescribes — a fact with two carriers drifts at the weaker
one — applied to the check that exists to catch it, which is why it is worth more than the narrow
bug it closes.

Raised as a suppressed low-confidence note on round 6 of
[#73](https://github.com/sleepy-panda-srl/portulan/pull/73), triaged to
[#79](https://github.com/sleepy-panda-srl/portulan/issues/79) under the review bound rather than fixed
there, and fixed here. Measured red-first on the merged tree, with the genuine-absence case asserted as
the negative control and the 2026-07-28 wrap case asserted as a regression guard.

**And the seam half turned out to carry a false red, found by the session's own entry.** The check joins
an entry's lines with `tr '\n' ' '`, which leaves the two-space continuation indent standing, so an
attestation that happens to wrap between *seam* and *scan* arrives as `seam   scan` and matched nothing.
The words are now separated by `[[:space:]]+`. This is a correction, not a relaxation — they must still
be adjacent, and *clean* must still follow within 120 characters containing no full stop; an entry with
no attestation at all is still red, asserted as the negative control. Every entry written since the check
landed on 2026-07-27 had passed on the accident of wrapping somewhere else, which is worth saying plainly:
the check was one line-break away from a false red for a year of entries, and it took writing a
sentence that wrapped in the wrong place to find out. A false red is the failure that gets a whole recipe
switched off — this file has said so since milestone 2 — and it was sitting inside the recipe that says it.

**The stray-file audit is the same lesson pointed forward.** Both directions enumerate by a dated
filename, so a handoff named anything else is not failed — it is uncounted, which is worse. A **Markdown**
file in `../handoffs/` that is not a dated handoff is now a FAIL naming it. The set is empty today; it
ships to catch the first one. Its scope stops at `*.md` on purpose, and that is measured rather than
claimed: a `notes.txt` there passes. Widening the matcher would red the untracked debris a working tree
collects, which buys less than it costs — but it means the audit covers the shape a real handoff would
take, not the whole directory.

**And the audit was unreachable in the one case it existed for — the inversion of this recipe's own
founding rule.** It reported *after* the correspondence precondition, so a directory holding only undated
Markdown exited `2`, *could not run*, while the list of offending filenames was already sitting in a temp
file. `verify-preconditions-fail-closed` says *could not look* must never read as *nothing wrong*; this
was **I looked and found it** reading as *could not look* — the same lie told the other way round, and
the one that costs the operator the diagnosis rather than the alarm. The audit now reports first, and the
three outcomes separate: undated Markdown present is **red** naming the files and saying plainly that
neither correspondence check could run; nothing readable at all is the only honest `2`; a stray alongside
real handoffs is red while correspondence still runs. Raised as a suppressed low-confidence note on #73,
twice — round 3 filed it as [#78](https://github.com/sleepy-panda-srl/portulan/issues/78) under the
review bound, and the maintainer then authorised a further round, which is what fixed it.

**Then the fix needed a second ordering, for the same reason as the first.** With the audit moved ahead
of the precondition, a directory holding nothing enumerable printed `ok   record — … (0 examined)` and
*then* exited `2`: a green line opening a run that ends in *could not check*. The precondition now
returns before any verdict is emitted, so the two orderings together say the whole rule — **report a
finding before a precondition that would hide it, and report no finding at all when there is nothing to
find.** The count on the green survives and can no longer read 0: the empty case returns earlier, and a
directory of nothing but strays takes the FAIL branch. Both orderings came from the same channel on
consecutive rounds, each one exposed by the previous fix, which is the honest shape of this fix rather
than something to smooth over.

**Both recipes then turned out to have a false green, found in review of that same change.** Neither
checked whether `git ls-files` succeeded. When it failed the list came back empty, every loop iterated
nothing, and the recipe printed GREEN having examined *nothing* — demonstrated by running `docs.sh` in a
non-git directory, where it emitted `fatal: not a git repository` and still exited `0`. `docs.sh` had
carried it since milestone 1, session 3; `json.sh` inherited it by being modelled on `docs.sh`, which is
how a defect in an exemplar becomes a defect in a family. Enumerating the tree is now a **precondition**
in both: it fails `2`, not `0`. Recorded as
[`../memory/verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md).

**And that rule turned out to be narrower than the defect it was minted from — measured 2026-07-27.**
It named the case where a precondition *runs and fails*; a utility that is simply not installed
produces the identical empty output and the identical green. Removing one command at a time from
`PATH` across all six recipes found **eleven false greens** — `docs.sh` on `sed`, `sort` or `wc`;
`doctor.sh` on `sort` or `tr`; `json.sh` on `grep`, `sed`, `tr` or `wc`; `plugin.sh` on `sort` or `tr`
— and five more runs that went red overall while individual checks still printed `ok`. The sharpest of
those: with `awk` gone, `docs.sh` printed `ok    map — every top-level entry is documented in
README.md` having enumerated **zero** directories, in a check whose own comment already warns about
reporting green over an entry it never looked at. Only `tests.sh` and `compile.sh` were clean
throughout. Each recipe now guards its whole list up front and the probe returns `2` in all thirty
cases. Provenance: a Copilot review comment on [#3](https://github.com/sleepy-panda-srl/portulan/pull/3)
that said exactly this, three days earlier, and was filed *suppressed due to low confidence* — a form
that never becomes a review thread and therefore can never be resolved or block a merge.

The `filters` check was added 2026-07-28, out of the **suppressed** half of a Copilot round on
[#63](https://github.com/sleepy-panda-srl/portulan/pull/63). Two low-confidence comments claimed
that `join("|")` errors on a null element and asked for a coalesce. The claim is wrong — jq renders
null as the empty string in `join` and errors only on arrays and objects — and it was refused on the
pull request with that evidence. **What survived the refusal is the gap the comment had walked past:**
the refusal rested on one measurement, taken by hand, in a terminal, and the harness for that workflow
stubs `gh`, so it asserts the *shape* the filters are assumed to produce (`Copilot||PENDING|7`,
`|false`) with nothing anywhere proving jq produces it. That is the second time this directory has
gained a check from a comment filed at low confidence, after the eleven false greens above; both are
the same lesson, which is that the reviewer's least-certain half is where the unexercised claims are.

Its observation procedure ([the 0007 rule](../gate-map.md)), all eight measured on a scratch copy of
the tree at the commit that added it, with `jq-1.7.1`: change a program's output (`join("|")` →
`join(",")`) → **red, exit 1**, four fixtures named. Rename a selector a fixture anchors on
(`.head.sha` → `.head.ref`) → **exit 2**, the anchor matching 0 of 7 programs. Add a jq program and no
fixture → **exit 2**, the program printed with its file and line. Put a continuation line at column 0
inside the step, which ends the block scalar → **exit 2**, `4 jq token(s) in the file and 1 inside a
parsed run: scalar`. Put a jq program in a workflow the recipe does not name → **exit 2**. Delete the
instrument → **exit 2** from the wrapper. Take `jq` off the `PATH` → **exit 2**, from the wrapper's
guard and again from the instrument run alone. Clean tree → **green, 7 programs, 24 fixtures**.

Two Copilot rounds on #64 then found what the recipe's own author could not see. The first: the
comparison was promised byte-for-byte while `spawnSync` ran with `encoding: "utf8"`, so decoded strings
were compared — the failure this recipe exists to catch, happening to it. Kept the promise rather than
trimming it (`Buffer.equals`), and demonstrated on the only non-ASCII fixture, where swapping the em
dash in `pr-labels.yml`'s summary program for a hyphen is three bytes for one and comes back **red**.

The second is the one worth carrying, because **nothing in this repository could have caught it and
nothing here had a rule for it**: a **raw NUL byte** had shipped inside the instrument's source, as the
separator in a template literal. `file` classified the source as *binary data*; `grep -n "identity = "`
against the line that plainly contains it exited **1**, a silent false negative, in a repository whose
recipes are built out of `grep`. Git rendered the diff as text only because the byte sat past the first
8000 — a few hundred lines earlier and the whole instrument would have arrived in review as
`Binary files differ`, reviewed by nobody. It is now the escape `\u0000`, which keeps the property that
made NUL the right separator: neither a flag nor a jq program can contain one.

Two more were added when the binding rule was tightened, because the first version of it would have
trapped a change rather than caught one: the **same** program appearing in a second workflow → **green,
8 programs**, both sites exercised by the same fixtures, where requiring exactly one call site made an
exit `2` that no anchor could ever satisfy. Two **different** programs under one anchor → **2**, with
both sites named — there the fixture would be asserting about a filter nobody chose for it.

**And the dependency claim above is measured rather than argued.** "`jq` ships on `ubuntu-latest`, so
this does not become a permanently-red recipe" was a prediction until the first CI run on
[#64](https://github.com/sleepy-panda-srl/portulan/pull/64) printed `filters: 7 jq program(s) in 2
workflow file(s), 24 fixture(s), run through jq-1.7` and went green. Worth the sentence because the
runner's jq is **1.7** and the maintainer's is **1.7.1** — two versions, same 24 answers, which is the
first evidence anyone here has that these programs are not pinned to one build. It is not evidence
about gojq, which is the interpreter that actually runs them in the workflows.

The `index` check was added 2026-07-28, at milestone 5, against two sentences
[`../../core/operating/memory.md`](../../core/operating/memory.md) had carried since milestone 1 — that
the index is *generated, never hand-maintained*, and that a budget is *a rail, not an aim*. Neither
had a machine behind it: there was no index, and the budget was prose. It found a real defect on its
first run against the tree, which is the third time a check here has
([`map`](../memory/readme-map-must-match-shape.md) and `doctor` were the others): one record's H1 said
something its filename did not, and the store therefore held two answers to what that record is called.

Its observation procedure ([the 0007 rule](../gate-map.md)), thirteen moves measured on a scratch copy
of the tree at the commit that added it. Add a record and do not regenerate → **red, exit 1**, *out of
date*. Edit a record's **prose** and do not regenerate → **green**, and deliberately so: the index
carries a title, a path and a type, all of which come from the record's *name* and one field, so it
goes stale on the record **set** rather than on record content — which is what keeps an ordinary edit
from churning a generated file. Lower `lines` below the store → **red**, *over budget*, naming the
overage. Note that this red arrives **with** an *out of date* alongside it until the index is
regenerated, because the header states the **line** budget: a change to that one number stales the
artifact it governs, so a raise of it cannot land without touching the generated file too. **That
property is the `lines` axis's alone** — measured, not assumed: lowering `columns` and lowering
`kilobytes` each produce a single budget red with no staleness beside it, because neither number is
written into the index. Lower `columns` under the longest line → **red**, naming the line and its
width. Lower the store's `kilobytes` under 88.8 → **red** on the axis the index cannot see. Make a record's heading disagree
with its filename → **red**, both spellings quoted. Delete the committed index → **red**, *declared and
absent*. Set a budget to `0` → **exit 2**, refused rather than read as undeclared. Site the index
inside its own store → **exit 2**. Delete the generator → **exit 2** from the wrapper. Drop a third
`workspace.json` into the tree → **exit 2**, the list disagreeing with the audit. Take `node` off the
`PATH` → **exit 2** from the guard. Clean tree at both ends → **green**.

**The handoff series joined this check at Workspace Definition 2.5**, and it gets its own eight moves
rather than inheriting the ones above — the machinery is shared, the two derived fields are not. Add a
handoff and do not regenerate → **red, exit 1**, *out of date against the series*. Delete the committed
handoff index → **red**, *declared and absent*. Strip a handoff's `# ` heading → **red**, naming the
file and the missing heading, **and nothing is written**: a title the generator would have to invent is
the one thing a generated file must not contain. Rename a handoff so its filename carries no date →
**red**, a *different* check with a different repair, because the first is fixed by editing the file and
the second by renaming it. Edit a handoff's prose without touching its heading → **green**, the same
deliberate property the store's index has: a line is a date, a title and a path, so the index goes stale
on the series' **membership** rather than on a session's wording. Site the index inside
`slots.handoffs` → **exit 2**, and `doctor` red beside it, which is two enforcers of one siting rule
and neither redundant — the generator physically cannot render a series it would be a member of, while
`doctor` is what catches a hand-placed file the generator never saw. Declare `handoffs` with no
`slots.handoffs` → **exit 2**, and `doctor` red. And the eighth, which is the one worth knowing:
**declare a budget on the handoff index → `doctor` RED**, `unexpected property `budget``, because the
schema sets `additionalProperties: false` and 2.5 deliberately gives that object one key. The argued
absence in [`../../spec/slots.md`](../../spec/slots.md) is therefore enforced rather than merely
explained — a workspace cannot quietly acquire the rail whose every legal remedy is barred.

The `proposal` check was added 2026-07-28, at milestone 5, against a sentence
[`../../core/operating/evolution.md`](../../core/operating/evolution.md) had carried since milestone 1:
a rule change is a *proposal as a pull request*. All fourteen had arrived that way and none recorded
which one — the fifth time here that a stated rule turned out to bind nothing. **Red-first against the
real tree**, which is the strongest form this repository asks for: all fourteen failed, and the
pointers were then resolved **mechanically** — the commit that added each file, then GitHub's own
commit→pull-request mapping, which resolves rebase-merged commits (measured: `5f1a91b` → `#73`) —
rather than reconstructed from anyone's memory of which pull request that was.

Its observation procedure ([the 0007 rule](../gate-map.md)), seven moves measured on a scratch copy of
the tree at the commit that added it. Control → **green**, three lines naming 15 examined. Delete one
proposal's pointer → **red, exit 1**, naming that file alone. Replace the URL with a bare `#8` →
**red**: the URL shape is asserted deliberately, since `#8` is also how this repository writes an
issue reference. Rename a `**Decision.**` field → **red** on the outcome check while the other two stay
green, which is what keeps the three repairs distinct. Drop a `notes.md` beside the proposals → **red**
as a stray, and the two field checks still run and still report 15. Leave **only** the stray → **two**
reds, the stray named and *neither field check could run* — not exit 2, because the diagnosis had
already been made. Empty the directory entirely → **exit 2**, and printing no verdict line before it.
Those last two orderings are 4b′'s lesson reused rather than re-learned: report a finding before a
precondition that would hide it, and report nothing at all when there is nothing to find.

The `plan` check was added 2026-07-29 by the post-M5 reconciliation, and it is the first rail here that
binds **retroactively**. The measurement that produced it: the twelve milestone rows held **63,420**
characters, of which only 11% was criterion — 17k of amendment argument, 6.6k of session notes, and
~32k of Status, one cell of which (milestone 4) was **16,505 characters on a single line**. The
reconciliation moved **55,643** characters into `docs/milestones/mN.md` verbatim and left 10,565 in
the table; the rail is what makes that a state rather than a moment.

Its observation procedure ([the 0007 rule](../gate-map.md)), seven moves measured on a scratch copy of the
tree at the commit that added it. Control → **green**, three lines each naming 12 rows examined. Type
`**Criterion amended with Marius, …**` back into milestone 9's row → **red, exit 1**, naming
`docs/plan.md` and the line. Type a session note back in the `(Session 0 of 1–2, …` spelling → **red**;
type it in the lowercase bullet-led `· session 1 of 1–2, …` spelling **milestone 3 actually used** →
**red as well**, which is the move that justifies matching the shape rather than one punctuation: a rail
written to the first spelling alone would have reported green over 4,126 characters of the table it was
minted from. Grow a Status cell to **501** bytes → **red**, naming the milestone and both numbers;
at **500** it is green, so the boundary is measured rather than assumed — and it is measured in the
unit the check actually counts, which took a fourth round to get right: the budget said *characters*
in four carriers while `awk`'s `length()` was counting bytes, so every printed number was one a reader
could not reproduce. Post-split the largest Status cell is **387 bytes** against 385 characters. Put an escaped `\|` inside a
613-byte Status cell → **red**, naming the row and the field count it got instead of seven. That
last one was a fail-open the pre-commit supervisor found *inside the change that added this rail*: the
budget reads the Status cell as the sixth pipe-separated field, so a row it cannot split simply fell
out of the loop and passed — a 613-byte cell green, under a summary line still claiming twelve
rows examined. Now the unparseable row is a refusal in its own right and the budget's line reports how
many rows it could **read** rather than how many exist, which is `record` 4c's discipline reused:
a check may not borrow its coverage number from a different question. Remove the milestone rows
entirely → **exit 2**, `no milestone rows found`, because enumerating the table is a precondition and
four checks reporting ok over zero rows is the false green this recipe has minted rules about.

**The negative half was demonstrated too, and it is the half that decides the scoping.** Both markers
exist in this tree, legitimately, outside the milestone rows: `[Ss]ession [0-9]+ of` matches **8 Session
log entries**, and **8 of the 12 files in `docs/milestones/`** contain `**Criterion amended` — because
that is the relocated argument, which is the whole point of them. A file-wide grep for either would have
redded the archive this same change created, on its first run. Anchoring both patterns to a
milestone-row match — `^\| *[0-9]+ *\|` — is therefore not tidiness; it is the difference between a
rail and an unusable one, and the green above is over a tree where all sixteen of those matches are
present.

### The scheduled librarian's observation procedure

Not a verify recipe — [`../../cli/librarian.mjs`](../../cli/librarian.mjs) renders no verdict and has
no exit 1 — but a **watcher**, so [`0007`](../proposals/0007-every-watcher-ships-with-its-observation-procedure.md)
binds it. Measured on a scratch clone whose final commit is this change, so every file is tracked and
dated as it will be after the merge.

Run twice on an unchanged store with the same `--as-of` → **byte-identical** handoffs. That is the
no-churn claim measured rather than argued: the record carries dates, never *N days ago*, so its diff
moves only when the store or a threshold does. Every threshold lowered to 1 day → all three nags fire
together — 23 records stale, 5 proposals nagged, and in the demo workspace the **one** sealed rule due,
naming its owner and the date it was sealed. Against the real thresholds (90 / 180 / 30) → **nothing
fires, and every section says so in those words**, which is the point: a store five days old has
nothing stale in it, and a pass that reported otherwise would be tuned rather than true.

**Three refusals, each measured:** a shallow clone → **exit 2** naming shallowness, because
`actions/checkout` is shallow by default and every record would otherwise read as undated; a threshold
of `0` → **exit 2**, refused rather than read as undeclared; a directory git has never seen → **exit
2**. And one **non**-refusal that was a refusal for an hour and should not have been: an *uncommitted*
record is reported as undated and never stale, with the count printed. The first draft refused it, and
the first thing it refused was a proposal this session had just written — which turns `tests.sh` red on
a correct tree and makes a verify recipe depend on git history, the one thing the split between this
pass and the recipes exists to prevent. Found by running the pass, not by reading it.

### The forced-red drills — which rails have been seen to fire

Everything above this line was gathered **locally** — recipes forced red at a desk, which is where a
check earns its design, and one watcher's observation procedure beside them. This subsection is the
other seam: which rails have been observed red **in CI, on a pull request**, where the block actually
happens. Milestone 8's amendment asks for *scheduled forced-red drills — every
rail forced red on a calendar and required to fire*; the calendar is that milestone's, and this is the
register it writes into, opened with one drill run ahead of it because the survey below found it nearly
empty.

**The survey, 2026-07-30.** [`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml)
is the only workflow that has ever run a recipe, and it has failed **5 times in 416 runs**. Read from
the check-run annotations rather than counted by eye — a red job carries a
`verify recipe <id> exited <n>` annotation, which is the one place the failing recipe is named
mechanically:

| Run | Date | Recipe | What it was |
|---|---|---|---|
| [`30129932310`](https://github.com/sleepy-panda-srl/portulan/actions/runs/30129932310) | 2026-07-24 | *none* | `actions/checkout@v4` refused for not being SHA-pinned — the job died before the loop |
| [`30398437030`](https://github.com/sleepy-panda-srl/portulan/actions/runs/30398437030) | 2026-07-28 | `docs` | `FAIL proposal — 1 proposal(s) name no pull request` |
| [`30445601122`](https://github.com/sleepy-panda-srl/portulan/actions/runs/30445601122) | 2026-07-29 | `docs` | the same, on the next branch to add a proposal |
| [`30530100431`](https://github.com/sleepy-panda-srl/portulan/actions/runs/30530100431) | 2026-07-30 | `docs` | `FAIL links — 1 unresolvable relative link(s)` |
| [`30530283558`](https://github.com/sleepy-panda-srl/portulan/actions/runs/30530283558) | 2026-07-30 | `docs` | the same link, after the first repair missed it |

**So on the morning of 2026-07-30, one rail of eight had ever been seen to fire, and none had been
fired on purpose.** The two `proposal` reds are the anticipated one Known limits below already
predicts — a proposal's pointer cannot exist before its pull request does — and the two `links` reds
were a genuine defect caught in flight, a local false green on a path that exists in a working copy
and not in a clean checkout. Neither is a drill. A rail nobody has watched fire is a rail nobody has
seen work, and seven of the eight were in that position.

**Drill 1 — `tests`, 2026-07-30.** Run on
[#118](https://github.com/sleepy-panda-srl/portulan/pull/118), branch
`drill-the-tests-rail-fires-the-block`, opened as a draft and **closed unmerged**; the branch carried
nothing but the drill and was deleted after. Forced in **both** directions in two pushes, because a
rail that only ever reds proves nothing about its green — a recipe hard-wired to fail would have
produced the identical red transcript.

| Push | Tree | Result |
|---|---|---|
| `45c931b` | `cli/drill.test.mjs` asserting `1 === 2` | run [`30532642890`](https://github.com/sleepy-panda-srl/portulan/actions/runs/30532642890) → **failure**, annotation `verify recipe tests exited 1` |
| `f89ed35` | the same file deleted, nothing else moved | run [`30532774286`](https://github.com/sleepy-panda-srl/portulan/actions/runs/30532774286) → **success** |

The red job's `tests` group, quoted:

```
##[group]tests — ./.portulan/verify/tests.sh
tests: 8 test file(s) found
...
not ok 29 - forced-red drill: the tests recipe reports a failing assertion
    error: |-
      Expected values to be strictly equal:
      1 !== 2
    location: '/home/runner/work/portulan/portulan/cli/drill.test.mjs:24:1'
...
# tests 675
# pass 674
# fail 1
##[endgroup]
##[error]verify recipe tests exited 1
```

and the green job's, one line, which is the whole control: `tests: 7 test file(s) found`.

**The block, read at the red head.** `gh pr view 118 --json mergeStateStatus` reported **`BLOCKED`**,
and it went to `CLEAN` on the green push. Four things that transcript settles, each one an inference
before it:

- **The block came from this rail alone.** The full rollup at `45c931b` was `workspace-verify FAILURE`,
  `pr-labeled SUCCESS`, `copilot-reviewed SUCCESS` — so nothing else was holding the merge, and
  `BLOCKED` is attributable to one failing assertion in one test file.
- **`mergeable` is not the field to read.** It said `MERGEABLE` at the same instant `mergeStateStatus`
  said `BLOCKED`: it answers *does this conflict*, never *may this merge*.
- **A draft pull request reports the real merge state.** `mergeStateStatus` never returned `DRAFT`
  despite `isDraft: true` on both reads — the draft flag lives in `isDraft` and that field tracks the
  checks. GraphQL's enum has a `DRAFT` member, which is why this was worth measuring rather than
  assuming: a drill can be run start to finish inside a draft and still read the block it is drilling.
- **A red recipe does not abort the loop.** `plugin` ran in the same job immediately after the
  `::error::`, which is [`verify.yml`](../../.github/workflows/verify.yml)'s `set +e` observed rather
  than read. Every declared recipe reports on a run where one of them is already red.

**What the drill does not establish**, stated because `BLOCKED` is easy to read as more than it is: no
merge was *attempted*, so what was measured is GitHub's own answer about whether the merge is
available, not a refusal provoked at the API. Attempting one is barred anyway — the maintainer merges
([`../gate-map.md`](../gate-map.md)) — and what stands behind that last inch is `enforce_admins: true`
on the live protection, which no pull request can demonstrate about itself.

**The register, after drill 1.** **Eight** rails have still never been observed red in CI — the count
moved because this repository declared a tenth recipe, and a register that did not move with it would be
the stale-carrier defect inside the page that keeps the register:

| Seen to fire in CI | Not yet |
|---|---|
| `docs` (2026-07-28, incidental) · `tests` (2026-07-30, drill) | `json` · `doctor` · `plugin` · `compile` · `workflow-filters` · `index` · `control-chars` · `rule-carriers` |

**`rule-carriers` joins the right-hand column on the day it lands too**, and like `control-chars` it has
been forced red locally rather than in CI — exit 1 on a planted restatement, and exit 2 three ways on a
dead tell, an absent carrier and an unparseable registry.

`control-chars` joins the right-hand column on the day it lands, and it is worth saying that it has been
forced red **locally**, four ways — a NUL reproducing the original incident, a CRLF, a dead exemption and
a stale one — with `grep` and `file` observed missing the first of them on the same file in the same
run. Local is not CI, which is the distinction this whole register exists to keep.

That gap is narrower than it looks in one respect and not in another, and both halves matter to
whoever sets the calendar. Every recipe this workspace declares runs through the **same** loop in the
**same** job, so the shared half of the seam — a non-zero exit becoming `status=1`, becoming a failed
check, becoming `BLOCKED` — is now covered twice by two different recipes and does not need covering
once per recipe. What is *not*
covered is anything recipe-specific about running under CI, and this page already documents three
places that bites: **the runner's checkout WAS shallow, so anything reading `git log` refused or lied —
and since [#265](https://github.com/sleepy-panda-srl/portulan/issues/265) the verify job sets
`fetch-depth: 0`, because the `pack-version` recipe reads a diff and cannot answer its question without
one.** The hazard has not vanished, it has moved: it now bites any *other* workflow whose checkout is
still shallow, and it returns the moment someone removes that setting to speed a job up;
`doctor` resolves claims against the filesystem, so a gitignored path is a permanent false red there
and green everywhere else; and the two `links` reds above exist precisely because a clean checkout is
not a working copy. Those are per-recipe facts, and a drill is how each one stops being a guess.

**One of those three is now closed, and the sibling beside it is not.** `links` stopped asking the
filesystem on 2026-07-30 ([#121](https://github.com/sleepy-panda-srl/portulan/issues/121)) — it
resolves against the tracked set, so it answers the same question here and in CI, and the two reds above
could not happen again. `doctor`'s claim resolution is the **same class pointing the other way** — a
false *red* rather than a false green — and it is deliberately not fixed in the same change: it lives in
a tested JS tool with a different repair, and bundling it would have put an unforced rewrite inside a
milestone-close diff. Filed as [#131](https://github.com/sleepy-panda-srl/portulan/issues/131) rather
than left as a symmetry a reader has to notice, on the rule the same change minted:
[`a-recorded-limit-is-not-a-managed-limit`](../memory/a-recorded-limit-is-not-a-managed-limit.md).

## Known limits

- **The librarian's record is not byte-checked, and nothing can check it.** Every other generated file
  here is byte-compared by a recipe — `memory-index.md` by `index`, the compiled artifacts by
  `compile`. The pass's handoff is the first committed artifact in this repository that a machine
  writes and no rail verifies, and the reason is not shallow checkouts: its content is **time**
  dependent, so a record crossing a threshold changes it with no change to the tree, and a
  byte-compare would go red on a store nobody touched. What stands in for a rail is that it is a
  *dated* record rather than a current-state claim — a handoff, like the thirty-four beside it, true
  as of the date in its own filename and never re-derived. One consequence worth knowing: because
  `docs.sh` walks every tracked `.md`, a later change that deletes a record the pass's handoff links
  goes red on `links` until the handoff is edited. That is a partial accidental rail and a small churn
  tax on unrelated changes, and both halves are stated rather than only the flattering one.
- **A new proposal's pointer cannot exist before its pull request does**, so `proposal` is red on a
  branch that adds one until the number is known. The red is accurate — nothing has filed it yet — and
  it costs no extra push in practice, because [`a-review-loop-needs-a-bound`](../memory/a-review-loop-needs-a-bound.md)
  rule 2 already lands the records last, and the pointer rides that push.
- **Anchors are not checked.** A link to `file.md#section` verifies only that `file.md` exists. Checking
  fragments needs a heading parser, and the failure it would catch is milder than the one it would add:
  false reds train people to stop trusting the recipe.
- **External URLs are not fetched.** Deliberate. A verify recipe that needs the network fails for reasons
  unrelated to the change under test, and a flaky gate is worse than no gate.
- ~~**Link targets are matched by the filesystem's rules, not GitHub's.**~~ **Closed 2026-07-30**, by the
  repair this bullet named: `links` resolves against `git ls-files --cached` and compares byte-exactly, so
  `Core/engine.md` for `core/engine.md` is now red on every volume. Kept struck through rather than deleted
  because the interesting part is the shape — it was recorded as a known false green, sat that way for
  three days, and was closed only when an unrelated instance of the *same class* made someone go looking.
  A limit written down is not a limit managed.
- **A `%`-encoded target is a false red, and a nested-parenthesis target is not fully read** —
  [#130](https://github.com/sleepy-panda-srl/portulan/issues/130). Both are in
  the extraction rather than the resolution, both predate the 2026-07-30 domain change, and both were found
  by a fresh context attacking that change rather than by a run — no path in this tree reaches either. A
  target written with `%20` where the file has a space reds, although a renderer decodes the escape and
  finds the file; and a target containing parentheses is read only as far as the first closing one, because
  the extracting pattern is not balanced-paren aware. Both are **described rather than written out here**,
  and that is the third finding: the first draft of this bullet spelled both targets as real link syntax
  and turned the recipe red on its own documentation, because this check scans raw text and backticks
  exempt nothing — the same trap [`a-generated-file-must-not-point-at-what-git-cannot-carry`](../memory/a-generated-file-must-not-point-at-what-git-cannot-carry.md)
  records two drafts of itself falling into. Decoding percent escapes is a small fix, deliberately not
  bundled into a milestone-close diff; the parenthesis one needs a scan the pattern cannot express, which
  is the same reason anchors are not checked.
- **Code spans are not treated as code.** The `links` check scans raw text, so it neither skips fenced
  blocks and inline spans nor looks inside them. That cuts both ways, and both were observed the same
  day: a path written as a code span is never validated (two dead pointers in the plan survived several
  reviews that way), and Markdown link *syntax* quoted inside a code span — while writing about this
  check — is treated as a real link and fails. Skipping spans needs a small parser; until then, write
  paths as links when you want them checked, and avoid quoting link syntax verbatim.
- **`record` corresponds by date, not by session, and counting only narrows that — it does not close
  it.** Two sessions closing on one day are still satisfied by one handoff: the milestone-3-close
  session of 2026-07-27 has a Session log entry and no handoff of its own, and 4a cannot see that,
  because the dependabot handoff shares the date. The counting direction has its own two:
  **an extra entry on a date offsets a missing one** — log two entries for one session and a second
  session's handoff goes uncounted — and **a session spanning midnight reds honestly but wrongly**, its
  handoff on one date and its entry on the other. The first is a real hole; the second is a false red
  that a reader can resolve in one look, which is the direction to err in. **The convention change that
  unblocks the per-session version has now landed**: an entry must link its handoff, so the tight rail
  is a grep over entry bodies rather than a rule nobody agreed to yet. It is not written, and until it
  is, this is the limit. And the seam half checks that the newest entry *contains* an attestation, never
  that the attestation is honest — a false "seam scan clean" passes exactly as a true one does.
- **The entry parser reads a line, not a document.** An entry is delimited by a line *starting* with
  `- YYYY-MM-DD ·`, so quoting that shape unindented inside an entry splits it in two — and a 20-line
  entry can pass all-green that way, its phantom half dated before the cutoff. Found by a supervisor
  probing the parser rather than the record. It is left as a limit rather than fixed, because the fix is
  a Markdown parser and the trigger is malformed quoting of the log's own syntax inside the log; an
  unknown date invented that way still fails 4a visibly. Same family as the `links` check not treating
  code spans as code, recorded above.
- **The stray-file audit stops at `*.md`.** A `notes.txt` in `../handoffs/` is not examined — so a
  directory holding only non-Markdown files is *could not run* rather than a finding, which is correct
  but worth knowing before reading that exit 2.
- **The entry budget counts lines, which is not the thing anyone cares about.** Ten lines of dense
  pointer and ten lines of padding score the same, and an entry can satisfy it by moving prose into a
  handoff nobody reads. It is a rail against unbounded growth in the file every session loads to boot,
  not a measure of whether an entry is any good — condition 2 of [`../dod.md`](../dod.md) still owns
  that and still cannot be mechanised.
- **`index` checks what memory costs, never whether it is any good.** Derivation and size are
  machine questions; whether these lines lead a reader to the right record is not, and no green here
  should be read as answering it. That is an eval question (milestone 8) and a naming question for
  whoever writes the records.
- **Nothing refuses a budget RAISE, and that is the row's own repair being un-railed.** The rule is
  that a breach is answered by consolidation and never by widening the number in the same change
  ([`../../core/operating/memory.md`](../../core/operating/memory.md)). Refusing it needs a check that
  reads git *history*. **That used to be the end of the argument — history checks false-red in a shallow
  CI checkout — and since [#265](https://github.com/sleepy-panda-srl/portulan/issues/265) it is not:
  the verify job sets `fetch-depth: 0`, and `pack-version` is a history-reading recipe running in it.**
  So the ground this refusal stood on is gone, and what remains is smaller and worth stating plainly: no
  such check has been *written*, and [#75](https://github.com/sleepy-panda-srl/portulan/issues/75) is
  the open issue for it — now reachable rather than blocked. Measured rather than argued: with the budget
  raised from 14 to 18 on a twelve-record scratch store, the recipe goes **green**, exactly as it does
  after a real consolidation. So the breach is a rail and the remedy is a human-gate rule. What stands
  behind it is thin and worth stating exactly: a raise of the **`lines`** budget also stales the index,
  so it drags the generated file into the same diff and is visible twice. A raise of `columns` or of
  the store's `kilobytes` does neither — neither number is written into the index — so those two land
  in the manifest diff alone.
- **The store walk is flat, and nothing enforces that it should be.** Both `index` and `doctor` read
  `slots.memory` non-recursively, so they agree about what the store contains — but records moved into
  a subdirectory of it leave the index, the KB budget and the store report together, in silence. No
  workspace does this today; the plausible accident is an `archive/` directory arriving with the
  librarian's demotion drafts at milestone 5, session 1, which is why it is written down now rather
  than discovered then. **Still open as [issue #76](https://github.com/sleepy-panda-srl/portulan/issues/76),
  and milestone 6 session 1 deliberately did not settle it:** the per-persona scope layer that arrived
  with Workspace Definition 2.6 is a second store, and siting it *inside* `slots.memory` would have been
  the cheapest thing to build and would have made this limit load-bearing — a nested store railed by a
  budget the walk cannot see. It is sited outside instead, so #76 stays a question about the store rather
  than a decision taken as a side effect of an unrelated feature.
- **The scope layer has no budget, and a declared location is never required to exist.** An absent location
  is the normal state — git carries no empty directory, so a fresh clone has the index and no directories —
  and `index --check` passes over it. What it does check: a location that exists and cannot be *enumerated*
  is exit 2 rather than reported empty (empty is this feature's success state, so the confusion would read
  as the design working); **anything** under `slots.personas` that no composed pack declares is reported,
  a stray file as much as a stray directory; and a pack that ships records of its own is refused. What it does not do is count or size what an adopter puts there: nothing
  recalls from these locations yet, so a rail would be measuring a store no code reads. The axis such a
  rail should use is per-persona rather than per-workspace, and that belongs to the row where something
  finally reads them.
- **A base-suite figure cannot be measured from `git archive`.** Comparing "suite before" against "suite
  after" wants the tree at the base commit, and the obvious way to get one — `git archive <sha> | tar -x`
  — produces a **false red**: several suites bind this repository's *live* workspaces and read git, so a
  tree with no `.git` fails on the wrong thing and looks exactly like a regression. Clone to a scratch
  directory and check out the base instead. Measured at milestone 6 session 1, by a fresh-context
  reviewer who hit it while re-deriving a figure this project's records had quoted — and it is the same
  class as `actions/checkout` being shallow by default, which is already written down one bullet's worth
  of trust further up.
- **A present-but-empty store is a green.** It renders an index of `0 record(s)`, which matches a
  committed index of the same, and passes. That is correct — a workspace may legitimately have no
  memory yet — and it is the closest relative of the enumeration fail-opens above, so it is named:
  what is refused is a store that cannot be *read*, not one that is empty. Emptying a populated store
  still cannot pass quietly, because the index goes stale first and the regenerate that clears it is a
  diff deleting every line.
- **Nothing here checks prose quality**, and nothing can. Conditions 2–4 of [`../dod.md`](../dod.md) are
  human judgement and are meant to stay that way.
- **`doctor` checks form, never truth.** A path that resolves, a manifest that conforms, a provenance
  stamp that parses. It cannot tell whether the document at the end of a path still says something
  accurate, and a fabricated sealed stamp passes exactly as a real one does.
- **The claims lint reads only what parses confidently as a path** — a token containing `/`, taken from a
  code span or link target. Prose is not parsed and not failed, deliberately: an ambitious parser here
  would produce false reds, which is the failure that gets a whole recipe switched off.
- **On a build/test/run line, FAIL is reserved for a candidate that IS a path.** `./verify.sh` absent is
  a failure. A **command** — `dotnet run --project src/App` — only contains tokens that might be paths,
  and those are **reported, never failed**: nothing can tell an input path from an output path not built
  yet, a flag value, a `sed` expression or a glob. A line with nothing path-shaped is counted and
  reported too, so nothing is dropped in silence — which it was, until the third real workspace's card
  exposed it. The first attempt at fixing that failed command tokens outright and produced false reds on
  `go test ./...`, `cc -o bin/app src/main.c` and `--project=src/App` with the directory present. Caught
  in review before it reached anyone's onboarding.
- **Claims resolve against the filesystem, not against git — so an ignored path passes locally and fails
  in CI.** A repo card naming a runtime directory that `.gitignore` excludes resolves in a working copy
  where the application has created it, and does not exist in a clean checkout. CI is always a clean
  checkout, which makes it the **stricter** environment and the one to believe. Stated as a cost rather
  than a safety, though: for a card that truthfully describes a gitignored runtime directory this is a
  **permanent false red in CI**, not a caught defect. Found by running `doctor` in a fresh worktree
  rather than the working copy it had always been run in.
- **`plugin.sh` does not check the platform's contract, and a green from it is not a green from
  `claude plugin validate`.** It checks this repository's own invariants about its packaging. Measured
  the day it was written: this repository's `plugin.json` declared `"agents": ["./plugin/agents/"]`, the
  lint said GREEN, and the first-party validator refused the file. Run both. **And note where that
  ended**, because the obvious repair was wrong: the explicit `.md` form the validator wanted is a form
  the *runtime* never loads, so the plugin then passed both checkers with three inert personas until an
  install counted them ([`../memory/a-manifest-field-can-validate-and-load-nothing.md`](../memory/a-manifest-field-can-validate-and-load-nothing.md)).
  Neither checker was wrong about what it owns. Running both is still not the same as installing it.
- **`filters` runs `jq`; the workflows run gojq.** `gh api --jq` evaluates the filter with the
  re-implementation bundled inside `gh`, not with the binary on the `PATH`. So the check establishes
  these programs' behaviour under jq 1.7.x — the interpreter every contributor has, and the one the
  answer given on #63 was measured with — and a gojq divergence on them is not covered. Covering it
  would mean installing a second interpreter, which is the line [`../identity.md`](../identity.md)
  holds. `pr-labels.yml`'s `jq -er` call is the real binary, so that one program is exact.
- **It reads `run:` scalars, and jq programs written as a single-quoted argument.** A folded `run: >`
  is refused outright; a program built in a variable, double-quoted, or spanning lines is not
  extractable. None of these is a silent miss: every jq token in the raw file must have been seen
  inside a parsed scalar, so a program this reader cannot lift makes the counts disagree and the
  recipe exits `2`. The audit counts tokens, though — a *second* program on a line whose first one
  parsed is caught, and a jq call hidden inside a string that the audit's own token pattern misses is
  the residue nobody has found a cheap check for.
- **It covers workflows, not every jq or awk program anyone runs — and the two halves are not
  symmetrical.** For **jq** the claim is strong: nothing else in the tree executes it today, the
  remaining occurrences being commands in prose that a person types
  ([`../gate-map.md`](../gate-map.md), [`../tools/README.md`](../tools/README.md)). For **awk** it is
  plainly false — [`docs.sh`](docs.sh) alone invokes it sixteen times, and
  [`../../cli/control-chars.mjs`](../../cli/control-chars.mjs) does too. Those are covered where they
  live, by their own recipe and by the suite, and **not** by this one. The audit looks only inside
  [`../../.github/workflows/`](../../.github/workflows/), so a script under [`../tools/`](../tools/)
  that grew a filter — of either kind — would be covered by nothing and nothing would say so. _Stated
  after Copilot pointed out on #290 that widening the sentence to `awk` had made it untrue; the
  measurement is the repair, not the wording._
- **`node --test` given a glob matching nothing exits `0`.** A green suite that ran nothing. `tests.sh`
  counts the files first for that reason, and the count and the glob deliberately cover the same set —
  a recursive `find` beside a non-recursive glob would let a test be counted and never run.
