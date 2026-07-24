**type:** decision
**scope:** workspace — the `portulan` repository
**provenance:** [`../../docs/plan.md`](../../docs/plan.md), locked decision 2 and the milestone-0 exit
criterion; verified against the live remote at the milestone-0 close and again in milestone 1, session 3.

`sleepy-panda-works/portulan` is a **private** repository and stays private until the milestone-3 public
flip, which has its own clearance gate tracked outside this repository.

**Why it holds:** the flip is one-way in practice. Once a history is public it cannot be made private
again in any sense that matters — it may already be cloned, cached, or indexed — so visibility sits in
the Gated tier ([`../gate-map.md`](../gate-map.md)) and the default is the recoverable direction.

**When to apply:** before anything that would widen visibility — flipping the repository, forking it into
a public organisation, publishing a package that embeds its contents, or pasting its files anywhere
public.

**Retire when:** the milestone-3 flip completes. The rule then inverts into its successor rather than
disappearing — history becomes public and permanent, which makes the pre-commit scan in
[`../dod.md`](../dod.md) matter more, not less.
