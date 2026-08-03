# Template — Workspace

> A **workspace** is the per-team layer of the resolution cascade: identity, principles, gate map, verify
> recipes, definition of done, memory. Core and packs carry the universal best practice; the workspace is
> where a team's own specifics live, and **they live only here** — core and packs never absorb them.
> Copy the skeleton below into `workspace.json` at the workspace root and fill it. (Placeholders are in
> `{braces}`.) _(The binding contract is
> [`../../spec/workspace.schema.json`](../../spec/workspace.schema.json), with per-slot rationale in
> [`../../spec/slots.md`](../../spec/slots.md). Those are the authority; this template is a starting
> point.)_
>
> **`init` versus this template.** `init` onboards a **repository** — it asks where that repository's
> workspace resides, scans the tree, and drafts a workspace shaped by what it found. This template is for
> the case `init` does not cover: authoring a workspace by hand, or one that governs from outside a
> repository (a feed-side workspace, a portfolio workspace covering several products). If you are
> onboarding a repository, run `init` and curate what it drafts; you will get more than this skeleton.
>
> **A slot must be a whole file.** Not a fragment, not a heading inside a larger document — because a
> fragment-addressed slot cannot be link-checked, and a slot nothing can validate is a slot that drifts.
> That constraint did most of the design work in the Workspace Definition and it binds your workspace too.
>
> **`kind` decides what else is required.** A `repository` workspace must declare `tree` — the path to
> the repository whose claims its repo cards describe — because without it the claims lint has no ground
> to check against and degrades an entire check class to notes. A `pointer` workspace declares
> `governed_by` instead and materialises nothing: **one repository is governed by exactly one workspace**,
> and a pointer is how a repository says which one.

---

```json
{
  "portulan": { "spec": "2.7" },

  "name": "{kebab-case-name}",
  "summary": "{One line: whose workspace this is and what it governs.}",
  "kind": "{repository | pointer | portfolio}",
  "tree": "../",

  "slots": {
    "identity": "identity.md",
    "principles": "principles.md",
    "gates": "gate-map.md",
    "dod": "dod.md",
    "memory": "memory/",
    "repos": "repos/",
    "tasks": "tasks/",
    "handoffs": "handoffs/",
    "proposals": "proposals/"
  },

  "gates": "gates.json",

  "verify": {
    "default": "{recipe-id}",
    "recipes": [
      {
        "id": "{recipe-id}",
        "run": "{the command, as it would be typed from the repository root}",
        "requires": ["{tool}"],
        "doc": "verify/README.md"
      }
    ]
  },

  "packs": []
}
```

> **Delete the optional slots you do not have**, rather than pointing them at empty directories — a slot
> that resolves to nothing is a promise the tree cannot keep, and `doctor` fails a slot pointing at
> something absent. Add them back when the directory has content.
>
> **The `verify.default` is the recipe the Stop-gate runs**, so it is the one that decides what *done*
> means here. Two properties it must have, both learned the expensive way: it must exit **2** rather than
> 0 when it could not run — a recipe that cannot run must never look like one that ran and passed — and
> it must not be a stub that exits 0 while you decide, because that puts a false green under every gate
> from the day the workspace was created.
>
> **`packs` is a list of `category/name` references, and declaring one is what composes it.** A pack you
> list can add gate restriction and verify recipes to this workspace, so list only packs whose code you
> are willing to run.
