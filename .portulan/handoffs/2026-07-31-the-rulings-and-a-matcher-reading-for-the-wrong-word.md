# Handoff — the rulings applied, and a matcher reading for a word Copilot had stopped using

**Opens milestone 7.** Session 0 of the CLI & onboarding row, and the first session since
[#146](https://github.com/sleepy-panda-works/portulan/pull/146) closed milestone 6. **Milestone state:
M6 closed, M7 in progress** — four rulings taken, the review rail repaired, and the row's packaging
clause landed: there is a command line. `init`, `vendor` and `upgrade` are named by it and unbuilt.

## What landed

[#147](https://github.com/sleepy-panda-works/portulan/pull/147), open and awaiting the maintainer's
merge. Suite **774/774**, eight recipes green, seam clean. Two Copilot rounds answered, both on the
matcher's own repair.

## The rulings, and what the tree said about them

Four questions went to the maintainer at session-open, before a file was written. **All four answered.**

- **The CLI ships as plain `.mjs`, zero dependencies, no build step.** `identity.md:43` said *TypeScript
  on Node*; the same table's closing line says *no build step, no package manager: nothing here is
  installed before it runs*, and `cli/README.md:144` argues **both sides in one paragraph** — zero-dep
  ESM "rather than TypeScript, deliberately and for now" because a build step would break
  clone-and-check, then "the CLI at milestone 7 absorbs this file and takes the build with it". He took
  the property over the plan. `identity.md:43`, the `build:` line in `repos/portulan.md` and the
  `cli/README.md` paragraph are corrected **in this session**, since it went on to ship the package
  and so falsified them itself.
- **A composed pack's verify recipes reach the adopting workspace**, additive-only. `skills` never
  needed asking: row 7's clause (b) already committed that consumer. See below.
- **The M6 close-hold and `#135`'s residence amendment ratified**, the latter **with the switch left
  unassigned to any subcommand** — the draft said `vendor`, he declined it, and the row now says *"the
  CLI performs the switch in both directions"*.
- **Scope: package and `init` first.** Sessions 1 and 2 take `doctor`'s validation half plus `new` and
  the legibility score, then `vendor`/`upgrade`/residence, discovery, `feedback` and the demonstrations.

## The decisions a later session would otherwise re-derive

- **`plugin-lint` was NOT wired behind the entry point, deliberately.** `vision.md` names six
  subcommands and is human-owned; `cli/README.md:9` records that whether `plugin-lint` or `librarian`
  ever joins them is the maintainer's call. Wiring it would have minted a seventh into a list an
  implementer does not own. Session 0 wires the six and asks.
- **Clause (a) needs a pack root and nothing discovers one.** `init` scaffolding the checkpoint ritual
  by default has to find a checkpoints pack, and [#123](https://github.com/sleepy-panda-works/portulan/issues/123)
  is open: no tool discovers a host's plugin cache. Session 0 takes a **named** `--pack-root`, the same
  honest arrangement milestone 6 demonstrated. **Do not read the skeleton as closing #123.**
- **The `verify`-composition limits are not a security boundary, and the first draft of that argument
  said they were.** A recipe's `run` is arbitrary shell; a workspace listing a pack has already
  consented to running that pack's code, with or without namespacing. The session-open checkpoint
  refused the stronger claim. What the limits buy is that a pack cannot silently change **what this
  workspace's green means**. Written down because the overclaim is the more natural sentence.
- **Two carriers, nine minutes apart.** `spec/pack.schema.json`'s `skills` note said milestone 7
  commits no consumer for that key. Row 7's clause (b) commits one. The note was **right when
  written** — authored on #140's branch at 23:29 while clause (b) sat on #137's, authored 23:23 — and
  went stale when #137 merged at 05:46:27Z, nine minutes after #140's 05:37:25Z. Neither session could
  have seen the other. **Concurrency produces this defect class as reliably as neglect does**, and the
  only instrument that catches it is a reconciliation sweep at session-open.

## The rail, and what it cost while it was blind

[#142](https://github.com/sleepy-panda-works/portulan/issues/142) predicted two markup spellings. The
by-hand sweep found **four**, varying on two axes independently — container (`<summary>` vs markdown
heading) and phrase — and **they interleave**: heading-new at 05:52, summary-new at 06:04, heading-new
again at 06:12 on 2026-07-31. **So no spelling is "the current one", and a repair written against the
newest would have been the same mistake in a newer costume.** The matcher now keys on a section marker
carrying the one word all four share, and — the half that matters more — `none` is licensed by that
word being **absent from the whole body** rather than by a marker failing to match.

**Four false zeros measured from this repository's own run logs:** #145, #144 twice, #137. Every note
has since been addressed, all four **by hand**, and nothing guaranteed it. One of them, on #140, was
about `spec/pack.schema.json:57` — the exact sentence #147 rewrites — and merged unanswered.

**#140's own zero is a different hole and must not be filed with the others.** Its "none" was reported
at 05:32:53Z; the note-bearing review arrived at 05:36:45Z, four minutes later, with no further round.
**A review landing after the last parse is invisible to any body matcher**, old or new. That is the
*awaited* half of `copilot-review.yml`'s own subject arriving for the notes channel, and nothing closes
it. Worth an issue; not opened, because issues are the maintainer's.

**The matcher was covered by nothing, which is how it rotted.** `workflow-filters` ran the workflows'
jq programs and stopped there. It now runs the awk programs the same way — from the parsed `run:`
scalar, never a copy, with `-v` bindings resolved out of the workflow's own shell assignment, so a
fixture cannot pass against a matcher value the workflow no longer uses. Forced red four ways and
restored each time.

## Undemonstrated, named

- **The new matcher has never parsed a live round**, and the prediction that #147's own round would
  exercise the `unparsable` branch **did not come true**: that round carried a real suppressed block
  (`<summary>Suppressed comments (2)</summary>`) so it took the `present` branch instead — under the
  matcher on `main`, which is still the stale one, and which reported none. The two notes were swept
  **by hand**. The `unparsable` branch remains fixture-only.
- **The residual failure mode is a vocabulary move**, not a markup move: rename the section to
  something without `suppress` and the silent zero returns. The rule is word-anchored. A candidate for
  milestone 8's forced-red drills.
- ~~CI's awk is unmeasured.~~ **Measured on #147's first run: `GNU Awk 5.2.1` on `ubuntu-latest`,
  green**, against BSD `awk version 20200816` locally. Two implementations, same fixtures, so the
  matcher's behaviour is cross-checked rather than assumed — which mattered within the hour, when
  Copilot's first round found `[ \t]` putting an escape inside a bracket expression, where POSIX makes
  a backslash literal. **Both awks read it as a tab, so both passed a spelling that was still
  implementation-dependent** — a green from two implementations is not a portability proof. Replaced
  with `[[:blank:]]` and pinned by two fixtures that state the intended behaviour, with the honest
  note that they cannot discriminate on either awk we run.
- **`verify` composition is committed, not built** — session 2, beside `vendor`.

## Open for the maintainer

1. **Row 7's validation scope reads two ways.** Its letter scopes `doctor`'s new validation to *"what
   `new` scaffolds"*; seven carriers — `core/operating/memory.md:113`, the pack schema twice, `0016`,
   `CHANGELOG.md:150`, `cli/index.mjs`, the generated `personas-index.md` — promise milestone 7
   validates **pack-shipped** personas and skills, citing his own *"row 6 declares, row 7 validates"*
   split. **Session 1's scope depends on which reading binds.**
2. **`core/operating/verification.md:47-48`** promises the Stop-gate's repo-card and task
   recipe-resolution steps arrive "with the CLI in milestone 7". **No row carries it** — not 7, 8 or 9.
3. **`cli/README.md:147`'s "absorbs this file" has no clear referent**, found while reconciling the
   language question. Cosmetic, but it sits in the paragraph the language ruling turns on.
4. **The switch still owes a verb.** Deferring it moved the choice rather than removing it: either
   widening `vision.md`'s `vendor` gloss or minting a seventh subcommand, and both are his.

## The packaged CLI, and the bug that made the checkpoint worth its cost

`package.json` + [`../../cli/portulan.mjs`](../../cli/portulan.mjs): one entry over the six names,
three dispatching and three exiting 2. The dispatch adds nothing — each tool's `run` is imported on
demand and its exit code returned unchanged, verified **byte-identical** to direct invocation for all
three, red cases included.

**The pre-commit checkpoint returned REQUEST-CHANGES on it, and the finding is the one a reading
could not have produced.** npm installs a `bin` as a **symlink**. Node realpaths the main module for
`import.meta.url` while `process.argv[1]` keeps the link path, so the ordinary guard every other tool
here uses — a bare comparison of the two — is **false through the link**. The supervisor packed the
tarball and installed it: `--version` printed nothing and exited 0, and `doctor` on a missing
directory exited **0** where a checkout exits **1**. Every verdict silently became a success, on the
route the README tells people to use.

**Three things worth carrying from that.** The guard now realpaths, and `isMain()` is the one place in
`cli/` that must — the other tools are right to keep the bare comparison, because nothing links them.
The suite was **structurally blind** to it: sixteen tests injected the loader, and injection is
precisely the path that skips the guard, so the fix ships with a test that spawns the file through a
real symlink and **reds against the old guard**. And the check that found it was *install the artifact*,
not *read the code* — the same lesson milestone 6 closed on, one layer out: **run a check in the layout
the consumer gets.**

## What session 1 picks up

**`init`**, which this session did not reach — the package and its entry point landed, `init` did not.
Everything it needs is ruled: plain `.mjs`, a named `--pack-root`, cycle-scaffolded by default with an
opt-out, drafting rather than imposing. It slots into `SUBCOMMANDS` in `cli/portulan.mjs` by giving the
`init` entry a `module`; the exit-2 path and its test disappear with it.

Read the four open items above first — the validation-scope one moves session 1's own scope.
