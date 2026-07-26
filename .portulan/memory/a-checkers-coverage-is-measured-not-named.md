**type:** rule
**scope:** workspace — anyone adopting a checker written elsewhere, or citing one as evidence
**provenance:** `form=link` `href=../handoffs/2026-07-26-plugin-and-public-marketplace.md`
— milestone 3, session 0, where two validators were run against the same tree within the same hour and
each returned GREEN on a defect the other caught.

A checker's **coverage** — which artifacts it actually examined — is established by forcing a red in each
artifact class and watching it fail. It is never inferred from the tool's name, its documentation, or a
green exit code. Until that has been done, "the validator passes" means only "the validator passed",
which is a fact about the tool and not about the tree.

**Why it holds:** a passing validator produces no evidence of what it looked at, and nobody reads a
passing validator's output. Both halves of this repository's packaging check were adopted on a reading of
what they *sounded* like they covered, and both readings were wrong in the direction that flatters:

- The repository's own `plugin-lint` reported GREEN on a `plugin.json` declaring `"agents":
  ["./plugin/agents/"]`. `claude plugin validate --strict` refused the same file outright — that field
  requires explicit `.md` files. The lint had resolved the path, walked the directory, and read every
  agent behind it; it was not lazy, it simply does not own that contract.
- `claude plugin validate --strict` reported GREEN on this repository with a `SKILL.md` whose frontmatter
  had been deleted, whose `description` had been emptied, and whose `name` was not kebab-case — three
  separate forced reds, all passed. Measured further: at a **marketplace root** it validates no skills at
  all, and in **plugin** form it validates only skills under the default `./skills/` directory. Every
  skill this repository ships sits behind a *custom* declared path, so the first-party validator examines
  none of them.

Neither tool is a superset of the other, and the tempting sentence — *"the first-party validator is the
authority, so the repo lint is a convenience"* — is false in both directions. It was in a draft of this
milestone's plan before anyone measured.

**When to apply:** before citing any check as evidence that something holds — in an exit criterion, a
definition-of-done condition, a session log, or a pull-request description. Also whenever a checker is
adopted, replaced, or upgraded: coverage is a property of a version, not of a name. The test is one
question: *what did I break to prove this check would have caught it?* If the answer is nothing, the
check is unmeasured, whatever colour it printed.

**How this differs from the two rules next to it.**
[`a-checker-must-refuse-what-it-cannot-check.md`](a-checker-must-refuse-what-it-cannot-check.md) governs a
checker *we write* — it must refuse an input it does not understand rather than skip it.
[`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md) governs a
rule with no checker behind it at all. This one governs the case where a checker exists, runs, and is
green — and simply never looked at the thing being claimed. That is the hardest of the three to notice,
because everything about it appears to be working.

**Retire when:** the checkers in use report their own coverage — naming the artifacts they examined, not
only the defects they found — so that a green states its own scope. At that point this rule's work is
done by the tool, which is the right place for it. Until then it is judgement, and it costs one forced
red per artifact class.
