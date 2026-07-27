# Handoff — nothing merges from behind `main`, and everything that merges is labelled

**State.** Post-milestone-4-session-0; **no milestone row touched and none was due.** Branched from
`8c02c5f`; `main` moved four commits during the session (#41, #42 and two more merged), so the branch was
rebased onto `e31feac` before close — under the rule it had just written, which is how the first
conflict it predicts got hit and resolved. **Two maintainer rulings** landed as doctrine, each with the
instruction to set it in GitHub rather than leave it as prose: one is now a platform rail, the other is
a workflow one merge away from being one.

## The ruling

Marius, 2026-07-27: **a pull request may not merge while it is behind `main`; it has to sync with `main`
first.** Taken as a general rule for this repository, not a note about any one pull request.

## What the repository looked like when it was taken

Measured before writing anything, because a rule with a live instance behind it is worth more than a
rule with a rationale:

| PR | branch | vs `main` | GitHub says |
|---|---|---|---|
| #41 | `memory-growth-rails` | ahead 1, **behind 1** | `DIRTY` / `CONFLICTING` |
| #42 | `tests-recipe-docs-match-the-glob` | ahead 1, **behind 1** | `BLOCKED` |
| #43 | `test-roster-docs-match-the-glob` | ahead 1, **behind 1** | **`CLEAN` / `MERGEABLE`** |

#43 is the one that matters: mergeable on the spot, `workspace-verify` green, and that green describes a
test merge with a `main` that stopped existing when `8c02c5f` landed. The platform was not going to stop
it, because `required_status_checks.strict` was **`false`** on `main` — read from the live protection,
not assumed.

**Then the ruling grew a second half, mid-session:** *"This rule needs to be set in GitHub too. The PR
should be blocked from merging if it's behind main."* So the proposal was accepted before it was
finished, and `strict` is now `true`.

## Why the rule bites here specifically

CI runs on `pull_request` and checks out `refs/pull/N/merge` — a test merge against `main` **as it stood
when the run happened** — and nothing re-runs when the base moves. The failure that gets through is not
a textual conflict (git catches those) but the union of two individually-green branches, and this
workspace's recipes are made of exactly that kind of check: `links` breaks when one branch deletes a
file another links to, `map` when one adds a top-level directory and another rewrites the README table,
`record` when one adds a Session log date whose handoff is on the other. Red lands on `main`, and the
next pull request inherits a red required check that has nothing to do with it.

Three of the open pull requests, including this one, edit `docs/plan.md`'s Session log — so the shape is
not hypothetical in this window.

## What landed

- [`../memory/a-branch-syncs-with-main-before-it-merges.md`](../memory/a-branch-syncs-with-main-before-it-merges.md)
  — the rule, with the one-command check (`compare/main...<head> --jq .behind_by`, zero or nothing) and
  the note that `--is-ancestor` is honest in *this* direction, unlike the has-it-merged question.
- [`../gate-map.md`](../gate-map.md) — the precondition on the Gated `merge-a-pull-request`, plus a new
  platform-floor row: **branch up to date with `main` before merging, required since 2026-07-27**.
- [`../gates.json`](../gates.json) — the precondition in the merge gate's reason. Recompiled;
  `.claude/settings.json` is byte-identical, because reasons live in `gates.json` and the hook reads
  them at runtime.
- [`../proposals/0011-no-merge-from-behind-main.md`](../proposals/0011-no-merge-from-behind-main.md) —
  **ACCEPTED and APPLIED.** `strict: true` on `main`, sent with the `checks` array explicit so the
  `app_id: 15368` pin could not be dropped by a `PATCH` that only meant to flip a boolean. Protection
  re-read afterwards: `enforce_admins`, conversation resolution, force-push and deletion blocks, review
  count — all unmoved.

## The correction worth carrying forward

The first draft of both the rule and the gate map said the precondition was "carried by `gates.json`'s
reason", which reads as a second enforcement layer. It is not one. `compile/gate.mjs`'s own header
records the measurement: when a permission rule matches, the host runs the hook and **discards its
reason**, so the agent sees the generic prompt. The sentence only reaches an agent on the wrapped
spelling the permission pattern cannot see. Caught by reading the runner instead of trusting the
architecture diagram in my head — which is `a-stated-enforcer-must-be-the-real-one` catching a fresh
instance of itself, in the same session that added a rule about honest greens.

## The second ruling — every pull request carries a label

Arrived mid-session, after the first was applied: *"each PR should have a label and be labeled
accordingly."* Measured before designing anything, as with the first: **45 pull requests, exactly one
label between them**, on #27, applied by Dependabot. The repository's label set was GitHub's stock issue
vocabulary, which cannot discriminate here — in a repository whose changes are almost all Markdown,
`documentation` is true of nearly everything and therefore says nothing.

- **The set is derived from this repository's structure**, not from a generic taxonomy:
  `doctrine` (`core/`, `agents/`) · `workspace` (`.portulan/`) · `mechanism` (`cli/`, `spec/`, `plugin/`)
  · `record` (Session log, handoffs, changelog) · `infrastructure` (`.github/`, settings). Plus
  `dependencies` and `github_actions` **declared rather than exempted**, so a Dependabot pull request
  passes with the labels Dependabot applies itself — a gate that reds every automated security bump is a
  gate that gets bypassed, and proposal `0006` means those bumps are coming.
- **Policy and checker are separate files**, the `gates.json`/`compile.mjs` split:
  [`../labels.json`](../labels.json) is the set, [`../../.github/workflows/pr-labels.yml`](../../.github/workflows/pr-labels.yml)
  is the machinery. Editing the set needs no workflow edit.
- **Binary half checked, judgement half human.** The check refuses an *unlabelled* pull request and
  never an over-labelled one, and `covers` is documentation rather than a matcher: a path→label matcher
  reds the first pull request that touches `core/` incidentally, and a false red is what gets a check
  switched off. Same split as provenance — `doctor` fails a rule with no stamp and cannot tell whether
  the stamp is true.
- **Red-first, four payloads:** unlabelled → red; only-undeclared (`wontfix`) → red; declared → green;
  policy missing or declaring nothing → red with a stated reason, never green. The last two matter most —
  a checker that cannot read its own policy must not report success.
- **The trigger list is load-bearing.** `labeled` and `unlabeled` are in it, so adding the label clears
  the check. Without them the check would refuse, the author would label, nothing would re-run, and the
  gate would trap the change instead of gating it.

**Not made a required status check, and that is the whole sequencing risk.** A required context that has
never reported blocks every open pull request that does not carry the workflow, and `enforce_admins`
means nobody can force past it — proposal `0004` paid for that lesson with a three-step rename. So the
workflow merges to `main` first; `pr-labeled` joins the floor after, by the single command recorded in
[`../memory/every-pull-request-carries-a-label.md`](../memory/every-pull-request-carries-a-label.md).
**Doing it in the other order would deadlock the repository.**

The five new labels were created on GitHub. That half is live; the enforcement half is one merge away.

**Flagged, not touched, in the same neighbourhood.** [`../gate-map.md`](../gate-map.md)'s *What the
compiler refuses* opens with "the permission rule holds; **the hook supplies the sentence**" — the
framing [`../compile/gate.mjs`](../compile/gate.mjs)'s header records as the assumption its own
measurement refuted. The detail two paragraphs later is correct (the supervisor found the sentence
reaching the agent *on the wrapper spelling*), so it is the summary line that is loose. Left for the
maintainer rather than rewritten here: restating another session's measurement inside a rule-landing
change is how a summary drifts a second time. This entry's cross-reference points at the runner instead.

## Open, and deliberately not closed here

- **The demonstration is missing, and that is named rather than finessed.** The bar here is
  *demonstrated, not asserted*, and no behind pull request was observed being refused: within the same
  half-hour #41 and #42 merged and #43 rebased to `behind_by=0`, so every available subject synced
  itself. A `BLOCKED` reading was caught on #43 between its `CLEAN` and its rebase, and one ambiguous
  observation is not evidence — GitHub reports `BLOCKED` for several reasons and was mid-recompute. The
  honest subject is **this** pull request: it was behind `main` when the setting landed, so its
  pre-rebase `mergeStateStatus` is the measurement, and it belongs in proposal `0011` when taken.
- **Milestone 4's ruleset export** must now carry strict required status checks, or the exported floor
  will be weaker than the live one. Noted in the proposal for session 1; the criterion row is the
  maintainer's to change, so it was not edited.
- **The other sessions' pull requests were not touched**, including the rebases this rule now asks of
  them.

## Recoverability

`.claude/settings.json` is unchanged, so reverting this branch needs no recompile. **Two outward actions
were performed, both narrow and both reversible.** The protection `PATCH` undoes with `strict:false` and
the same explicit `checks` array — the before-state was captured before the change was made. The five
labels undo with `gh label delete`; nothing was labelled with them, so deleting them strands no pull
request. Seam scan clean across files, commit messages, and branch name.
