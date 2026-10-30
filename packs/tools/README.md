# packs/tools/

Tool packs — integrations for the tools and MCP servers an agent drives (issue trackers, cloud
CLIs, design tools, databases), with the how-to and the gate classification for each.

> **Two tool packs exist** — [`github/`](github/README.md) and [`local-llm/`](local-llm/README.md). The
> machinery that reads one is a gate policy in a host-neutral vocabulary, dispatched on by
> [`../../cli/compile.mjs`](../../cli/compile.mjs) — and the cascade's missing middle (`core < pack < workspace`)
> is bridged: a pack's `contributes.gates` fragments are resolved and merged into the policy,
> **tighten-only**, by the same compiler.
>
> [`local-llm/`](local-llm/README.md) is the first tool pack to ship a gate classification
> (`local-llm-off-loopback` at `propose`) alongside a skill, a persona, and an offline verify recipe,
> fulfilling the promise this file has carried since it was written.
