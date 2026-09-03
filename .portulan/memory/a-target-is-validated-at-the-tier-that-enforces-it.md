**type:** rule
**scope:** workspace — anyone writing a gate policy, or a compiler that turns one into enforcement
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/336`
— milestone 8, clause (a): the gate corpus's **first run**, which found the divergence by attacking the
matcher rather than by reading it. The three answers it raised are
[#337](https://github.com/sleepy-panda-srl/portulan/issues/337), and this rule is minted with the one
the instruments chose.

A rule's **target** is validated where its **tier** is decided, not once for every tier at the door. A
target that can never match is harmless at a tier no backend enforces and is a hollow gate at a tier
that does — the same value, two different facts — so a check that answers before the tier is known must
either refuse both or accept both, and each is wrong for one of them.

**Why it holds.** `write: "./"` in this repository's own policy is correct at `auto`: nothing compiles
it, nothing asks the matcher, and the sentence in the policy is a statement of intent for a human. The
identical rule at `gated` compiles to `Edit(./)` — a named permission surface — while `matchesRule`
answers `false` for every path a host submits. The compiler then reports the rule **compiled** and
`doctor` counts it **covered**, so the gate map, the artifact and the coverage report all agree about a
gate that enforces nothing. Refusing the shape at the door would have taken the two correct `auto` rules
with it; measured, that reds two recipes and makes three others *could-not-run*, which reports less
about the tree than doing nothing.

**The generalisation beyond gate policy.** Wherever a declaration carries both a *what* and a *who
enforces it*, validity is a joint property of the pair. A validator placed before the second half is
known is structurally unable to be right about both, and the tempting repair — tighten at the door,
since earlier is safer — is the one that breaks the legitimate case silently.

**When to apply:** when adding a check to a compiler, a schema, or a linter that reads a policy in
stages. Ask which stage knows the consumer. If the answer is "a later one", the check belongs there,
even though putting it earlier would catch the same input sooner.

**How this differs from the two rules next to it.**
[`a-checker-must-refuse-what-it-cannot-check.md`](a-checker-must-refuse-what-it-cannot-check.md) says a
checker meeting an input it does not understand must refuse rather than skip; here the checker
understood the input perfectly and the question was *whose* question it was.
[`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md) governs a
document naming an enforcer that does not enforce; here the enforcer was real, the artifact was written,
and the target it named could not be reached. This one is about **placement**: the right check, correct
in itself, at a stage that cannot know whether it applies.

**Retire when:** the gate-policy spec gives *the whole repository* a supported spelling, or a stage
earlier than the backends comes to know which tiers each backend enforces. Either would make the
placement argument moot — the first by removing the legitimate `auto` case, the second by moving the
knowledge rather than the check. Neither is in sight, and what `./` should mean as a policy target is
still nobody's ruling.
