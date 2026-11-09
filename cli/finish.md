# Finish verification boundaries

Finish resolves the recipe set before staging tracked changes or creating its
provisional commit. An empty result from `treeRoots` asks for normal recipe-set
resolution; it does not mean verification succeeded without any recipes.

| Workspace and roots | Behavior |
| --- | --- |
| No composed packs | The tree's pack directories are not probed. Declared workspace recipes still run. |
| Tree roots contain every composed pack | Finish names those roots, avoiding an installed copy shadowing the tree. |
| Tree roots are absent, empty or incomplete | Normal recipe-set resolution and its shadow checks apply. An installed pack can supply the missing recipes; an unresolved pack refuses the operation before commit. |
| Explicit `--pack-root <directory>` | Only the named roots are used. Missing directories are refused, and missing packs do not fall back to an installed copy. |

The controls in `finish.test.mjs` cover these cases. For an absent tree directory,
the installed-pack fixture compares recipe-set's yielded identities against actual
execution markers. The unavailable-pack fixture checks that no commit hook ran and
that HEAD, the index, the worktree and the remote branch remain unchanged.

Bash parse failures are **could not run**, with exit 2 and the diagnostic included
in finish's report. A provisional commit made before the recipes ran is undone and
its changes stay staged; nothing is pushed. Both tested recipe forms parse after
the wrapper's `exec 2>&1` redirection. These controls do not demonstrate coverage
of Bash startup failures.

The manifest recipe format rejects newlines, carriage returns and tabs before
Bash runs. The CLI controls therefore use a single-line missing `fi` and a leading
`)`. Line numbers can differ between Bash versions. These are Bash's wrapper-script
diagnostics, not a general promise to translate recipe line numbers.
The historical two-line example in the review follow-up can be passed directly to
`runRecipe`, but is not accepted as a current manifest recipe.

This reference records concrete boundaries investigated for the historical review
follow-up. That review posted no findings identifying a different empty-root case;
these controls do not establish what its unspecified concern meant.
