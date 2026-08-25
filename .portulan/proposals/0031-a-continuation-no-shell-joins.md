# Proposal — a continuation no shell joins

**Status. OPEN — drafted 2026-08-25.** It asks one question: **should `compile.mjs` stop consuming
`\` + CRLF as a line continuation?** The change is **fail-open on a gate matcher**, which
[`../gate-map.md`](../gate-map.md) names as the case to scrutinise hardest, so it is asked here and
**not taken**. What the drafting session *did* take is the half that is not a behaviour change: the
comments arguing for the branch now say what was measured instead of what was argued.

## Incident — a justification that did not reproduce

[`../../cli/compile.mjs`](../../cli/compile.mjs)'s `shellWords` consumes a backslash followed by CRLF
as a **pair**, so a CRLF "line continuation" inside a path is resolved and the word is joined. The
comment beside it, added 2026-07-28 on a Copilot finding on
[#60](https://github.com/sleepy-panda-srl/portulan/pull/60), justified that with a specific
reachability:

> `cp /tmp/x \<CRLF>docs/vision.md` stepped aside where the LF spelling answers `deny` — the
> constitution, reachable by editing the file on Windows.

Milestone 8 session 1 measured that claim while building
[`../../cli/fuzz-shell.mjs`](../../cli/fuzz-shell.mjs)'s `crlf-continuation-in-the-payload` production
and **it did not reproduce**. The finding was recorded in that file's EXPECT cells and flagged for the
maintainer rather than repaired, on two grounds — the repair direction is fail-open, and *"only bash
3.2.57 was available to measure on"*. **The second ground has now been discharged.**

## What was measured, and how wide the measurement actually is

**2026-08-25, five shells, with a neutral target path — never `docs/vision.md`, which no agent may
write to.** The probe built the exact strings the fuzzer's production builds — its `build` **keeps**
the payload's first space and inserts a backslash and the pair immediately after it — ran each through
`<shell> -c` in a scratch directory, and compared the target's **SHA-256 before and after**. The target
was pre-seeded with `BEFORE` and the copy source holds `SRCSRC` — **the same length, deliberately
different bytes** — so neither an equal size nor a same-length overwrite can pass as *unchanged*; the
hasher self-tests before any case runs. _(An earlier draft of this sentence said the source was "the
same six bytes as the seed", which would have made a successful overwrite byte-identical to the seed
and the instrument blind in exactly the cell it was built for. The design was right and its description
was not; the LF control writing `SRCSRC` is what proves the two differ. Found at the pre-merge
supervisor pass.)_ _(The first probe read the
target's **size** only, and Copilot was right that equal size cannot rule out a same-length overwrite.
The claim was not narrowed — the instrument was strengthened, and it says the same thing.)_

| shell | build |
|---|---|
| bash | `3.2.57(1)-release (arm64-apple-darwin25)` — this machine |
| bash | `5.2.15(1)-release (aarch64-unknown-linux-gnu)` — `debian:bookworm-slim`, container |
| bash | `5.2.37(1)-release (x86_64-pc-linux-gnu)` — `node:26`, container |
| zsh | `5.9 (arm64-apple-darwin25.0)` |
| sh | **the measured host's** `/bin/sh` — bash 3.2.57 in POSIX mode on that macOS host. `/bin/sh` is platform-dependent and is commonly `dash` or `busybox` elsewhere; **neither was measured**, so this row reads bash again under a different name rather than covering `/bin/sh` as a family |

**None of the five joins the pair** — which is the commonality the table establishes, and the whole of it. Their **exit statuses differ** (126 or 127, depending on whether the surviving fragment contains a `/` and so is exec'd as a path rather than looked up on `PATH`), so *identical behaviour* would be a wider claim than anything here measured. The backslash escapes the `\r`, the
newline then ends the command, and the fragment after it is run as its own command:

| payload shape | exit | target afterwards |
|---|---|---|
| `cp \<CRLF>SRC T` · `mv` · `tee` · `truncate` — **write-named** | 126 / 127 | **6 bytes — unchanged** |
| `cp SRC \<CRLF>T` — the comment's own named shape | 126 | **6 bytes — unchanged** |
| `echo \<CRLF>ok > T` · `printf \<CRLF>ok 1> T` · `cat \<CRLF>SRC > T` — **write-redirect** | 126 / 127 | **0 bytes — truncated** |
| `echo \<CRLF>ok >> T` — append | 127 | 6 bytes — unchanged |
| `cp SRC \<LF>T` and `echo \<LF>ok > T` — the **LF controls** | 0 | **written** — the continuation joined |

The LF controls are the half that makes the rest a measurement rather than a silence: the same harness
that reports *the target is untouched* for the CRLF **named-writer** spellings reports *the file was
written* for the LF one — and, in the same run, *truncated to zero bytes* for the CRLF **clobbering
redirects**. Three distinct outcomes from one instrument is what makes any of them credible. _(An
earlier draft said the harness reported "nothing happened" for **every** CRLF spelling, which its own
table two paragraphs up refutes. Copilot, round 4.)_

**So the branch is a false red for the `cp`-shaped payload the retired sentence names — on every shell
measured, fail-closed, and worth one prompt.** It is **not** a false red everywhere, which is the part
that makes this question worth asking rather than obvious: a shell applies a redirection **before** it
looks the command up, so a clobbering `>` or `1>` on the surviving fragment still fires and destroys
its target. `>>` appends and does not. The fuzzer's `groundByKind` override and its `carries` predicate
already encode exactly that split, and all three cells reproduce on both bash 5.2 builds.

## What removing the branch would actually cost — measured, not argued

A differential against a **copy** of `compile.mjs` with the pair branch deleted, run over the rules the
workspace yields:

| case | today | branch removed |
|---|---|---|
| write-named — `cp` before target, `cp` after head, `tee` | `true` | **`false` — moves** |
| write-redirect — `>`, `1>`, `>>`, **as the fuzzer's production spells them** (pair after the head) | `true` | `true` — unchanged |
| write-redirect **with the pair after the `>`** — `compile.test.mjs`'s spelling | `true` | **`false` — moves** |
| shell — a gated force-push | `false` | `false` — unchanged |
| LF controls — named and redirect | `true` | `true` — unchanged |

**The true positive survives the removal for THIS production**, and the reason an earlier draft gave was
false. That draft said the redirection is recognised off raw segment text; there is no raw-text path —
`shellWrites` iterates `shellSegments`, built from `shellWords`. The real reason is **where the pair
sits**: this production puts it after the head, so the split leaves `> docs/vision.md` in a later
segment whose `redirects` still name the target. **Put the pair after the `>` and the opposite happens**
— the operator takes the escaped `\r`, the path becomes an ordinary word, and the match is lost, which
is exactly why surface 3's second assertion fails. So this does **not** generalise to every redirect
spelling, and saying it did was the overclaim. **A real LF continuation still joins**, so the branch
above this one is untouched. _(Copilot, rounds 2 and 3 on #342.)_

The table's moving rows carry probe **shapes**, not recorded cells, and the difference matters to
whoever carries the removal out — the write-named row alone stands for three shapes.

**Measured by deleting both carriers in a scratch clone and running the recipes, the removal moves four surfaces:**

1. `fuzz-shell` — the `crlf-continuation-in-the-payload|write-named` cell's recorded divergence
   **closes**. Good news, and a red until `EXPECT` and the record it cites are updated.
2. `goldens` — the `a-CRLF-continuation` fixture in
   [`edit-the-constitution.json`](../../evals/goldens/gates/edit-the-constitution.json) **regresses**.
3. [`../../cli/compile.test.mjs`](../../cli/compile.test.mjs) — **two** direct assertions fail,
   *a CRLF continuation before the path* and *a CRLF continuation after `>`*.
4. `mutants` — exit **2, could-not-run**: it refuses a census over the corpus **that surface 2 has
   reddened**, so it is unblocked by repairing that surface rather than by an edit of its own.
   _(Copilot asked for this to say "the corpus has two red cases". Refused on measurement: the deletion
   reddens **one** case — `goldens` reports `1 finding(s)` and `mutants` names that one. The missing
   word was a connector, not a count.)_

**An earlier draft of this section said "those two, and nothing else", having counted the first two
only** — an exhaustive claim in a proposal whose subject is a claim nobody measured. Reported by
Copilot on [#342](https://github.com/sleepy-panda-srl/portulan/pull/342) and corrected by running the
deletion rather than by re-reading the sentence.

## The question

> Should the `\` + CRLF pair stop being consumed as a continuation — in **both** carriers — given that
> no shell measured joins it, that removal costs nothing on the true positive, and that removal is
> nonetheless fail-open on the matcher guarding the constitution?

**Both carriers, and this is the load-bearing half of the question.** The pair is consumed in two
readers, named by function rather than by line because a line number in a proposal is stale the moment
the file moves: `shellWords`, whose comment argued for it, and `commandSegments`, which took it *"for
the reason the session kept re-learning rather than for a failing case: one carrier corrected and its
sibling left is how the last three defects on this branch happened."* A ruling that
removed one would restage precisely the divergence the second carrier exists to prevent. The two move
together or neither moves.

## The argument each way, put fairly

**For removal.** The branch is a matcher pretending to close a hole that does not exist. Every shell
measured splits, the removal costs nothing measurable, and a matcher carrying a branch whose only
justification has been retired is the shape
[`a-stated-enforcer-must-be-the-real-one.md`](../memory/a-stated-enforcer-must-be-the-real-one.md)
names — enforcement that is real in the code and fictional in the reason for it. This repository's
standing preference is a limit a reader can measure over a matcher clever enough to be wrong quietly —
the sentence that stands above `FILE_WRITERS` in the same file, arguing a table rather than a parser.

**Against removal.** The measurement is wide but it is not universal, and the gap sits exactly where
the retired claim pointed: **no Windows-side bash was measured** — not git-bash, not MSYS2, not Cygwin
(whose `igncr` option exists precisely because CRLF and shells interact), not WSL — and no bash 4.x
either. CRLF spellings *originate* on Windows, so the one platform family that could still join the
pair is the one family not covered. Against that, the cost of keeping the branch is one prompt on a
spelling nobody writes deliberately, and the cost of removing it wrongly is the constitution's gate
stepping aside — the exchange rate `shellWrites`' docblock already fixes, and it is asymmetric.

## Enforcement, and the rail that already exists

**Stated so the proposal does not imply machinery it lacks, and equally so it does not deny machinery
it has.** [`../../cli/fuzz-shell.ground.test.mjs`](../../cli/fuzz-shell.ground.test.mjs) runs this
production under **whatever bash the host running the `tests` recipe has**, with a neutral payload, and
reds if that bash disagrees with the declared ground — so a bash that *joined* the pair reds the suite
wherever the recipe runs, CI included. That is a live rail and this proposal does not add one.

Its boundary is the whole of the enforcement and is named rather than left to be inferred: it measures
**one host's bash per run**, and **no Windows-side bash runs anywhere in this repository's CI**. The
container measurements above are therefore a **record and not a recipe** — a recipe that pulled an
image would be a network call in CI, which is a standing rule here, and it would end the property
[`../identity.md`](../identity.md) protects, that nothing is installed before a recipe runs.

## Honest limits

- **The measurement is five shells, not all shells.** Three bash builds — 3.2.57, 5.2.15, 5.2.37 —
  are named in full rather than as *"bash 5"*, which would be a claim about a series drawn from two
  5.2 patchlevels.
- **The gap is where the retired claim pointed.** No Windows-side bash, no bash 4.x. If the answer is
  *keep*, the Windows gap is a **recorded limit**, and
  [`a-recorded-limit-is-not-a-managed-limit.md`](../memory/a-recorded-limit-is-not-a-managed-limit.md)
  says a record is not management: it needs an issue, a rail, or an explicit ruling that it is
  permanent by design.
- **This proposal changes nothing on its own.** The comments in `compile.mjs`, `compile.test.mjs` and
  `fuzz-shell.mjs` were corrected in the same change to state the measurement; the matcher was not
  touched.

**Retire when:** ruled, in either direction, and the ruling carried out —

- **Accepted** → the removal lands as its own review, and it carries **all four surfaces above** with
  it: the `write-named` EXPECT `answer` flips to `false` and its `record` dies with the divergence it
  licensed, the goldens fixture is re-recorded, the two `compile.test.mjs` assertions are re-pointed,
  and `mutants` is unblocked by the second of those rather than by an edit of its own. Moving a
  recorded cell in the good-news direction is still a red until the record is updated, which is by
  design and is what the accepting change must absorb.
- **Kept** → the Windows gap stops being a note and becomes managed, by one of the three routes above,
  and this file records which.

## Provenance

`form=link`
`href=`[`https://github.com/sleepy-panda-srl/portulan/pull/60`](https://github.com/sleepy-panda-srl/portulan/pull/60)
— the Copilot review that found the CRLF spelling stepping aside and produced both the branch and the
reachability sentence now retired. Its successor measurement is
[#341](https://github.com/sleepy-panda-srl/portulan/pull/341), which recorded the non-reproduction per
payload kind and flagged it for this ruling. Both in-repo and resolvable by anyone who can read this
proposal; no client material, so no seal is needed.

## Decision

_Undecided. **The decision is the maintainer's**, this being a change to a compiled gate matcher in the fail-open direction._

**Pull request:** [#342](https://github.com/sleepy-panda-srl/portulan/pull/342) — the change that filed this.
