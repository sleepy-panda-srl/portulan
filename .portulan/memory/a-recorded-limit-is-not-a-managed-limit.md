**type:** rule
**scope:** workspace — this repository's Known-limits sections and the records that stand in for rails
**provenance:** `form=link` `href=https://github.com/sleepy-panda-srl/portulan/pull/129`

**A limit written down is not a limit managed.** A known defect recorded in prose — even with its repair
named in the same sentence — has been *documented*, not *queued*, and nothing will ever return to it. So a
recorded limit must carry a way back: an issue number, a rail, or an explicit statement that it is
permanent by design. Prose alone is where a limit goes to be forgotten politely.

`.portulan/verify/README.md` recorded, on 2026-07-27, that the `links` check accepted `Core/engine.md` for
`core/engine.md` on a case-insensitive volume, and said outright: *"Resolving targets against `git ls-files`
instead would close it; until then this is a known false green, recorded rather than left to be
discovered."* The diagnosis was right, the repair was right, and it sat for three days. It was closed only
because an **unrelated** instance of the same class — a generated file linking an empty directory, green
locally and red in CI ([#121](https://github.com/sleepy-panda-srl/portulan/issues/121)) — sent a session
looking for siblings. Nothing about the recording produced the fix; a different defect did.

**Why the recording still helped, which is the part that makes this a rule and not a complaint.** When the
sweep came, the bullet was what told it where to look and what the repair was, so the sibling cost minutes
instead of a re-derivation. Recording is necessary and it is not sufficient. The failure is treating the
write-down as the action.

**The asymmetry that decides it.** An issue costs one command and appears in a list somebody reads. A prose
bullet costs the same to write and appears only to whoever is already reading that file for another reason
— which is nobody, by construction, since a limit is what you do not know to look for. Two limits were
found in the same review as #121 and both were filed rather than only recorded.

**How to apply.** When writing a limit into a Known-limits section, ask which of three it is: *permanent by
design* — say so and say why, and it needs nothing else; *waiting on a decision* — link the issue; *a defect
nobody has scheduled* — open the issue, then record it with the number. If none of the three fits, the limit
is not understood well enough to write down yet.

**Retire when:** a check refuses a Known-limits entry that carries neither an issue reference nor an
explicit permanence claim. The pattern is mechanically checkable — the entries are list items under a known
heading, which is the same shape `docs.sh`'s `proposal` check already parses — so this rule is a candidate
to compile rather than a permanent piece of judgement.
