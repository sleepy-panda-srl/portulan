- **A repository's own `CLAUDE.md` can leave every context section by section, and nothing of it is
  lost.** A team marks a section with a line `<!-- portulan: on-read -->` under its heading, and
  `upgrade`'s form step `0009` moves it, heading and all and byte for byte, into an on-read unit of
  `slots.context`, leaving a comment where it was that Claude Code drops before it loads the file; the
  on-read index then carries one line for it, and every index line now names its unit's size in whole KB.
  The split is proved before anything is written: the file must reassemble from its units byte for byte
  and every clause land once, kept or moved, or nothing moves; a section importing a file and a mark
  inside a marked section or under no heading are refused with the reason, and a marked `CLAUDE.md` that
  is a link is named to make a file of its own while `upgrade` runs its other steps. `doctor`'s context
  line, the boot and `init` offer the split where an instruction file is over 8,000 tokens, and `doctor`
  and the boot wherever a declared budget is breached, naming the largest sections; `doctor` reports
  marks waiting and markers naming a unit that is gone; and
  [`cli/instructions.mjs`](../cli/instructions.mjs) is the same split on the command line, where a
  breached budget stops `upgrade`, with `--join` to put every section back, saying which unit was edited
  since and refusing one re-tiered. On an invented consumer, marking three of eight sections takes 8,633
  bytes out of every context, about 2,887 tokens at 2.99 bytes a token, an estimate: its `CLAUDE.md` goes
  from 15,866 bytes to 7,049, for 184 bytes of index.
