- **Sessions read code by symbol.** [`cli/symbols.mjs`](../cli/symbols.mjs) prints a code file's outline,
  one line per declaration, class member, test and titled section with its first and last line, so a
  session reads only the spans it needs with the Read tool's `offset` and `limit`; `--find <name>` says
  where a name is defined in the tracked code. It reads JavaScript and shell with no dependency and prints
  from the code as it is, so nothing is committed to go stale. The rule in
  [`core/operating/context.md`](../core/operating/context.md) keeps whole reads for a file under 300 lines
  that the task changes. On the 130 code files this repository tracks with this change, the outlines come
  to 8% of the code's bytes.
