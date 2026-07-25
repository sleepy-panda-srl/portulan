**type:** rule
**scope:** workspace — the `portulan` repository
**provenance:** `form=link` `href=https://github.com/sleepy-panda-works/portulan/pull/3`
— milestone 1, session 3, where a fresh-context supervisor found `.claude-plugin/` absent from the root
README's layout table, missing since the repository was created at milestone 0.

Every top-level entry in this repository must appear in the root `README.md` layout table.

**Why it holds:** that table is the map an agent reads before it knows the ground. A map that omits a
directory does not merely under-document it — it teaches a false shape, and the omission is invisible
precisely because the reader has nothing to compare it against. The entry that went missing was
`.claude-plugin/`: the manifest that makes this repository a plugin marketplace, which is to say one of
the more consequential things about it.

**When to apply:** whenever a top-level directory is added or renamed — which is also exactly when it is
easiest to forget, because the author already knows the shape and does not need the map.

Enforced rather than remembered: the `map` check in [`../verify/docs.sh`](../verify/docs.sh) fails on any
undocumented top-level entry. Related: [`three-workspaces-not-one.md`](three-workspaces-not-one.md).

**Retire when:** the root README's layout table stops being this repository's primary map for agents —
for instance if `doctor`'s agent-legibility report (milestone 2) supersedes it with a generated one. At
that point the check should *move* rather than simply be deleted.
