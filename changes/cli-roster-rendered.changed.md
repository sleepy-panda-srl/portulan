- **`cli/README.md` is rendered from the code, and the long workshop pages keep their rules and leave
  their history to git.** `node cli/roster.mjs --write` writes the cli roster from each file's header and
  from the rosters in [`cli/portulan.mjs`](../cli/portulan.mjs) and [`cli/compile.mjs`](../cli/compile.mjs),
  at a seventh of the hand-kept page's size, and the tests fail when the committed page is not what the
  files render. The verify and evals READMEs and the compiler's page in the gate map keep their rules,
  limits and procedures and name the `git show` that holds how each was found, and the compile README
  merged into the compiler's page. `.ignore` files keep ripgrep out of the handoffs, the closed
  milestones and the done tasks until a following change deletes them.
