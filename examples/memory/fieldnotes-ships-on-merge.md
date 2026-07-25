**type:** decision
**scope:** workspace — anyone working on either product
**provenance:** `form=link` `href=https://git.example.com/rooftop/fieldnotes/pull/38`
— the pull request that removed the manual deploy step, and the discussion about whether to keep the two
products' release processes symmetrical.

`fieldnotes` deploys automatically on merge to `main`. `combcount` does not, and the asymmetry is
deliberate rather than an unfinished migration.

**Why it holds:** the two products fail differently. A wrong page on the site is fixed by another merge,
and the fix reaches readers in ninety seconds; the cost of a bad deploy is bounded and small. A wrong
migration is not fixed by another migration, and the cost is a cooperative's record. Making the release
processes symmetrical would mean either gating the site — paying a real cost for no benefit — or
ungating the service, which is the trade nobody would take deliberately but that "consistency" quietly
argues for.

**When to apply:** whenever someone proposes making the two pipelines the same, which happens roughly
once a year and always sounds reasonable. It also means "shipped" is a different word per product; see
the glossary in [`../identity.md`](../identity.md), where conflating them has already caused two support
incidents.

**Retire when:** the site gains state, or the service gains a deploy path that is genuinely reversible
in minutes with data intact. Either would change the asymmetry's premise.
