# Boot Portulan — the reasons behind each step

> **Read on demand, never at boot.** [`SKILL.md`](SKILL.md) is the whole procedure, and every
> instruction a boot follows is there. This file holds the reasons, measurements and incidents behind
> those instructions, under the same step numbers; step 4 gives none, so it has no section. It was split
> out of `SKILL.md` on 2026-09-23, under proposal 0036: every boot paid for these paragraphs, and a boot
> needs them only when a step does not fit its case or someone asks why. They moved: none was deleted,
> and none is kept in both files.

## 1. Load the kernel

**Why only the kernel.** It is deliberately small — the resolution cascade, the loop, four
non-negotiables, and a map to the doctrine behind them. The kernel being small is the design, not an
accident.

**Why the read can be denied, and why a denial ends the boot.** `${CLAUDE_PLUGIN_ROOT}` is outside the
project directory, so a session whose file access is scoped to the project will refuse it: measured
2026-07-26 on a headless run with default permissions, where the boot correctly reported the absence of
a workspace while having no engine in context at all. Booting without the kernel is the same failure
shape as booting on the wrong workspace — it looks like a boot and it is not.

## 2. Find the workspace — in the project, never in this bundle

**Why the project only.** This plugin bundle ships three workspace manifests of its own — Portulan's,
used to build Portulan; a fictional demo under `examples/`; and a deliberately drifted fixture under
`cli/fixtures/` that exists to be invalid. All three sit inside `${CLAUDE_PLUGIN_ROOT}`. Booting on any
of them would load another team's identity, another team's gate map, and another team's definition of
done, and would look exactly like success.

### 2a. If the manifest is a pointer

**Why a pointer is the whole answer.** A repository is governed by exactly one workspace — its own, or
a pointer to the workspace that names it, never both.

**Why substitute the project root.** An unset variable expands to nothing and the command then asks
about `/.portulan`, which is not this repository.

**Why `state`, and not the exit code.** The exit codes are this step's mapping, where the manifest is
already known to be a pointer. The command itself also exits **0** for `resides-here`, its answer about a
manifest that is not one — so the exit code alone does not distinguish them, which is the reason reading
`state` is a rule rather than a preference. The resolution reads the host's installed-plugin record
**from disk**; nothing is fetched over the network, here or there.

**Why the resolved read is safe.** The repository's own manifest named this workspace; the resolver
matched on the governing manifest's `name`, the pointer's `feed` where it declares one, and refused an
ambiguity rather than ranking it. That chain is what makes the read safe. It does not reach the demo or
the drifted fixture either: the resolver looks in two named locations inside an **installed** payload
and nowhere else, and neither of those two sits at one. This bundle's **own** workspace is a different
matter — a pointer naming `portulan` would resolve to it wherever the plugin is installed, which is the
correct answer to that pointer rather than a hole.

**Why a resolved root can be unreadable.** `root` sits in the host's plugin cache; a session whose file
access is scoped to the project will refuse to read it, exactly as measured for `${CLAUDE_PLUGIN_ROOT}`
at step 1.

**Why a pointer is not "no workspace".** The difference matters to the person you are reporting to: a
repository with no workspace has not adopted Portulan, while this one has and its policy layer is one
install away — or already installed, which is now a thing you can find out rather than assume.

**Why name the residence.** The line is not decoration, on two counts. A resolved workspace is a
**pinned install**, so which version is loaded is the difference between two policy layers that may
legitimately differ; and *the same report an in-repo workspace produces* must not mean
*indistinguishable from one*.

**Why resolving the workspace does not resolve its packs.** A governing workspace found this way may
declare `packs`, and nothing here looks those up in the cache — that is the separate half of the CLI's
pack-cache discovery.

**Why ask for the install.** Booting on a pointer and proceeding as though you had the policy layer is
the same failure shape as booting on another team's workspace: it looks like a boot and it is not.

## 3. Read the slots the manifest names

**Why the slots, and not the manifest.** The manifest is an index, never a container: it names paths,
and the prose lives in Markdown at the other end of them.

**Why select the card.** A workspace resolved from a pointer is typically a portfolio governing several
repositories, so `repos/` holds cards for repositories you are not in. A governed repository with no
card is a real gap and reading a sibling's card instead is the wrong repository's build, test and
quirks presented as this one's.

### 3a. Read `packs` too

**Why named roots replace the derived one.** That is what lets *"this pack resolved from the feed"* mean
something a copy lying in the local tree cannot satisfy.

**Why the four are given in full.** Each is given in full rather than counted, because a bare figure
beside a mechanism goes stale the moment one of them moves.

**How skill registration was measured.** The one-level expansion was measured both ways on Claude Code
2.1.224, and registration's dependence on `.claude-plugin/plugin.json` alone on Claude Code 2.1.226, by
deleting the `packs` key from the governing workspace outright and reinstalling, which changed the
host's inventory not at all. So a composed pack's ritual was invocable by coincidence of a hand-written
path.

**What the registrable set is demonstrated on: two layouts** — this bundle's, where packs sit at
`./packs/`, and a workspace whose `tree` puts them elsewhere, which is the case an adopter is likelier to
have and the one a first cut got wrong in a way every test passed over.

**Why in the same breath.** A boot that lists a workspace's packs without it reads as though the middle
of the cascade had loaded.

## 5. Report what is enforced, and what is not

**Why the honest position.** The gap between what a framework *says* and what it *enforces* is the thing
an agent must not paper over.

**Why the four limits, and not a summary.** The cascade's middle is the layer a boot can least
demonstrate, and saying so is the honest position rather than a caveat.

**Why the version.** That install is pinned and a different pin is a different policy layer. A boot that
does not say which of the two it loaded leaves the reader unable to tell a stale install from a current
one.
