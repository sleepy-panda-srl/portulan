# 2026-09-01 — the payload carried an experiment about itself

**Off the milestone row — packaging.** `cli/ab.mjs`, `cli/ab-run.mjs` and `cli/ab-grade.mjs` landed in
sessions 6b–6d and went straight into the npm payload, because `files` sweeps `cli/` and nothing asked.
They are now excluded by name. **89 files before, 86 after**, re-measured on the rebase onto `main`.

## What landed

Three `!` lines in `package.json`, the reasoning in [`../../cli/README.md`](../../cli/README.md)'s
payload section, and a `## Unreleased` → `### Changed` entry. No code changed; all 25 recipes green and
the suite at 2366, `ab`, `ab-grade` and `ab-run` included — the trio still runs as `node cli/ab.mjs`
from a clone, which is the only invocation this repository ever used it through.

## The argument I had to throw away, which is the reason to read this file

**The first draft argued that the three resolve their registers under `evals/`, which ships nothing, so
they cannot run — and that argument is both against recorded doctrine and false.**

Against doctrine: [`../../cli/eval-bundle.mjs`](../../cli/eval-bundle.mjs)'s `EXCLUDED_TOP_LEVEL.evals`
settled on 2026-08-24 that **the tool is product and the policy it reads is this team's** — `goldens`
ships without its corpus the way `compile` ships without `gates.json`. I wrote the inverse of a rule
already in the tree, in a file two directories away, and cited neither.

False: `node cli/ab-grade.mjs --stimuli` exits **0** from an installed tree with no `evals/`, no
`.portulan/` and no git — 5,326 bytes, byte-identical to the same command in the checkout. And "every
path constant is under `evals/`" was refuted by `TREATMENT_PATHS` and by three `path.join(cliRoot,
"cli", …)` resolutions to `doctor`, `vendor` and `compile`, all of which ship.

**What survives is parameterisation.** `goldens.readCorpus(repoRoot, dir = CORPUS_DIR)` takes its
directory as an argument; `ab.mjs`'s `DISPOSITIONS` takes nothing — the table is compiled into the
module, and pointed at an adopter's workspace `--check` exits 2 naming every disposition that matched
nothing. The rig has one subject and it is not the reader's repository. That is the whole case, and it
is narrower and truer than the one I started with.

**All four corrections came from the pre-commit checkpoint, in a context that had not written the
prose.** I had run the recipes, measured the pack, and installed the tarball — and still shipped a
paragraph whose central claim I had never executed. Measuring the mechanism is not the same as
executing the sentence, and this is the second half I keep skipping.

## What is not done, and is not mine to close

**The exclusion is narrower than its own criterion.** Thirteen shipped modules are reachable from
nothing the package exposes — the import closure of `portulan.mjs` and its eight subcommands, less the
two hook runners. Most are the `goldens` shape and the 2026-08-24 rule keeps them; **none has been put
the question these three were**, and whether any follows is the maintainer's call.

**Nothing derives payload membership, and I demonstrated it rather than asserting it:** staging a new
`cli/workshop-thing.mjs` into a scratch clone put it in the tarball with `pack-identity` green over 84
files. The module's *arrival* is railed by `cli-roster.live.test.mjs`; its payload consequence is not.
That is how these three got in, and it is unrepaired.

**[`../identity.md`](../identity.md)'s 76 is deliberately untouched** — that file re-measures at each
cut on a clean clone of the tag, and 76 is true of what it claims (the registry serves 76 for `0.1.2`,
and 73/74 for the two before, with no `ab*` in any). **The obligation that leaves has no carrier:**
there is no release checklist, so the next cut must re-measure or the figure is wrong by seven.

**The seam scan cost an hour it should not have, and the lesson is where I looked.** All three of
`feedback.mjs`'s locations are empty *by design* — [`2026-08-25-e`](2026-08-25-e-the-seam-guards-the-client-and-not-the-host.md)
records that the two things called *the term list* are different files and only one exists. `dod.md`
condition 5's list is a section of a file outside the repository, and **the pointer to it is the first
line of my own auto-memory**, which I did not read before searching the filesystem for a file that was
never going to be there. Scan run, control-verified, clean over diff + message + branch.
