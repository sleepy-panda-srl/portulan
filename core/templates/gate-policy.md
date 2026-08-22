# Template — Gate policy

> A **gate policy** binds this team's concrete actions to the engine's tiers — Auto / Propose / Gated /
> Prohibited — in machine-readable form, so the gate map stops being prose and starts being enforcement.
> `compile` reads it and emits host hooks and permissions, plus a repository-ruleset export for the
> platform floor. Copy the skeleton below into `gates.json` and fill it. (Placeholders are in `{braces}`.)
> _(Provenance: the safety culture inherited from the predecessor practice — gates classified by
> undoability; 12-Factor Agents — compact, auditable policy. Tier semantics are fixed by
> [`../operating/autonomy.md`](../operating/autonomy.md), which is the authority.)_
>
> **Write the `why` before you write a rule.** A policy with no rationale is taste, and the `reason` on
> each rule is what an agent reads when it is refused — a refusal whose reason is a rule id is
> indistinguishable from a bug.
>
> **The compiler adds restriction only.** It emits `ask` and `deny` and never `allow`, so `auto` rules
> compile to nothing by design: an action nobody restricted is already permitted, and emitting a grant
> would let a policy widen what a host allows. That asymmetry is the whole safety property — read it
> before concluding a rule "did not work".
>
> **A compiled gate matches a spelling, not an intent.** A command reaching a gated action by another
> route escapes it, and one wrapper level is peeled and no more. What is indifferent to spelling is the
> **platform floor** beneath — branch protection, required checks, PR-as-gate — which is why the floor is
> a separate block below and not a rule among the others.

---

```json
{
  "portulan": { "spec": "2.2" },

  "why": "{Why this team gates what it gates — the sentence a new agent reads first. Name the blast radius you are protecting, not the tools you are restricting.}",

  "floor": {
    "branch": "{default branch}",
    "checks": [],
    "reviews": 0,
    "resolve_conversations": true
  },

  "rules": [
    {
      "id": "{rule-id}",
      "tier": "prohibited",
      "action": { "write": "{path that must never be machine-edited}" },
      "reason": "{Why, and what to do instead. Prohibited means no yes makes this acceptable — if a human could approve it, it is Gated, not Prohibited.}"
    },
    {
      "id": "force-push-without-a-lease",
      "tier": "gated",
      "action": { "shell": "git push --force" },
      "reason": "{Why a human must approve each time. Prefer the undoability test: what does it cost if this was wrong and nobody noticed for a week?}"
    },
    {
      "id": "delete-a-ref",
      "tier": "gated",
      "action": { "shell": "git push --delete" },
      "reason": "{Why a deletion waits for a person. These two ids and actions are filled in already — they are the two destructive ref spellings the floor backend can express, and a `floor` block with no rule reaching it refuses to compile.}"
    },
    {
      "id": "{rule-id}",
      "tier": "propose",
      "action": { "write": "{path}" },
      "reason": "{Why this lands as a proposal rather than a direct change.}"
    }
  ]
}
```

> **`floor` is exactly four keys, and they are the four `compile` reads** — `branch`, `checks`,
> `reviews`, `resolve_conversations`. It is not a free-form block: `reviews` is a non-negative integer
> and `resolve_conversations` a boolean, both required, because a floor that omitted them would export
> one weaker than the one already in force. _(Until 2026-08-22 this skeleton emitted
> `require_pull_request` and `block_force_push` instead — two keys no version of the compiler has ever
> read — beside a `portulan.gates` version key it does not read either. A scaffold the next documented
> step refuses is the defect this template's own closing paragraph warns about, one layer up;
> [#329](https://github.com/sleepy-panda-srl/portulan/issues/329) reported it, and `new`'s test now
> scaffolds this file and compiles it rather than only checking that it was written.)_
>
> **`checks: []` is deliberate and you should probably leave it that way at first.** A floor requiring a
> status check that no workflow job reports is a red nobody caused — a fresh repository reports no checks,
> and a real one reports something else, so any name guessed here fails on the first run. Add the check
> once it exists and you know its exact context name. The consequence, stated because it is not obvious:
> with no checks declared, every `propose` rule compiles to nothing in the floor backend.
>
> **Which tiers compile depends on the backend, and there are two.** For a host-hook backend, `gated`
> prompts and `prohibited` refuses, while `auto` and `propose` emit nothing. For the **floor** backend the
> partition inverts: `propose` is exactly what a repository ruleset enforces. Run `compile --matrix` to
> print every rule against both rather than reasoning about it — the refusals are printed, never silent.
>
> **Start with the rules that destroy rather than create.** A ref deletion and a force-push are the two
> **destructive ref spellings** the floor backend can express — it also emits `pull_request` and
> `required_status_checks` for a `propose` rule once `floor.checks` is non-empty, which is the paragraph
> above — and they are the two whose damage is hardest to undo, so they are a policy's
> honest first pair — so the skeleton above ships them filled in rather than as placeholders, which is
> also what keeps the `floor` block reachable. Their `reason` is still yours to write.
