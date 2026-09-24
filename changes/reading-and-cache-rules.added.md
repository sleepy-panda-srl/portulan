- **Every boot card, Portulan's and each consumer's, carries five rules on what a session's reads, output
  and pauses cost on every request after them.** Send independent tool calls in one request; read a file
  once; open one of 300 lines or more only at the part the task needs; ask for only the output you need;
  and stay within the prompt cache's lifetime, resuming a worker rather than starting one. They sit
  in [`core/operating/context.md`](../core/operating/context.md) with their reasons and the host facts
  behind them, and `compile` writes their leads onto each card from the Portulan it ships with, through a
  new `<!-- engine: … -->` line, so every card carries one text. [`cli/symbols.mjs`](../cli/symbols.mjs)
  now outlines a Markdown file by its headings with each section's anchor and size, and `<file>#<heading>`
  prints one section; a `<!-- leads: … -->` line may name a heading too. `upgrade` gives a card drafted
  before this the section in a new `form` step, `0008`, compiled in the same run; a card whose head it
  does not recognise it names, as `doctor` does, with the line to add by hand, then applies the rest of
  the chain and exits 1. The kernel and the boot skill moved their framing to files read on demand to pay
  for the lines: Portulan's own always tier is 317 bytes smaller and its boot 625, and a fresh consumer's
  boot reads 7,827 bytes, down from 8,219, while its card grows 543 bytes by the rules.
