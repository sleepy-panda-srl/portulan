# Verify recipes

> The executable half of "done". Core defines the hierarchy — *it compiles < the tests pass < the
> behaviour was exercised* — and the Stop-gate contract that makes climbing it non-optional
> ([`../../core/operating/verification.md`](../../core/operating/verification.md)). A workspace supplies
> the recipes themselves, because what "green" means is a property of the repository.

## The recipe

[`docs.sh`](docs.sh) is the default recipe for this repository. Run it from anywhere in the tree:

```
./.portulan/verify/docs.sh
```

Exit `0` green · `1` red · `2` could not run. It needs `git`, `bash`, and coreutils — nothing else, on
purpose: a recipe that needs a toolchain is a recipe that stops being run.

## Where this sits in the hierarchy — honestly

This repository has no code yet, so there is nothing to compile and no suite to pass. That puts these
checks on the bottom rung, and the honest description is that they exercise the *documents* the way a
linter exercises source. Real tests join them — they do not replace them — when the CLI arrives at
milestone 7, at which point this becomes one recipe among several and the workspace names the default.

Saying so matters: a recipe that implies more coverage than it has makes every later green worth less.

## What each check enforces, and why it is a rail

| Check | The rule | Why it is machinery rather than a reminder |
|---|---|---|
| `links` | Every relative Markdown link resolves. | The engine is a web of cross-references between doctrine, templates, personas, and skills — progressive disclosure *is* those links. A dead link in a framework about context engineering is a product defect, not a docs defect. |
| `kernel` | [`../../core/engine.md`](../../core/engine.md) stays within 60 lines. | The always-loaded layer is the scarcest thing the framework spends, and the budget is constitutional. A budget that lives only in prose is the first thing a busy session negotiates with. |
| `map` | Every top-level entry appears in the root `README.md` layout table. | Agent legibility: a repository whose own map omits directories teaches an agent a false shape of the ground. This one exists because that had already happened — see below. |

## Provenance

The `map` check was added in milestone 1, session 3, after a fresh-context supervisor noticed that
`.claude-plugin/` — the manifest that makes this repository a plugin marketplace — had been missing from
the root README's layout table since the repository was created. The check was written **before** the
fix, went red on two entries, and went green only once the table was corrected. Recorded as
[`../memory/readme-map-must-match-shape.md`](../memory/readme-map-must-match-shape.md).

That sequence is the doctrine's own loop — mistake → rule → rail, with the incident carried along so the
rule can be retired if it ever stops applying
([`../../core/operating/evolution.md`](../../core/operating/evolution.md)).

## Known limits

- **Anchors are not checked.** A link to `file.md#section` verifies only that `file.md` exists. Checking
  fragments needs a heading parser, and the failure it would catch is milder than the one it would add:
  false reds train people to stop trusting the recipe.
- **External URLs are not fetched.** Deliberate. A verify recipe that needs the network fails for reasons
  unrelated to the change under test, and a flaky gate is worse than no gate.
- **Link targets are matched by the filesystem's rules, not GitHub's.** On a case-insensitive volume —
  the macOS default — the existence test accepts `Core/engine.md` for `core/engine.md`, so a wrong-case
  link passes locally and 404s once the repository is browsed on GitHub or cloned onto Linux. Resolving
  targets against `git ls-files` instead would close it; until then this is a known false green, recorded
  rather than left to be discovered.
- **Nothing here checks prose quality**, and nothing can. Conditions 2–4 of [`../dod.md`](../dod.md) are
  human judgement and are meant to stay that way.
