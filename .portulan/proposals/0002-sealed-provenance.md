# Proposal — provenance may be sealed: owner and date, when the incident cannot travel

**Incident.** Two of the constitution's theses collide, and the collision is not hypothetical. Thesis 4
requires that *each rule links to the incident that created it*; thesis 6 requires that a team's
specifics *persist only in the layer their owner controls*. A customer's incident **is** one of that
team's specifics — so a rule generalised upward into a public pack or into `core/` must either carry the
link (absorbing something it must not hold) or drop it (breaking the provenance rule that lets the
librarian ever retire it).

Found twice, independently: by a fresh-context reviewer grading the thesis-6 change, and in the design
conversation that produced the thesis, neither aware of the other. Recorded as unresolved in the
"Storage follows ownership" section of
[`../../core/operating/memory.md`](../../core/operating/memory.md), which today says only that such a
rule carries a de-identified statement of its failure instead of a link — and admits that prose
provenance cannot be checked.

The cost of leaving it: `core/operating/memory.md` warns that a rule whose provenance cannot be checked
is one the librarian cannot safely retire. Unresolved, the rule set grows monotonically at exactly the
layer where context is scarcest.

**Proposed rule.** Into the Workspace Definition (milestone 2), and reflected in
[`../../core/templates/memory-entry.md`](../../core/templates/memory-entry.md) and
[`../../core/templates/proposal.md`](../../core/templates/proposal.md):

> A rule's **provenance** slot takes one of two forms, and one of them is mandatory.
>
> - **Public** — a resolvable link to the incident: a ticket, a PR, a postmortem, a commit.
> - **Sealed** — an owner and a date, plus the de-identified failure shape. The full chain stays in the
>   owner's own workspace; what travels is the stamp and the mechanism, never the episode.
>
> A rule carrying neither is not a rule; it is taste, and it is rejected at the gate.

**Enforcement.** The point of the two-form split is that both forms are machine-checkable, which prose
provenance is not:

- **`doctor` (milestone 2)** validates that every rule's provenance is either a resolvable link or a
  well-formed sealed stamp. This is what turns thesis 4 from an aspiration into a check.
- **`doctor` also reports the sealed proportion.** A workspace where everything is sealed has quietly
  opted out of retirement altogether — every rule becomes un-retirable by its own machinery — so the
  ratio is a health signal, not a curiosity. Reporting it costs nothing and catches the failure mode
  that the two-form split otherwise invites.
- **The librarian (milestone 5)** never retires a sealed rule on its own evidence, because it cannot see
  the incident and therefore cannot judge whether it can still recur. Instead it **nags the owner to
  re-validate**, on the stamp's date. That keeps the human gate exactly where the doctrine already puts
  it, and turns the sealed form's weakness into a scheduled question rather than silent rot.

**Provenance.** Vision theses 4 and 6, and the tension between them; the recorded open edge in
`core/operating/memory.md`; the "generic must never decay into vague" bar in
[`../../core/skills/codify/SKILL.md`](../../core/skills/codify/SKILL.md) step 1, which depends on this
proposal for the provenance half of its answer. Carried into the rule so it can be retired if the two
theses are ever reconciled some other way.

**Honest limits.**

- This does not make a sealed rule as good as a linked one. It makes the weaker form *declared and
  checkable* instead of silently absent, and gives the librarian something to act on.
- **The machine checks the stamp's form, never its truth.** A fabricated or vacuous sealed stamp passes
  `doctor` exactly as a real one does. What guards the content is the "generic must never decay into
  vague" bar in [`../../core/skills/codify/SKILL.md`](../../core/skills/codify/SKILL.md) step 1 plus human
  review — the same division of labour as everywhere else here: the machine catches absence, the human
  judges substance.
- **"Resolvable" needs defining, and probably means *well-formed*, not *fetched*.** This workspace's own
  [`../verify/README.md`](../verify/README.md) rejects network-dependent gates, because a check that
  fails for reasons unrelated to the change under test is worse than no check. So `doctor` should almost
  certainly validate a link's shape rather than dereference it — deferred to milestone 2 rather than
  settled here.
- It does not help an outside reader judge a sealed rule's merit. They get the failure shape and a name,
  and that is the honest ceiling for a rule whose incident is not theirs to see.
- **Accepting this is a constitutional interpretation**, not only a schema change: it decides how thesis
  4's "links to the incident" reads in the collision case. That call is the maintainer's alone, and it may
  warrant a wording change in `docs/vision.md` in his own hand rather than only a spec slot.

**Decision.** Marius Cetanas — **accepted, 2026-07-25**, at the opening of the milestone-2 session that
defines the Workspace Definition. Accepted as drafted: both forms, one of them mandatory, with `doctor`
rejecting a rule that carries neither and reporting the sealed proportion, and the librarian nagging
rather than retiring on evidence it cannot see.

**As applied.** The rule landed in [`../../spec/slots.md`](../../spec/slots.md) (the reasoning and the
honest limits) and in `$defs/provenance` of
[`../../spec/workspace.schema.json`](../../spec/workspace.schema.json) (the normative shape), and is
reflected in [`../../core/templates/memory-entry.md`](../../core/templates/memory-entry.md) and
[`../../core/templates/proposal.md`](../../core/templates/proposal.md) as the proposal asked. Two details
were settled in the applying rather than left open:

- **"Resolvable" means well-formed, not fetched** — the question this proposal explicitly deferred to
  milestone 2. Settled the way the proposal guessed it would be: `doctor` validates a link's shape and
  never dereferences it, because [`../verify/README.md`](../verify/README.md) refuses network-dependent
  gates and a flaky gate is worse than no gate.
- **The slot is a record field, not a manifest key.** A rule lives in a Markdown record, so a manifest
  key would have described a workspace's *policy about* provenance while leaving every actual rule
  unchecked. The schema defines the shape; the records carry instances of it.

**Reserved to the maintainer.** This proposal warned that accepting it is a constitutional
interpretation, and that it may warrant a wording change in [`../../docs/vision.md`](../../docs/vision.md)
in Marius's own hand. He took the decision *and* reserved that wording change. Until it lands, thesis 4
still reads "links to the incident" while this spec permits a stamp — a real gap between the constitution
and the schema graded against it, recorded here and in [`../../spec/slots.md`](../../spec/slots.md)
rather than smoothed over. No agent edits that file
([`../memory/constitution-is-human-owned.md`](../memory/constitution-is-human-owned.md)).
