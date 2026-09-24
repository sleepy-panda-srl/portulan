- **One call closes a change.** [`cli/finish.mjs`](../cli/finish.mjs) confirms the change carries its
  changelog fragment, commits the changes to tracked files and whatever is staged with the repository's
  hooks, runs every recipe the workspace yields on that commit, as CI runs them, and pushes the branch. It
  never stages a file nobody named: an untracked one stops it, listed, so a new file is staged by name in
  the same call. Where a recipe is not green it pushes nothing, undoes its own commit with the changes left
  staged, and prints which recipe went red with its last 25 lines; it never amends, never skips a hook,
  never force-pushes, and refuses a detached HEAD and the base branch itself. Where the tree carries the
  packs its workspace composes, they resolve from the tree, as CI names them, so an installed plugin
  carrying the same packs does not stop it. The closing steps were a run of requests, each re-sending the
  whole context; they are now one. This repository's boot card and the card `init` drafts say to close a
  change with `git add <new files> && node cli/finish.mjs`, the consumer's with `<plugin root>/` before
  `cli/`, merged into its records line: a drafted consumer's boot grows 138 bytes, to 8,219.
