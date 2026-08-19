# packs/tools/

Tool packs — integrations for the tools and MCP servers an agent drives (issue trackers, cloud
CLIs, design tools, databases), with the how-to and the gate classification for each.

> **One tool pack exists** — [`github/`](github/README.md). The machinery that reads one is a gate policy in a
> host-neutral vocabulary, dispatched on by [`../../cli/compile.mjs`](../../cli/compile.mjs) — and the
> cascade's missing middle (`core < pack < workspace`) is now bridged: a pack's `contributes.gates`
> fragments are resolved and merged into the policy, **tighten-only**, by the same compiler.
>
> The first pack to use it is a *ritual* one ([`../rituals/checkpoints/`](../rituals/checkpoints/)), so
> the promise this file has carried since it was written — that a tool pack ships "with the gate
> classification for each" — is now buildable and still unbuilt. A tool pack becomes worth writing when
> a workspace here drives a tool that needs one.
