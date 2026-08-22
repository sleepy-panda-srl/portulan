# Handoff — the scaffold was refused by the very step it tells you to run next

**State.** One branch, `fix/new-gate-policy-scaffold-compiles`, off `main` at `3de4c5f`. Fifteen
recipes green, `new` **31/31**, full suite green. Filed as
[#329](https://github.com/sleepy-panda-srl/portulan/issues/329) by the maintainer against `0.1.2`
installed through the plugin cache; fixed here.

## What was wrong

`portulan new gate-policy` writes a draft, and its own success message names the next step —
*"add `"gates": "gates.json"` to the workspace's `workspace.json`, then `portulan compile`"*. That step
refused what the previous step had just written. **Three defects in one skeleton**, and the report found
the first two:

1. **The version key was the wrong key with a value nothing has known.** The skeleton emitted
   `"portulan": { "gates": "1.0" }`. `compile` reads `policy.portulan?.spec` against
   `KNOWN_GATE_POLICY_SPECS = {"2.1", "2.2"}`, so the lookup stringified `undefined` and the refusal
   read `gate policy declares gate-policy spec undefined`. The refusal is working exactly as designed —
   the comment above that constant describes closing precisely this hole — and the input it refused was
   the one the toolchain had just produced.
2. **The `floor` block declared two keys no compiler has ever read.** `require_pull_request` and
   `block_force_push`, where `compile` reads `branch`, `checks`, `reviews`, `resolve_conversations`. So
   filling the draft in faithfully produced a floor the compiler cannot use, on top of a spec it will
   not accept.
3. **Found here, not in the report: no rule in the skeleton reached the floor it declared.** With 1 and
   2 fixed and every `{brace}` filled, `compile` still exited 2 — *"declares a floor on `main` and no
   rule in the policy reaches it"*. The floor backend expresses exactly two spellings, `git push
   --force` and `git push --delete`, and the skeleton's three example rules were a `write`, a
   `{command prefix}` and a `write`. The template's own closing paragraph already said those two were
   *"a policy's honest first pair"* — the prose knew and the skeleton did not.

## Why it survived, which is the part worth keeping

**There was already a test called `a scaffolded gate policy parses AND compiles — parsing is not the
bar`.** It asserted that `policy.rules` was a non-empty array and that `policy.why` was truthy. It never
called the compiler. Its own docblock recorded the lesson it was built from — session 1's drafted policy
that parsed and then failed the adopter's first run — and then skipped the half the name claims.

**A test whose name asserts the bar its body skips is worse than an absent one**: it occupies the slot
where the missing check would have been noticed, and every green run of this suite said the scaffold
compiled.

**The other carrier had it right the whole time.** `cli/init.mjs`'s `draftPolicy()` emits
`portulan: { spec: GATE_POLICY_SPEC }`, the correct four floor keys, and — with a comment saying so —
the two ref rules, *"Found by running the real validator against a real draft rather than by reading the
compiler."* `spec/slots.md`'s floor table documents the same four keys, and `.portulan/gates.json` uses
them. **Of the two carriers that GENERATE a gate policy, the one with a compiling test was right and
the one without was wrong.** Precisely: two
of the three are exercised — `init`'s draft is compiled by `cli/init.test.mjs`, and the workspace's own
`gates.json` by the `compile` recipe — and `spec/slots.md` is prose, which nothing runs either. So the
claim is not *"the unexercised carrier was wrong"* in general; it is that of the two carriers that
generate a policy, the one with a compiling test was right and the one without was wrong. That is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s class from the other side:
not a fix that missed its siblings, but a lesson that reached three carriers and not the fourth.

## The fix

- `core/templates/gate-policy.md` — `portulan.spec` is `2.2` (*the version its output needs*, the rule
  stated beside `cli/new.mjs`'s and `cli/vendor.mjs`'s constants); `floor` is the four keys `compile`
  reads; and the gated example is the force-push / ref-deletion pair, shipped **filled in** rather than
  as placeholders, which is what keeps the floor reachable. Their `reason` stays the adopter's to write.
- Prose added beside the skeleton naming what the four floor keys are and what the old two were, so the
  next reader is not left to infer it from a diff.
- `cli/new.test.mjs` — the mis-named test now **does what its name says**: it scaffolds, fills only the
  `{braces}`, and runs the real `compile`, asserting exit 0. A second, narrower rail asserts
  `portulan.spec` is a string and that `portulan.gates` is absent.

**Seen red, and the pair isolates.** Against the template exactly as #329 found it, both rails red.
Against a template with the spec and floor fixed but the ref pair removed, **only the broad one** reds —
which is what shows the compile rail catches a defect the spec assertion cannot.

## The checkpoint found the same defect inside the fix

**APPROVE-WITH-ADJUSTMENTS — four, two blocking, all folded.** The first is the one worth carrying: the
*narrow* rail I added asserted `typeof policy.portulan?.spec === "string"` under a comment claiming it
was *"asserted against the compiler's own set rather than a literal"*. **`"1.0"` is a string.** The
exact root cause of #329 passes that test — so the rail written to catch this defect reproduced it,
inside the change whose entire subject is a test whose name outruns its body. It was caught by reading
the body against its own comment, which is the one instrument that finds this class.

`KNOWN_GATE_POLICY_SPECS` is now **exported** and the rail asserts membership. Controlled both ways: a
skeleton declaring `spec: "1.0"` — right key, unknown value, the case the old body waved through — now
reds, as does the template exactly as #329 found it.

The other three: the records claimed this checkpoint as already run while `docs/plan.md` still carried
a placeholder; the seam attestation stated a coverage of two files when the diff changes seven; and the
"nothing ran" sentence above was loose about a prose carrier. All corrected here rather than argued.

## Copilot round 1: three notes, all promoted, all real

None was an inline comment — all three arrived as **suppressed low-confidence notes**, and the
promotion step attached a thread to each, so all three gate. That channel earned its keep here: the
inline round was empty.

- **`parseFloor` ignores unknown keys.** It validates `branch`, `checks`, `reviews`,
  `resolve_conversations` and returns only those; anything else is accepted and dropped. So a template
  reintroducing `require_pull_request` / `block_force_push` **beside** the four valid keys, with the ref
  pair present, **compiles exit 0** — measured. Half of #329 could come back with the broad rail green.
  This is the finding of the round: it names what the new rail does *not* cover, which is the harder
  thing to see than what it does. Pinned by asserting `Object.keys(policy.floor)` exactly, and the
  control confirms the compile rail stays green while the new one reds.
- **`String(spec)` membership passes a numeric spec**, and worse than reported: a future `2.10` written
  as a JSON number is `2.1` before either side sees it — a *different* spec that happens to be known.
  The raw type is now asserted alongside membership.
- **A headline that contradicted its own next sentence.** *"The wrong one was the only one nothing
  exercised"*, immediately followed by the admission that `spec/slots.md` is prose nothing runs either.
  The pre-commit pass had asked for this to be tightened and I added the qualifier while leaving the
  false headline standing — a correction that explained the error underneath the sentence still making
  it. Narrowed to the claim that is true: of the two carriers that *generate* a policy, the one with a
  compiling test was right.

## Owed

Nothing. Seam scan clean — nine explicit terms over all seven changed files and the branch name, with a
planted listed term as a control that reddened; the commit message scanned when it was written. The
supervisor checkpoint above ran in a fresh Fable 5 context, on the maintainer's explicit grant lifting
this session's no-subagent instruction, and its verdict is recorded in the Session log entry for this
date.
