# Product — Portulan

> The **product layer** for one product ([`../../../spec/workspace.schema.json`](../../../spec/workspace.schema.json)):
> mission, what it is, why it exists. Deliberately short and pointer-heavy — the full statement is the
> constitution, [`../../../docs/vision.md`](../../../docs/vision.md), and a summary that drifts from it
> is worse than no summary. What belongs *here* is the working orientation an agent needs before it can
> judge whether a change serves the product.

**Mission.** Give a team the tailored context, standards, gates, and institutional memory that make any
coding agent work *their* way — and make that layer durable enough to outlive whatever host or
orchestrator is fashionable.

**What it is.** An open-core operating framework, shipped as files: a universal engine
([`../../../core/`](../../../core/)), a per-team workspace layer (this directory is one), composable
packs, a spec, a plugin, and a CLI. There is no service and no UI, and that is a design commitment
rather than a stage — see the non-goals in the constitution.

**Why it exists.** Hosts keep absorbing workflow machinery, and each absorption deletes somebody's
orchestration layer. What no platform can absorb is the customer's own context — their standards, their
workspace, their memory, their evals. Building at that layer is the bet: *design for deletion* above,
*compound* below.

**Why it is ours to build.** The concepts were proven in real production engineering practice before
they were written down here; the value being added is the re-expression into something a team other than
its author can adopt in an afternoon.

**Stage, honestly.** Pre-release, and public since 27 July 2026; the newest release entry is `0.2.0`. The
engine, this workspace, the enforcement compiler and the memory lifecycle are authored; the CLI
milestone 7 describes is two subcommands short — `upgrade` and `feedback` (`init`, `new` and `vendor`
shipped at milestone 7 sessions 1, 2 and 3). What that release
contains, and what it does not,
is [`../../../CHANGELOG.md`](../../../CHANGELOG.md), which is where that list
belongs rather than here. The living map is
[`../../../docs/plan.md`](../../../docs/plan.md), and it is the file to trust over this one whenever the
two disagree about status.

**Provenance.** Written in milestone 2, when the Workspace Definition gave the product layer a slot of
its own. Before that it was a section of [`../../identity.md`](../../identity.md), which does not scale
to a workspace covering more than one product — which the Sleepy Panda portfolio workspace (milestone 6)
will.
