- **The constitution is cited by its sections, and says each thing once.** Code, tests and the spec
  that quoted [`docs/vision.md`](../docs/vision.md) word for word now name the section, as
  `vision.md § thesis 4` or `vision.md § *Delivery tiers*`, and
  [`cli/vision-sections.live.test.mjs`](../cli/vision-sections.live.test.mjs) holds every such citation
  to a section the file has. Freed from its quotes, the file keeps every rule and decision: the CLI
  glosses under *Delivery tiers* keep what binds each subcommand and leave the rest to the code, and
  what it said twice sits in one place. It drops from 9,385 to 8,762 bytes, 7.4% under its 9,459
  before the flattening, and a session following a citation reads one section, 71 to 555 bytes.
