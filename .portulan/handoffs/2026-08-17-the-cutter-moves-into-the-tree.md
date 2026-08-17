# Handoff — the cutter moves into the tree, and the tree starts checking it

**Session:** 2026-08-17, distribution machinery (off-row). **PR:** [#280](https://github.com/sleepy-panda-works/portulan/pull/280). **Ruling implemented:** the maintainer's, mid-session, verbatim — *"This tool should live in the public tree as a reviewable product machinery."*

## What existed before, and what was wrong with it

The evaluation-bundle cutter ran outside this repository, beside the private issuance ledger: an
untested bash script whose payload roster was a claim about this tree that nothing in this tree
checked. The mechanism had been install-verified once; its rosters could drift silently from the
next commit onward. The ledger — recipient names, terms, delivery hashes — must never enter the
repository, and still must not: that boundary is unchanged by this port and is restated in the
tool's own header with dod condition 5's outside-the-repository phrasing.

## What landed

`cli/eval-bundle.mjs` (+ suite, + the twelfth declared verify recipe; the yielded set is thirteen
with the composed one) — the port, with both rosters pinned
in both directions and enforced on every pull request. Deltas vs. the verified original, each
argued in the file header: the cut README's own `## License` section is patched rather than
disclaimed from a banner; the cutter and its suite are self-excluded from the payload (issuer
machinery, and both carry the guard's needle); the transport is git plumbing so the recipe adds
nothing to the dependency floor; `EVAL-STAMP.json` gains a content digest reproducible from the
commit plus the stamp's recorded parameters. The guard grew a second detector mid-session — every
JSON's `license` fields parsed at any depth — after the pre-commit checkpoint measured the byte
form alone passing `"license":"Apache-2.0"` (no space): one spelling is not a category (0029).

## Why the decisions went the way they did

- **Not a ninth subcommand** — `docs/vision.md` names eight and is human-owned; `discover`'s
  precedent, restated in the tool's usage text.
- **Self-exclusion as a code-level filter, never a pathspec** — `:(exclude)` matches nothing
  silently; a JS filter is exercised positively on a fixture planting files at exactly those
  paths, and its failure is diagnosed as its own defect, never as a licensing breach.
- **Plumbing over `git archive | tar`** — a recipe that needs a toolchain is a recipe that stops
  being run; equivalence asserted byte-for-byte in the suite instead of assumed.
- **Two hashes** — the tar sha256 identifies one delivery (ledger semantics unchanged); the
  digest identifies content, encodings named so it is re-derivable outside Node.

## The loop, and what it caught

Session-open (fresh Opus 5): A-W-A ×9 — among them the README License patch, the positive
self-exclusion, `cli/README.md`'s runnable-tools count already stale at five (`pack-version`
unaccounted; six-then-seven in this change), and dropping tar. Pre-commit (fresh Opus 5): A-W-A
×7 — it re-ran all thirteen recipes itself, cut a probe bundle with a recipient of its own
choosing, and found the guard's one-spelling gap plus the missing module-existence precondition
in BOTH `eval-bundle.sh` and `pack-version.sh` (a deleted module printed RED about work nothing
judged). Copilot round 1: write-site containment — resolution, not pattern, now holds the cut's
boundary. Round 2, four promoted notes, all real, all fixed: digest byte-order (UTF-16 vs UTF-8,
two carriers repaired as one definition), umask-proof `chmod` after write, ICU-independent date.
Rounds 3–4 were siblings of 1–2, taken under the exemption's own test — the class generated its
round: the login naming the tarball (containment at its second site, refused by content and
re-checked by resolution), `filesCarrying`'s comparator (plus two more string sorts the 0020
sweep found beside it), and `patchReadmeLicense` holding two definitions of where the heading is
(a heading at byte 0 would have been sliced silently, not refused). Round 5 raised one class at
two sites — `startsWith(base + sep)` false-refuses a filesystem-root base — real, fail-closed,
unreachable on the tool's own paths, and triaged to
[#281](https://github.com/sleepy-panda-works/portulan/issues/281) at the bound on
[#211](https://github.com/sleepy-panda-works/portulan/pull/211)'s precedent rather than spending
a fifth fix-push. One unpromoted note (the entry's hand-maintained test count) was answered by
deleting the figure, #77's repair. Every thread and note carries a reply.
A third fresh-context pass ran over these records themselves and returned A-W-A ×2 — the recipe
ordinal said "twelfth" unqualified while the yielded set is thirteen (the same series the
session-20 entry had already claimed "twelfth" for), and the fidelity note undercounted its own
gates by omitting this pass. Both folded before commit.

## Routed to the maintainer, still open

1. The evaluation-license template text is now tracked and becomes world-readable at the flip —
   counsel's read of that wording sits with the flip's other legal gates.
2. The private-side script is now the second carrier of this mechanism — recommended: retire it
   after merge, leaving the ledger (which never moves) beside a pointer at the in-tree tool.

## Undemonstrated, named

No bundle has been issued to anyone by this tool; no cut has been installed as a plugin; the
guard has fired only on fixtures and probes; the 13 dead relative links in a cut README are
named, not repaired, and no rail sees them — by design, now a standing limit.
