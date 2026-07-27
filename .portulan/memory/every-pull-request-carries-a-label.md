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
[`../labels.json`](../labels.json) for the set and the **API** for the labels the pull request carries
now, and fails one carrying no declared label. Tested red-first against four synthetic payloads (none,
undeclared-only, declared, and an unreadable policy) and then against three live pull requests: #46
green on three labels, #45 red on none, a nonexistent number red with a stated reason. **The API read
replaced a payload read on the first run of this checker in anger, and the reason is worth keeping:**
`gh pr create --label` opens the pull request and applies labels as a *second* operation, so the
`opened` event's payload is empty and the check went red on a pull request that was labelled from the
first second. A spurious red on every newly-opened pull request is the false-red failure this rule's own
reasoning warns about — found by watching the check run rather than by trusting it. Reading current
state also means the answer is about the pull request, not about the event that woke the job. **It is
not yet a required status check**, and the sequence is the point: a required context that has never
reported blocks every open
pull request that does not carry the workflow, and `enforce_admins: true` leaves nobody able to force
past it — the lesson [`../proposals/0004-ci-runs-every-declared-recipe.md`](../proposals/0004-ci-runs-every-declared-recipe.md)
paid for. So the workflow merges to `main` first, and only then does `pr-labeled` join the floor:

```
gh api -X PATCH repos/sleepy-panda-works/portulan/branches/main/protection/required_status_checks \
  --input - <<'JSON'
{"strict":true,"checks":[{"context":"workspace-verify","app_id":15368},{"context":"pr-labeled","app_id":15368}]}
JSON
```

**Both contexts are listed, and both carry `app_id`**, because the `checks` array is sent whole rather
than added to — and a required check written without its `app_id` is satisfiable by any GitHub App
reporting that name, which is the hole proposal `0001` closed. `strict` is repeated for the same reason:
send the state you want, rather than relying on what a `PATCH` leaves alone. `--input` reads a file or,
as here, stdin; inline JSON as its argument is treated as a filename and fails.

Until that runs, this is a rule a human applies and CI reports on — stated so nothing here reads as a
floor it is not part of yet ([`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md)).

**Adding a label to [`../labels.json`](../labels.json) does not create it on GitHub**, and until it
exists nobody can apply it — so the policy would name a label that reds every pull request trying to use
it. This is the other half, run from the repository root, and it is idempotent (`--force` updates an
existing label rather than failing):

```
node -e 'for (const l of require("./.portulan/labels.json").labels) if (l.appliedBy !== "dependabot") console.log([l.name, l.color, l.description].join("\t"))' \
  | while IFS=$'\t' read -r name color desc; do gh label create "$name" --color "$color" --description "$desc" --force; done
```

The `appliedBy` filter is what keeps it from re-creating Dependabot's two, which are declared here but
owned there.

**Retire when:** the labels stop being read — if nothing (the librarian, a release-note generator, a
query anyone actually runs) consumes them, the rule is decoration with a gate attached, and the honest
move is to delete both rather than keep paying for them. Related:
[`a-branch-syncs-with-main-before-it-merges.md`](a-branch-syncs-with-main-before-it-merges.md), the
other half of what the maintainer ruled the same day.
