**type:** rule
**scope:** workspace — every pull request opened against this repository
**provenance:** `form=link` `href=../handoffs/2026-07-27-nothing-merges-behind-main.md`
— the maintainer's ruling, Marius Cetanas, 2026-07-27: *"each PR should have a label and be labeled
accordingly"*, taken in the same session as the merge-sync rule and with the same instruction to set it
in GitHub rather than leave it as prose. The state it was taken in: **45 pull requests, exactly one of
them labelled** — #27, and by Dependabot rather than by anyone here — with the only labels on the
repository being GitHub's stock issue set plus the two Dependabot created for itself.

Every pull request carries at least one label from the declared set in
[`../labels.json`](../labels.json) — `doctrine`, `workspace`, `mechanism`, `record`, `infrastructure`,
plus `dependencies` and `github_actions` for the ones Dependabot labels itself. Extra labels beyond the
set are allowed. Apply it at open time, in the same command:

```
gh pr create --label workspace --label record …
```

**Why it holds:** a repository whose changes are almost all prose loses the ability to say what a change
*was*. Every pull request here is a diff of Markdown; `git log --stat` distinguishes them by path and
nothing distinguishes them by kind, so "which pull requests changed doctrine this month" is a question
the record cannot answer without reading forty bodies. That is the same failure the Session log and the
handoff series exist to prevent, one layer down, and the librarian at milestone 5 mines exactly this
kind of series. GitHub's stock labels cannot do it — `documentation` is true of nearly every change here
and therefore says nothing — which is why the set is derived from this repository's own structure
instead.

**Why the set is small, and why `covers` is guidance rather than a matcher.** Five labels plus two
inherited. A taxonomy that needs a decision tree is the ceremony [`../dod.md`](../dod.md) explicitly
refuses, and a path→label matcher would produce false reds on the first pull request that touches
`core/` incidentally — and *"a false red is the failure that gets a whole check switched off"*. So the
binary half is machine-checked (**is there a declared label**) and the judgement half stays human
(**is it the right one**), which is the same split provenance already has: `doctor` fails a rule with no
stamp and cannot tell whether the stamp is true.

**When to apply:** at `gh pr create`, before review. Labelling after the fact still works — the checker
re-runs on `labeled`, which is deliberate and is the difference between a gate and a trap.

**The rail, and the one step still outstanding.**
[`../../.github/workflows/pr-labels.yml`](../../.github/workflows/pr-labels.yml) reads
[`../labels.json`](../labels.json) and the event payload, and fails a pull request carrying no declared
label — red-first tested against four payloads: none, undeclared-only, declared, and both
policy-unreadable preconditions, which fail closed rather than green. **It is not yet a required status
check**, and the sequence is the point: a required context that has never reported blocks every open
pull request that does not carry the workflow, and `enforce_admins: true` leaves nobody able to force
past it — the lesson [`../proposals/0004-ci-runs-every-declared-recipe.md`](../proposals/0004-ci-runs-every-declared-recipe.md)
paid for. So the workflow merges to `main` first, and only then does `pr-labeled` join the floor:

```
gh api -X PATCH repos/sleepy-panda-works/portulan/branches/main/protection/required_status_checks \
  --input '{"strict":true,"checks":[{"context":"workspace-verify","app_id":15368},{"context":"pr-labeled","app_id":15368}]}'
```

Until that runs, this is a rule a human applies and CI reports on — stated so nothing here reads as a
floor it is not part of yet ([`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md)).
The label *set* is live on GitHub already; adding a name to `labels.json` does not create it, and the
checker would then red every pull request using it — `gh label create` is the other half.

**Retire when:** the labels stop being read — if nothing (the librarian, a release-note generator, a
query anyone actually runs) consumes them, the rule is decoration with a gate attached, and the honest
move is to delete both rather than keep paying for them. Related:
[`a-branch-syncs-with-main-before-it-merges.md`](a-branch-syncs-with-main-before-it-merges.md), the
other half of what the maintainer ruled the same day.
