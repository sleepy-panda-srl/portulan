**type:** rule
**scope:** workspace — anyone writing or amending a milestone exit criterion in `docs/plan.md`
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/15`
— milestone 2 spent a session and part of the next "open on the pilot clause", with the maintainer asked twice to do
client-rooted work in order to close a public milestone. The clause had been contradicted since
2026-07-25 by the ruling that closed milestone 1, which established in the governing private context
that the client-rooted work remaining there *"neither gates any public milestone"*. Nobody reconciled
this row to that ruling, and nothing could have: the governing document is outside the repository by
design.

_Precision, because an earlier draft of this entry got it wrong in the direction that flatters the
argument: the private work is **non-gating**, not **optional**. A residual check there is a standing task
in its own context. "It gates no public milestone" is the true claim and the only one this rule rests on._

A milestone's exit criterion must be **demonstrable from this repository alone**. If discharging a
clause requires an artifact, a session, or a judgement that lives outside the public repo, that clause
is not a criterion — it is private work, and it belongs in the private context rather than in a public
exit criterion.

**This rule binds exit criteria and nothing else. It never touches an authorization hold.** An exit
criterion answers *is this done?* — a claim about work, which must be demonstrable where it is claimed.
An authorization hold answers *may this happen?* — a permission, which is legitimately granted from
outside and stays a gate no matter where the granting lives. The public flip was the worked
example: it was held outside this repository, that hold was real, and **this rule was never an argument
for removing it** — the flips that followed were taken by the maintainer's authorization, which is the
distinction this paragraph draws, not a counter-example to it. The example is past tense now; the
distinction is not, and it binds the next hold the same way. Read without this paragraph the rule is
exactly such an argument,
which is how it was first drafted and what a fresh-context supervisor caught before it merged — a rule
written to prevent one bad strike, loaded to authorise the next.

The carve-out has one edge, and closing it is the difference between a distinction and a loophole: **a
hold that requires outside *work* rather than outside *permission* is a criterion in disguise**, and this
rule reaches it. "Wait for someone to authorise" is a hold; "wait for someone to build and validate a
thing" is a criterion wearing a hold's clothing, and relabelling it does not move it.

**Why it holds.** Two failures, and the second is the one that costs.

The obvious one is a **structural close-by-assertion**. A criterion a build session cannot execute
under its own rules can never be *demonstrated*; it can only be asserted or waited on forever. The
constitution's hard-exit-criteria rule then guarantees the milestone stays open on something the
milestone cannot do anything about.

The second is a **provenance posture**. A public milestone that depends on the predecessor framework
makes that framework a required *input* to public work. The milestone-1 amendment removed exactly that
dependency and said why — `core/` was in fact authored clean-room from the constitution and public
practice, which is the stronger position — and then the milestone-2 row quietly reintroduced it. A rule
removed in one row and left standing in the next is not a rule; it is an anecdote about one row.

**When to apply:** whenever a criterion is written or amended, before it is agreed. The test is one
question — *could a reader with only this repository check this?* Words like "privately", "locally", or
the name of anything outside the tree are the tell. If the answer is no, split it: the demonstrable part
stays in the criterion, the rest is recorded where its owner controls it — which makes it non-gating, and
says nothing about whether it is optional. Those are different questions and conflating them is how the
first draft of this entry overstated its own case.

**This is mostly not railable, and the residue is worth naming precisely.** No check here can *compare* a
plan row against the governing document, because that document is deliberately outside the repository —
the same boundary that let the gate map claim the agent identity did not exist for hours after it did:
**prose about a fact outside the tree is invisible to every check we have.** So the rule is enforced at
the session-open and milestone-close checkpoints, by a reader asking the question above, and calling that
review rather than machinery is the honest description.

What *is* mechanisable, and is recorded here as future work rather than claimed: the tell is grep-able.
A criterion cell containing "privately", "locally", or the name of something outside the tree could be
**flagged for review** — not failed, since the milestone-0 and milestone-3 rows legitimately reference an
outside clearance under the carve-out above. A flag-for-review is the honest severity for a check that
cannot tell the two apart.

**Candidate for `core/`, not promoted here.** The general form — *an exit criterion must be demonstrable
from the layer that claims it* — is universal, and
[`../../core/operating/verification.md`](../../core/operating/verification.md) already opens with
*"Done" is a demonstrated claim, never an asserted one* without scoping **where** the demonstration must
be possible. Promoting it needs a proposal through the human gate, per the one-way-flow rule; it is not
done by writing it into `core/` from a workspace incident.

**Retire when:** the build no longer has a private layer whose contents cannot be read from the public
repository — realistically, never while the seam exists. If a future milestone map is generated from a
source that can see both layers, this moves into that generator's checks rather than being deleted.
