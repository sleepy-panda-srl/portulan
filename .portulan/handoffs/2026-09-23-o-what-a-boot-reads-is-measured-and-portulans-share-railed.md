# Handoff — 2026-09-23: what a boot reads is measured, and Portulan's own share is railed

**What landed.** [`cli/context.mjs`](../../cli/context.mjs) is proposal `0036`'s measurement module and
[`../verify/context.sh`](../verify/context.sh) its recipe, items 3 and 6 of its order of work; item 6's
first named demotion landed in #432, and the Stop-gate's is its own change. For any workspace the module
prints every file a boot reads in full (the boot skill and the kernel, the manifest, the slots `identity`,
`principles`, `constitution`, `gates` and `dod`, the card naming this repository, the memory index, and the
skill's packs step where the manifest names a pack) and every file Claude Code loads into every context in
the repository named by `tree` (instruction files and their imports to the host's five hops, unscoped rules,
and project skill, command and agent descriptions), each with bytes, tokens and why it counts, then what it
leaves out and why. The Portulan plugin's own descriptions are printed beside the repository's always tier
and not in it, because an adopter cannot slim them. The recipe runs it over both workspaces and rails
Portulan's own footprint; CI runs it because the manifest declares it, and
[`cli/drills.mjs`](../../cli/drills.mjs) carries its drill.

**Measured, and the method's one change.** The boot also reads the manifest whole, at step 2, and the
day's earlier figures (213,002 at `0036`, 211,673 on `0f3ec58`, 95,602 after #437, 92,895 after #439,
92,906 after #440, 92,998 after #443) left it out. The output prints both. Before the rebases past #439,
#440 and #443, the subtotal without the manifest reproduced 211,673 on `0f3ec58`, 95,602 on `74a2a31` and
the demo's 36,195. On main at `a534f15` it reproduces #443's 92,998 and 33,591: this repository's nine
files are 86,717 bytes, 92,998 with the packs step its boot reads, and 100,053 with the manifest; the
demo's total is 35,393. So the jump is the manifest, not growth. The engine half is 11,825 bytes, the
skill's two step files 10,729, and the plugin's seven skill and three agent descriptions 3,386,
reproducing `0036`'s figure.

**The rails.** They were set on main at `a534f15`, with this change's own recipe entry in the manifest,
after first being set on `d9ddc84`: #439 split the skill, #440 added 11 bytes to the kernel and #443 added
92 to the skill, so the engine went from 20,710 bytes to 11,825. Each is its figure there plus 2%, rounded
up: this workspace's boot 102,055, the demo's 36,101, the engine 12,062, the step files 10,944, the
descriptions 3,454, one line each at the top of the recipe. The step files are railed together, whether or
not they apply here, because no workspace in this tree is a pointer, so no read-set rail would see
`pointer-manifest.md` grow. Counting the packs step and railing the step files were the coordinator
session's calls, made on the maintainer's delegation at 18:05 UTC: the first keeps the figures comparable
with #439's method, and the second is the only rail that sees the pointer step. The report says when a
rail's headroom passes 5% and gives the figure to lower it to. **Whoever merges a tiering change lowers
the rail line in the same pull request**, or its gain is not locked in. A rail is raised only with its
reason in the handoff of the change that raises it.

**The key and the ratio.** The budget and ratio are read as the doctrine change names them,
`context.always.budget.tokens`, `context.ratio.bytes_per_token` and `context.ratio.calibrated_by`, through one
accessor; absent, the run is a report with `init`'s offer, the larger of 8,000 tokens and today's load.
Every level is held to spec 2.9's shape, so a key missing its ratio, of the wrong type, or with a name the
shape does not define exits 2, rather than reading as absent and switching a budget off; the slug pattern
of `calibrated_by` stays the schema's. With no key declared, tokens use `0036`'s 2.99 estimate and the
output says so. The exact mode, which asks the host, is a later change.

**A limit of this change: a pointer is not measured.** Its workspace is resolved from the host's install
records, which a recipe must not read, so the module exits 2 with that reason and names what to measure
instead: the workspace `cli/discover.mjs --json` resolves it to. That figure leaves out the pointer
manifest and the pointer step, which a boot through the pointer also reads; the step is railed with the
other step file here. Measuring through a pointer, on demand and outside any recipe, belongs with the
exact mode. A manifest of no governing kind exits 2 as well: the boot reads no slot of it.

**Readers.** `payload.mjs` classifies the module `product` on `0036`'s text, since it lands before `doctor`
imports it; `cli/README.md` carries its rows, roster name and the count that moved; `verify/README.md` its
row, and the run-list gained it and the four recipes it already lacked (`ab`, `ab-grade`, `ab-run`,
`release-eval`), a sweep allowed only because that list's own `0020` note requires it complete.

**How it was checked.** 45 cases in [`cli/context.test.mjs`](../../cli/context.test.mjs), all but three
over a temporary workspace, bundle and repository, so no figure in them moves with this tree: the boot's
order, the card rules, the packs step where it applies, the step files railed where they do not, every
exit 2, imports in code, past five hops and outside the tree, links out of the repository, rules scoped
by `paths:`, descriptions the host does not list, budgets and rails either side of their line. The three
over this tree check the listing against the files on disk, the required slots against the schema, and
that every file of the boot skill is the skill, a step file the measure counts, or its on-read
rationale, so a later split cannot add a step the measure misses. The drill was run and fired, `exit 1 ·
said "over its rail of"`.

**Copilot's two rounds.** The first, on the first head, found two ways a malformed input read as green,
a `context` key of the wrong shape and a `--rail` past exact integers. The second, on `51970ea`, found
seven more ways an input could read as less than the host loads, or reach outside the tree: a file it
could not stat read as absent, slots missing or malformed, a tree naming no directory, and links out of
the repository or the plugin's bundle followed and read. All nine are refused or named now, with cases,
and a link out of the repository is named beside the imports outside it and never opened. Its eighth
finding, that a boot reads `cli/recipe-set.mjs`, does not hold: step 3 links the module that yields the
set, and the set a boot reads is the manifest's `verify.recipes`, counted with the manifest, and the
packs step, counted where it applies.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38: no fresh-context runs unless he asks. The
coordinator session reviewed the diff before the first commit, and approved the two changes the rebases
brought before they were pushed; his review is on the pull request.

**Green in this container needs a non-root run.** As root, `tests` fails its permission cases, because a
chmod-000 fixture never denies root. All 28 recipes ran green as a non-root user on a copy of this tree.

**Next action.** His review of the pull request. Then `0036`'s next items: the `doctor` report and the
boot's closing figure, which call this module with no configuration, and the exact mode.
