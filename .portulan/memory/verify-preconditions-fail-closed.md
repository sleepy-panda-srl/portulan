**type:** rule
**scope:** workspace — anyone writing or changing a verify recipe here
**provenance:** `form=link` `href=https://github.com/sleepy-panda-works/portulan/pull/8#discussion_r3649661115`
— a Copilot review comment on the milestone-2 pull request, which flagged the pattern in the newly added
`json.sh`; checking it showed the identical defect had been in the default recipe `docs.sh` since
milestone 1, session 3.

In a verify recipe, anything that *establishes what will be checked* is a **precondition**, and a failed
precondition exits `2` — "could not run" — never `0`. Enumerating the tree with `git ls-files` is the
current instance; any future recipe that discovers its own inputs is the same case.

**Why it holds:** the failure is silent and inverted. When `git ls-files` failed, its error went to
stderr, the file list came back empty, every loop iterated nothing, and the recipe printed *GREEN — verify
recipe passed*. A recipe that reports success precisely because it could not examine anything is worse
than no recipe: it converts an absent check into a positive claim, and the louder the green, the more
confidently it is trusted. This is the same asymmetry behind exit code 2 existing at all — *could not
run* must never be mistaken for *ran and passed*.

**Demonstrated, not reasoned about.** Copying the recipes into a non-git directory and running `docs.sh`
produced `fatal: not a git repository` followed by three `ok` lines and exit `0`. After the fix the same
input produces exit `2`. Both runs are in
[`../handoffs/2026-07-25-workspace-definition-v1.md`](../handoffs/2026-07-25-workspace-definition-v1.md).

**When to apply:** whenever a recipe gains a step that produces the *set* of things to check — a file
list, a glob, a manifest of recipes, a directory walk. The test is simple: if this command returned
nothing, would the recipe still print green? If yes, it is a precondition and needs its own guard.

**A note on where this came from, since it matters for how much to trust the recipes.** It was found by
an automated reviewer, not by the checks themselves — nothing in this repository tests its own verify
recipes, which [`../verify/README.md`](../verify/README.md) states plainly. Related:
[`readme-map-must-match-shape.md`](readme-map-must-match-shape.md), the other rule minted from a defect
rather than stated in advance.

**Retire when:** the recipes are executed by a runner that distinguishes the exit codes itself and fails
closed on a recipe that examined nothing — the Stop-gate runner, milestone 4. At that point this rule
should *move* into the runner's contract rather than be deleted, because the underlying asymmetry does
not go away.
