# Handoff — the refusal reaches the two tools that were not `compile`

**State.** One branch, `resolution-refuses-a-shadow-everywhere`, closing
[#318](https://github.com/sleepy-panda-srl/portulan/issues/318). `index` and `recipe-set` now refuse a
shadowed pack on the unasked path, exit 2, both roots named. Fifteen recipes green, suite 1789 — rebased onto the merged #317 work, which brought its own cases (1781 before it). Not merged.
[#321](https://github.com/sleepy-panda-srl/portulan/issues/321) filed for the corner the census found.

**Decisions + why.**

- **Uniform refusal (a), on the supervisor's ruling** — my plan offered three dispositions and leaned
  (a). It approved the conclusion and **corrected the reasoning**, which is the part worth keeping: I
  was importing `compile`'s *argument*, not its ground. The ground is the ambiguity — two roots
  answered, the invocation does not say which. The `recordedOrigin`-in-the-artifact argument was
  `compile`'s answer to a carve-out request, and it does **not** transfer to `index`, which keeps
  origin out of its artifact by design so the index regenerates identically on two machines.
- **And it half-transfers to `recipe-set`, which I had missed entirely.** `${PACK_ROOT}` expands to the
  answering pack directory, so two copies whose manifests are byte-identical still compose run lines
  pointing at different files. That fact forecloses a manifest-comparison predicate for that tool: its
  honest predicate is output equality, computable only by resolving both worlds.
- **Per-tool refusal sentences, not `compile`'s copied.** `index`'s message must not claim its artifact
  records which root answered — the file spends four lines denying exactly that, and its own help text
  says so to users.
- **The agreeing-shadow case still refuses in `index`**, although its bytes would be identical. The
  alternative is a predicate for *which* differences reach the digest, which is narrower than "the
  manifests differ" and would widen silently with every key a later Pack Definition adds — fail-open by
  construction, and a third carrier of a comparison this repository has already had wrong twice.

**Measured, not assumed.**

- **The divergence #318 was filed on is now demonstrated**, which it was not when the issue was
  written: the fixture shows `index` digesting a different memory scope and `recipe-set` composing
  different run lines depending on which root answered. Shown through the two **elected** spellings,
  because the bare path now refuses — a fixture claiming to show divergence there would be
  demonstrating the refusal instead.
- **Three fixture drafts showed nothing before this one did.** A missing `slots.personas`, a manifest
  with no `verify.recipes`, and a `run` that doubled the path segment because I assumed `${PACK_ROOT}`
  expanded to a root rather than to the pack directory. Each was caught by the fixture failing, not by
  reading it.
- **`readScopes` had no injectable discovery** and always called the real reader, so no case could
  exercise its discovery path without the machine deciding the outcome. It now takes the thunk
  `resolverFor` already took, defaulting to the real one.
- **`recipe-set`'s refusal had to move out of the returned closure.** A first cut threw from inside it,
  which runs during `recipeSet` — outside the `try` that wraps the constructor — so the refusal escaped
  as an uncaught throw, exit 1 with a stack trace, in a tool whose contract is exit 2 for could-not-run.
- Forced red both ways in both tools. Over-refusing reds only the **elected** case: named is protected
  structurally, since a named root leaves no discovered root to shadow — the same property #316 measured.

**Open questions.** [#321](https://github.com/sleepy-panda-srl/portulan/issues/321) is the maintainer's:
a malformed *installed* pack makes bare `doctor` exit 1 and blame the workspace's own gates file,
inverting that tool's charter. Named rather than fixed here, because #318's subject is tools that
**write** and `doctor` reports. It is code-measured, not fixture-demonstrated, and the issue says so.

**The cost, priced honestly.** This refuses commands that work today, but only where a **declared** pack
is both installed and in the tree — a pack developer's machine. Every governing carrier of these
invocations already pins: CI, `verify/index.sh`, and definition-of-done condition 1.

**Next action.** Pre-commit checkpoint, then open the pull request. `skills-set` ([#317](https://github.com/sleepy-panda-srl/portulan/issues/317))
is the third member of this family and was deliberately not touched — a separate session owns it.

**Recoverability.** Nothing partial. Both refusals are additive: a workspace with no shadow, or one
naming a root, reaches exactly the code it reached before.
