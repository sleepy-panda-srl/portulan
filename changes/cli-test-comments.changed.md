- **The cli tests keep only the comments that say what their code cannot.** The suites under
  [`cli/`](../cli/) and the fixtures only they read drop the dates, proposal and milestone numbers,
  review rounds, pull request numbers and narration their comments carried. A comment stays where it states
  a host's behaviour at its version, an ordering or safety constraint, or what a test cannot prove, and
  four file-private names now say what a comment said. Their comments fall from 765,536 to 85,874 bytes,
  and [`cli/README.md`](../cli/README.md) renders each suite's new one-line header. The tree's comment
  lines recording history fall from 650 to none, and the
  [`comments`](../.portulan/verify/comments.sh) recipe's limit falls to 0, with its byte rail at
  261,520, the tree's 256,392 comment bytes plus 2%. What each test checks is unchanged.
