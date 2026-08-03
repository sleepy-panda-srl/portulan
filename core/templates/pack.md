# Template — Pack

> A **pack** is the cascade's middle layer — `core < pack < workspace < repo card < task` — and its
> manifest declares what it contributes to that cascade: skills, personas, verify recipes, and
> gate-policy fragments. It is an **index, not a container**: the content lives in the files the paths
> point at. Copy the skeleton below into `pack.json` at the pack's root and fill it. (Placeholders are in
> `{braces}`.) _(Provenance: platform engineering — golden paths for packs. The binding contract is
> [`../../spec/pack.schema.json`](../../spec/pack.schema.json), which is the authority; this template is
> a starting point and does not restate its rules.)_
>
> **Three things this template cannot decide for you, and each has bitten somebody.**
>
> **The category is not decorative.** A `stacks` pack profiles a language or framework, a `tools` pack
> integrates a tool or MCP server and ships the gate classification for each, and a `rituals` pack
> carries a repeatable procedure that composes onto the loop. It is spelled as the directory that holds
> the pack, so the canonical `category/name` reference and the tree agree by construction rather than by
> discipline.
>
> **`contributes` is required even when it is empty of a given kind** — a pack contributing nothing is a
> plugin, not a pack, and the manifest should say which it is rather than leaving it to be inferred from
> four absences.
>
> **A gate fragment may only ever ADD restriction.** It may raise a tier or add a prohibition and may
> never demote another layer's classification, and a fragment naming an id a lower layer already carries
> must keep that rule's `action` **unaltered** — raising the tier while replacing the matcher passes
> every tier comparison, is reported as a tightening, and removes the gate. That was measured on a real
> policy, not imagined. `auto` is absent from the tier enum for the same reason: it is the absence of
> restriction, so a pack declaring it could only be attempting a demotion.

---

```json
{
  "portulan": {
    "pack": "1.0",
    "version": "0.1.0"
  },

  "name": "{kebab-case-name}",
  "category": "{stacks | tools | rituals}",
  "summary": "{One line an agent can read before loading anything else.}",
  "doc": "README.md",

  "contributes": {
    "skills": ["skills/"]
  }
}
```

> **Why `personas`, `verify` and `gates` are absent from the skeleton above rather than present as placeholders.**
> A scaffold has to **validate on the run after it is written**. An id placeholder like `{recipe-id}`
> fails `$defs/slug`, and `{propose | gated | prohibited}` fails the tier enum — so a manifest carrying
> them is red the first time anybody checks it, on a workspace the tool just created. `personas` joins
> them for the same reason found one layer along: a `personas/{role}.md` placeholder *passes* the schema,
> because it is a well-formed relative path — and then fails the check that **opens** it, which the same
> change that wrote this template also added. Validating the shape and forgetting the opening is the
> narrower version of the very mistake this paragraph is about. That is a red the
> author did not cause and cannot act on except by deleting what was handed to them, and it is the exact
> shape this project has already shipped once and had to fix. Add the three keys below when you have real
> values for them; an absent key contributes nothing of that kind, which is the honest state until then.
>
> ```json
> "personas": ["personas/my-role.md"],
>
> "verify": [
>   {
>     "id": "my-recipe",
>     "run": "{the command, as it would be typed from the ADOPTER's repository root}",
>     "requires": ["bash"],
>     "doc": "README.md"
>   }
> ],
>
> "gates": [
>   {
>     "id": "my-rule",
>     "tier": "gated",
>     "action": { "shell": "{command prefix}" },
>     "reason": "{Why the rule exists, in your own words, and what the agent should do instead. This sentence is what an adopter reads when a pack they installed refuses something — a refusal whose reason is a pack name is indistinguishable from a bug.}"
>   }
> ]
> ```

> **Delete the keys you do not contribute.** Every one is optional, and an empty array is not the same as
> an absent key: `minItems: 1` refuses the empty array, so a pack that declares `"verify": []` fails
> validation rather than declaring nothing. Say nothing instead.
>
> **What a composed recipe may and may not do**, because it is the part that can be got wrong silently:
> composition is **additive only** — a pack may add a recipe and may never redefine, remove or replace
> one the workspace declares, nor become the workspace's `verify.default` — and a composed recipe is
> namespaced by its pack, so a collision is impossible rather than resolved. These limits are **not a
> security boundary** and should not be read as one: a recipe's `run` is arbitrary shell, and a workspace
> that lists your pack has already consented to running your code. What they prevent is narrower and is
> the thing worth preventing — a pack silently changing what the adopting workspace's **green means**.
