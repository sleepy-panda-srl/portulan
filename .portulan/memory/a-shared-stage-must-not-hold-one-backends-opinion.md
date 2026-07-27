**type:** rule
**scope:** workspace — anyone writing a shared stage that several consumers read
**provenance:** `form=link` `href=../handoffs/2026-07-27-the-floor-backend-and-the-matrix.md`
— milestone 4, session 1. The enforcement compiler's shared stage refused two whole tiers before any
backend ran, and the second backend existed to compile one of them.

A stage shared by several consumers may hold only what is true for **all** of them. The moment it
decides something on one consumer's behalf, the others cannot disagree with it — and the failure is
silent, because a consumer that was never handed the input produces no error, only an empty result
that reads like an honest verdict.

**The instance.** `cli/compile.mjs` grew one backend first, so the tier partition lived in the shared
stage: `auto` and `propose` were refused there, with a sentence saying `propose` *"is enforced by the
platform floor — pull requests, required checks, review — not by a tool-level permission rule on this
machine"*. Every word of that was correct, and it was in the wrong file. It is a statement about the
**other** backend, written before the other backend existed. When the floor backend arrived, the rules
it exists to compile had already been discarded by a stage that ran before it, and it would have emitted
a ruleset with no `pull_request` rule in it — importable, valid, named for a floor, and enforcing the
thing nobody had asked it to.

**Why it holds.** The generalisation is not "share less". It is that a shared stage's job is
*validation and normalisation* — facts about the input — while a *partition* is an answer to "what can
I enforce", which is the question each consumer exists to answer differently. Vision thesis 1 already
separates mechanism from policy; this is the same cut one level down, between what the input *is* and
what a given backend can *do* with it. The tell is grammatical: any sentence in a shared stage that
names a particular consumer's capability belongs to that consumer.

**How it was caught.** By the session-open supervisor, reading the plan against the existing code
before anything was written — not by a test, because no test would have failed. The accounting invariant
the suite already asserted (every rule ends as compiled or refused, and the counts sum to the input)
stayed true throughout: the floor backend would have refused everything and added up perfectly. That is
the part worth keeping. **An accounting invariant proves nothing was dropped; it cannot notice that
everything was dropped for the same wrong reason.** The suite now asserts the invariant per backend,
which is necessary and still not sufficient — a backend that compiles nothing satisfies it.

**When to apply:** any time a second consumer is added to a stage written for one — a second backend, a
second host adapter, a second renderer over one parse. Before writing it, read the shared stage for
sentences that name a capability rather than a fact, and move each one down to the consumer it describes.
Do it *before* the second consumer, not after: afterwards the empty result looks like a small backend.

**Retire when:** the compiler has three or more backends and the partition-in-the-backend arrangement is
load-bearing enough that nobody would think to centralise it — at which point this entry describes a
mistake the shape of the code no longer permits. Related:
[`two-layers-need-two-jobs.md`](two-layers-need-two-jobs.md), which is the same milestone asking what a
second *layer* contributes, where this asks what a second *consumer* is allowed to decide for itself.
