# Handoff — two sessions built one module, and the order decided itself

2026-08-09, the pack-root half of row 7's discovery clause
([#123](https://github.com/sleepy-panda-srl/portulan/issues/123)), rebuilt on top of
[#181](https://github.com/sleepy-panda-srl/portulan/pull/181) after both landed on the same file.

## The collision, and why this branch was rebuilt rather than rebased

Two sessions ran discovery in parallel and **each created `cli/discover.mjs`**, with different APIs.
Measured before deciding anything: a trial merge conflicted in **15 files** — both modules, both test
files, `compile`, `doctor`, `index`, `doctor.test`, `init.test`, `spec/README`, `spec/slots`,
`spec/workspace.schema.json`, the boot skill, `cli/README`, `CHANGELOG` and `docs/plan`.

The halves are **complementary in capability and colliding in file**: #181 resolves a *workspace* by
name for a pointer, as a subcommand with exit codes; this one resolves the roots a declared *pack* is
looked up under. The overlap was exactly three things — the config directory, the record read, and
workspace-by-name.

**Coordination, then the order settled itself.** I proposed #181 first (older, owns the primitives, and
#134 was blocked on it) and offered to rebase. #181 merged at 09:08Z before the reply came, which is the
order I had asked for, so the rebase is what happened. This branch was **rebuilt from `main`** rather
than rebased: three commits against a 15-file conflict would have been a hand-merge over someone else's
design, and re-applying only this half onto theirs is the smaller, checkable operation.

**What was cut, deliberately:** this branch's own `hostConfigDir`, `readInstalledPlugins`,
`MANIFEST_RELATIVE`, `SUPPORTED_VERSIONS` and `discoverWorkspace` — all superseded by #181's
`configDir`, `readInstalls`, `RECORD`, `RECORD_VERSIONS` and `resolveGovernor`. **One reader, one config
directory, one version refusal.** What survives is `AUTO`, `isPackRoot`, `discoverPackRoots`,
`resolutionRoots` and the `--pack-root auto` wiring on five tools.

**One thing travelled the other way.** #181's `readInstalls` did not check the record's top-level
`version`; this session flagged it as a real gap rather than a preference — the file belongs to the
host, a later version may move `installPath`, and a reader that guessed would report roots that are not
roots. `main`'s top commit is *"Round 8: the record's version was trusted without being read"*. The
coordination paid for itself once in each direction.

## The finding that matters most, and it is not the collision

**The first draft of this half could not see either plugin the private feed actually ships**, and the
suite was green throughout. It probed `<installPath>/packs` and `<installPath>/.portulan/workspace.json`
— the shape a plugin has when it *is* a repository checkout. Both `portulan-internal` plugins are
**flat**: categories at the install root. So discovery built to resolve a pack *from a feed* found
nothing on the one feed it was built for.

Nothing in the repository could have caught it: the fixtures encoded the same assumption as the code. A
pre-commit checkpoint caught it by looking at a **real install**. `isPackRoot` now asks the resolver's
own question — does this directory hold `<category>/<name>/pack.json` — rather than looking for a
directory named `packs`, and #181's `host()` test fixture gained `packs` and `shape` so both layouts are
pinned in the one builder rather than a second one.

## The narrowing, which is the maintainer's to rule on

Discovery affects resolution **only when asked**. The row says *"optional where discovery finds a
root"*; what shipped leaves `--pack-root` never *mandatory* but not *optional* either.

The reason is measured, not preferred: `examples/workspace.json` declares packs and no `tree`, and
`.portulan/verify/doctor.sh` grades `examples` — so an unasked-for discovered root made a **required
recipe** read `~/.claude` on every run, and `doctor` fails an unresolved pack where a root exists while
merely noting it where none does. **Red locally, green in CI.** Recorded as a narrowing in five carriers
rather than dressed as a reading. The broader default is one branch in `resolutionRoots`.

## State

Suite **1120**, nine recipes green. `--repo-root` stays named-only — a repository checkout is not
something a plugin record lists, and the amendment's title names the plugin cache. Row 7 is **not**
closed: `upgrade`, `feedback`, persona↔agent binding, legibility, verify composition, clause (b) parity,
the interview, the index rail and five of six demonstrations remain.
