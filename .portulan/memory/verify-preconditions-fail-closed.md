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

**Second instance, 2026-07-27: a command that is absent returns nothing too.** The rule was written
about a precondition that *ran and failed*; a precondition that was never installed produces the same
empty output and the same green. Measured across all six recipes by removing one utility at a time from
`PATH`: **eleven false greens** — `docs.sh` on `sed`/`sort`/`wc`, `doctor.sh` on `sort`/`tr`, `json.sh`
on `grep`/`sed`/`tr`/`wc`, `plugin.sh` on `sort`/`tr` — plus five runs that went red overall while
individual checks still printed `ok`, among them `docs.sh` printing `ok    map` having examined zero
directories. Each recipe now guards **every external command it runs**, exiting `2`, and the same probe
returns `2` in all thirty cases — and a sweep over every entry in every guard list, 43 cases, likewise,
with all six baselines green. So the rule's reach is the *list of inputs*, not only the command that
builds it: a dependency is a precondition.

**A note on where this came from, since it matters for how much to trust the recipes.** It was found by
an automated reviewer, not by the checks themselves — nothing in this repository tests its own verify
recipes, which [`../verify/README.md`](../verify/README.md) states plainly. **Both instances were**, and
the second had been sitting in the open for three days: it was raised on #3 as a Copilot comment
*suppressed due to low confidence*, which GitHub renders inside the review body rather than as a review
thread — so it was never resolvable, never blocked a merge, and appears nowhere in the repository's
record of addressed feedback. The reviewer was right and the confidence score was wrong. Related:
[`readme-map-must-match-shape.md`](readme-map-must-match-shape.md), the other rule minted from a defect
rather than stated in advance.

**Partly discharged, and deliberately not retired.** The Stop-gate runner arrived in milestone 4 and it
does distinguish the codes — [`../compile/stop.mjs`](../../cli/stop-gate.mjs) blocks on exit 2 exactly as it
blocks on exit 1, so "nothing looked" cannot read as "nothing wrong". The contract moved into
[`../../core/operating/verification.md`](../../core/operating/verification.md), which is where the retire
condition said it should go. **The rule stays** because the runner covers one recipe in one workspace and
the asymmetry it names applies to every check anyone writes here — including, immediately, the new sixth
recipe and the runner itself.

**Retire when:** nothing in this repository enumerates anything without a precondition — which is a
property of the whole tree and not of one runner, and is therefore unlikely to arrive as a single change.
