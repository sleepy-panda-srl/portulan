**type:** rule
**scope:** workspace — anyone adopting a rule here that no machine yet enforces
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/8`
— proposal `0002` was accepted on 2026-07-25 and its two-form provenance mandate written into the spec,
the schema, and two core templates the same day. When `doctor` ran against this workspace for the first
time one session later, **three of the five rules here did not satisfy it**: two written before the
mandate and one written the day it was adopted.

When a rule is adopted before the check that enforces it exists, assume the existing corpus already
violates it, and say so in the adopting change. The gap between *adopted* and *enforced* is where a
mandate quietly becomes decoration.

**Why it holds:** the failure is not that people ignore new rules. It is that adopting a rule feels like
a completed action — the reasoning was hard, the decision was made, the documents were written — and the
back-catalogue is invisible at the moment of adoption because nothing enumerates it. Every author of
those three entries would have said the workspace complied. Nobody was wrong on purpose; nobody looked,
because looking required a tool that was one session away.

The cost compounds in a specific direction. A mandate that the corpus silently violates makes the *next*
check look like it broke something, so the pressure at that moment is to soften the check rather than fix
the corpus — which is the one change that makes every future green mean less
([`../gate-map.md`](../gate-map.md), on relaxing a check).

**When to apply:** at the moment a rule is adopted without a rail behind it. Two concrete moves, both
cheap: name in the adopting change how many existing records satisfy the new rule and how many do not
(counting by hand is usually a `grep`), and record the enforcement gap as a dated open item rather than a
milestone note. If neither is affordable, the rule may still be worth adopting — but write down that the
corpus is unaudited, so the first red is understood as arrears rather than as a regression.

**What it does not say.** Not "never adopt a rule before its rail exists". The adoption in this case was
right: the mandate had to be settled before `doctor` could be written against it, and the alternative —
building the check first and legislating around what it happened to do — is exactly the inversion this
repository refuses. Related: [`a-checker-must-refuse-what-it-cannot-check.md`](a-checker-must-refuse-what-it-cannot-check.md).

**Retire when:** rule adoption and rule enforcement land together as a matter of course — realistically
when the librarian (milestone 5) can enumerate the corpus against a proposed rule at the moment it is
proposed, which is the tool that makes the manual count unnecessary.
