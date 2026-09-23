- **The boot skill reads its pointer and pack steps only where they apply, halving it for a workspace
  that uses neither.** `/portulan`'s [`SKILL.md`](../plugin/skills/portulan/SKILL.md) keeps every other
  instruction and moves step 2a, resolving a pointer manifest, into
  [`pointer-manifest.md`](../plugin/skills/portulan/pointer-manifest.md), and step 3a, what declared packs
  deliver, into [`packs.md`](../plugin/skills/portulan/packs.md); a boot opens each only where its condition
  holds. The skill drops from 17,813 to 8,917 bytes. A workspace naming packs, as the demo does, reads
  15,198, and the demo's boot read-set drops from 36,195 to 33,580; a pointer to a workspace naming packs
  reads 1,833 more than before. It is the maintainer's amendment to proposal
  [`0036`](../.portulan/proposals/0036-what-a-host-loads-into-every-context-is-budgeted.md), and it arrives
  with the plugin upgrade.
