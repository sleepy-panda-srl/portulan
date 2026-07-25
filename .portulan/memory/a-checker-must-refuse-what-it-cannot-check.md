**type:** rule
**scope:** workspace — anyone writing a validator, linter, or compiler here
**provenance:** `form=link` `href=../../spec/README.md`
— the declared JSON Schema subset, written in milestone 2 session 1 with the reasoning that a validator
carried rather than depended on must be small enough to implement completely. Session 2 built the
validator and found that the sentence had no mechanism behind it: nothing would have stopped a schema
author writing `maxLength` and nothing would have told them it did nothing.

A checker that meets an input it does not understand must **refuse it**, not skip it. Where `doctor`
encounters a JSON Schema keyword outside the subset it implements, an `additionalProperties` value other
than literal `false`, or a `$ref` carrying a constraint-bearing sibling, it exits `2` — *could not run* —
rather than validating the rest and reporting a verdict.

**Why it holds:** skipping is indistinguishable from enforcing, from the outside. An author writes a
constraint, the validator reports conformance, and the constraint was never applied — so the schema says
one thing, the machine does another, and the gap is silent in exactly the direction that matters. This is
the same asymmetry as a verify recipe that reports green having enumerated nothing
([`verify-preconditions-fail-closed.md`](verify-preconditions-fail-closed.md)), one level up: there the
tool could not see its inputs, here it cannot see its rules. A validator is where this hides best,
because nobody reads a passing validator's output.

It also makes true a sentence [`../../spec/README.md`](../../spec/README.md) had only asserted — that a
schema change reaching outside the subset *is a change to `doctor` too, and the two land together*. Now
the schema change fails until the validator catches up.

**When to apply:** whenever a tool here interprets a declarative input — a schema, a manifest, a gate
map, a compiled rule set. The test: if this input contained a directive I do not implement, would I say
so, or would I return a verdict computed from the part I understood? Only the first is honest.

**A limit worth stating rather than discovering.** This is enforced for the *schema* and not for
everything `doctor` reads. The claims lint deliberately does the opposite — it parses conservatively and
leaves alone what it cannot confidently read — because there the alternative is false reds on ordinary
prose, and a false red gets a whole recipe switched off. The distinction is between a **declarative
contract**, where every clause is meant to bind and silence is a lie, and **prose**, where most of it was
never a claim at all.

**Retire when:** the validator implements full JSON Schema, or is replaced by a dependency that does — at
which point the rule should *move* to whatever the new unimplemented edge is rather than be deleted,
because a complete implementation of anything is a thing to be sceptical of.
