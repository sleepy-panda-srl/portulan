# packs/tools/

Tool packs — integrations for the tools and MCP servers an agent drives (issue trackers, cloud
CLIs, design tools, databases), with the how-to and the gate classification for each.

> Placeholder. No tool pack exists yet. Milestone 4 built the thing that would read one — a gate policy
> in a host-neutral vocabulary, dispatched on by [`../../cli/compile.mjs`](../../cli/compile.mjs) — but
> the policy is a **workspace** slot today and no pack contributes to it. That is the cascade's missing
> middle (`core < pack < workspace`) and the first real tool pack is where it stops being theoretical.
