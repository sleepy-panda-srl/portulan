# Task — three things are called "agent", and the glossary says so

**Goal.** Casual speech in this repository uses one word for three distinct things, and two of them now
have rails attached, which is when ambiguity starts costing something:

| Term | What it is | Where it lives |
|---|---|---|
| **persona** | a role written as doctrine — charter, least-privilege surface in capability classes, autonomy reach in tier vocabulary, memory scope, read/write posture | [`../../core/personas/`](../../core/personas/) — mechanism, the same for every team on every host |
| **agent** | that persona registered on a host: a runtime actor with its own context window, an enforced `tools:` frontmatter, spawnable by name | [`../../agents/`](../../agents/) — host vocabulary |
| **agent identity** | who an action is *attributed to* — `portulan-agent[bot]`, the GitHub App that writes pull-request conversation | [`../gate-map.md`](../gate-map.md) "Which identity acts", [`../tools/README.md`](../tools/README.md) |

**Why it is worth its tokens.** The glossary in [`../identity.md`](../identity.md) has earned rows for
cheaper ambiguities than this one — "session" got a definition because `core/` legislated on it without
one. These three are worse: they are not near-synonyms, they are a doctrine, a runtime object and an
attribution record, and a sentence like *"the agent cannot resolve a review thread"* is true of exactly
one of them.

Ruled worth writing by the maintainer, 2026-07-26, in the ruling that settled the persona/agent
separation, and handed to a later session rather than folded into the one that found it.

**Acceptance criteria.**

- [ ] When the glossary in [`../identity.md`](../identity.md) is read, it shall distinguish the three
      terms above, in about three lines — not three paragraphs.
- [ ] When a document in this repository uses one of the three in a way its own sentence cannot
      disambiguate, it shall be corrected. _(Sweep, do not rewrite: most uses are already clear from
      context, and a mechanical substitution would make the prose worse.)_
- [ ] When the glossary is written, it shall not restate what
      [`../../core/personas/README.md`](../../core/personas/README.md) already says about the lossy
      binding — a glossary that grows a rationale becomes a second copy of the doctrine.

**Lane.** triage, unless the sweep turns up a claim that is actually wrong rather than merely loose —
in which case it is full, because a false claim about which "agent" can do what is a capability claim
([`../dod.md`](../dod.md) condition 4).
