- **The cli modules' comments say only what the code cannot.** Across the 47 modules in
  [`cli/`](../cli/), 1,572 of 16,845 comment lines stay, 143,429 of 1,326,800 bytes, and none records a
  change's history, so the modules drop from 2,720,329 bytes to 1,537,070. What stays is each file's
  header with its usage and exit codes, one banner line per section, and the facts no name carries: a
  host's behaviour at its version, an ordering or a safety constraint, an export's contract. Where a
  comment said what a value held, one of five file-private names says it now, and no other code changes.
  Where [`.portulan/gate-map/compiler.md`](../.portulan/gate-map/compiler.md) and
  [`evals/README.md`](../evals/README.md) sent a reader to an argument those comments carried, they now name
  the `git show` that still holds it. The [`comments`](../.portulan/verify/comments.sh) recipe's limit falls
  to 650 and its byte rail to 954,776.
