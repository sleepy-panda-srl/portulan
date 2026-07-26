# Verify recipes

> The executable half of "done". Core defines the hierarchy — *it compiles < the tests pass < the
> behaviour was exercised* — and the Stop-gate contract that makes climbing it non-optional
> ([`../../core/operating/verification.md`](../../core/operating/verification.md)). A workspace supplies
> the recipes themselves, because what "green" means is a property of the repository.

## The recipes

Four, as of milestone 2. All are declared in [`../workspace.json`](../workspace.json), which is also
where the **default** is named — [`docs.sh`](docs.sh), the one the Stop-gate will run when nothing more
specific applies. Run any of them from anywhere in the tree:

```
./.portulan/verify/docs.sh
./.portulan/verify/json.sh
./.portulan/verify/doctor.sh
./.portulan/verify/tests.sh
```

| Recipe | Covers | Needs |
|---|---|---|
| [`docs.sh`](docs.sh) — default | links · kernel budget · repo map | `bash`, `git`, POSIX text utilities |
| [`json.sh`](json.sh) | every tracked `.json` file parses | the above, plus `node` |
| [`doctor.sh`](doctor.sh) | both workspaces validate: schema, paths, cross-references, claims against the tree, provenance | `bash`, `node` |
| [`tests.sh`](tests.sh) | [`../../cli/doctor.test.mjs`](../../cli/doctor.test.mjs) passes | `bash`, `node` |

Exit `0` green · `1` red · `2` could not run — and that third code is why each recipe declares its needs
in the manifest rather than discovering them: a recipe that *could not run* must never be mistaken for
one that ran and passed.

**The last two are wrappers, and the wrapper is the point.** Both delegate to `node`, and both check for
it first. `bash -c "node …"` on a machine without `node` exits `127`, which is neither a verdict about
the repository nor "could not run" — the wrapper is where that gets turned into a `2` deliberately.

**[`doctor.sh`](doctor.sh) names the workspaces it validates, and audits that list against the tree.**
Naming rather than discovering closes the enumeration fail-open recorded below: a scan finding no
manifests would run nothing and report green. But naming opens the mirror hole — a workspace *added* to
the tree and not added to the list is validated by nothing, and nothing says so. That was demonstrated
before it was closed: a third manifest dropped into the tree, and the recipe exited `0` having ignored it.

So the named list is what **runs** and a discovery pass **audits** it; disagreement in either direction
exits `2`. The ordering is the whole design. Discovery cross-checks and never decides, so it cannot
reintroduce the fail-open it was avoided for — a scan finding nothing now disagrees with a non-empty list
and fails loudly, where a scan that *drove* the run would have passed in silence. Fixtures under
`cli/fixtures/` are excluded by prefix, because they are broken on purpose and validating them would fail
by design.

`docs.sh` needs nothing beyond `grep`, `sed`, `awk`, `wc`, `sort`, `dirname`, and `mktemp`, and that is
worth preserving — a recipe that needs a toolchain is a recipe that stops being run.

**Why `json.sh` breaks that rule, deliberately.** Milestone 2 introduced the first JSON this repository
*depends* on rather than merely carries, and well-formedness is a parser's judgement: bash can only
approximate it, and an approximation would pass files it does not understand — a false green, which is
worse than no check at all. So the dependency was accepted for one recipe rather than smuggled into the
default, and the cost is stated in [`../identity.md`](../identity.md) instead of left for someone to
discover on a machine without `node`.

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

The claim is still bounded, and the bound was demonstrated within hours of being written. The suite
covers `doctor`: its schema subset, its exit codes, its parsers, its severity split. **Nothing tests the
recipes themselves** — `docs.sh`, `json.sh`, `doctor.sh` and `tests.sh` are verified by being run, which
is a weaker claim than it sounds. Every defect ever found in them was found by a human or a reviewer, and
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
| `links` | Every relative Markdown link resolves. | The engine is a web of cross-references between doctrine, templates, personas, and skills — progressive disclosure *is* those links. A dead link in a framework about context engineering is a product defect, not a docs defect. |
| `kernel` | [`../../core/engine.md`](../../core/engine.md) stays within 60 lines. | The always-loaded layer is the scarcest thing the framework spends, and the budget is constitutional. A budget that lives only in prose is the first thing a busy session negotiates with. |
| `map` | Every top-level entry appears in the root `README.md` layout table. | Agent legibility: a repository whose own map omits directories teaches an agent a false shape of the ground. This one exists because that had already happened — see below. |
| `parse` | Every tracked `.json` file is well-formed. | From milestone 2 the repository's policy layer *is* JSON. A manifest that does not parse gates nothing, and it fails at the moment it is needed rather than when it is written. |
| `doctor` | Both workspaces conform to the Workspace Definition, their paths resolve, their claims match the tree, and every rule carries checkable provenance. | The workspace layer is where a team's policy lives, and until this existed every "this workspace conforms" sentence in the repository was an assertion. Its first run found three rules whose provenance the repository had already mandated and not held. |
| `tests` | [`../../cli/doctor.test.mjs`](../../cli/doctor.test.mjs) passes. | The validator is the first thing here that can be *subtly* wrong rather than visibly broken — a schema keyword silently ignored looks identical to one enforced. A linter can be judged by reading it; a validator cannot. |

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

**Both recipes then turned out to have a false green, found in review of that same change.** Neither
checked whether `git ls-files` succeeded. When it failed the list came back empty, every loop iterated
nothing, and the recipe printed GREEN having examined *nothing* — demonstrated by running `docs.sh` in a
non-git directory, where it emitted `fatal: not a git repository` and still exited `0`. `docs.sh` had
carried it since milestone 1, session 3; `json.sh` inherited it by being modelled on `docs.sh`, which is
how a defect in an exemplar becomes a defect in a family. Enumerating the tree is now a **precondition**
in both: it fails `2`, not `0`. Recorded as
[`../memory/verify-preconditions-fail-closed.md`](../memory/verify-preconditions-fail-closed.md).

## Known limits

- **Anchors are not checked.** A link to `file.md#section` verifies only that `file.md` exists. Checking
  fragments needs a heading parser, and the failure it would catch is milder than the one it would add:
  false reds train people to stop trusting the recipe.
- **External URLs are not fetched.** Deliberate. A verify recipe that needs the network fails for reasons
  unrelated to the change under test, and a flaky gate is worse than no gate.
- **Link targets are matched by the filesystem's rules, not GitHub's.** On a case-insensitive volume —
  the macOS default — the existence test accepts `Core/engine.md` for `core/engine.md`, so a wrong-case
  link passes locally and 404s once the repository is browsed on GitHub or cloned onto Linux. Resolving
  targets against `git ls-files` instead would close it; until then this is a known false green, recorded
  rather than left to be discovered.
- **Code spans are not treated as code.** The `links` check scans raw text, so it neither skips fenced
  blocks and inline spans nor looks inside them. That cuts both ways, and both were observed the same
  day: a path written as a code span is never validated (two dead pointers in the plan survived several
  reviews that way), and Markdown link *syntax* quoted inside a code span — while writing about this
  check — is treated as a real link and fails. Skipping spans needs a small parser; until then, write
  paths as links when you want them checked, and avoid quoting link syntax verbatim.
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
- **`node --test` given a glob matching nothing exits `0`.** A green suite that ran nothing. `tests.sh`
  counts the files first for that reason, and the count and the glob deliberately cover the same set —
  a recursive `find` beside a non-recursive glob would let a test be counted and never run.
