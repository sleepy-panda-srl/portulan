# Handoff — 2026-09-23: three boot files keep their rules and move their reasons

**What landed.** Three of the four largest files a boot still read whole keep what an agent needs in
routine work and move their reasons, measurements and history, verbatim, to one on-read file each, linked
from the line it continues. [`../identity.md`](../identity.md) moves to
[`../identity/stack.md`](../identity/stack.md) why the Tests row carries no count, the same-bytes
measurement at each cut, where each recipe's line sits and why, and the one tool outside it.
[`../dod.md`](../dod.md) moves to [`../dod/reasons.md`](../dod/reasons.md) the reasons of conditions 5, 6
and 7. [`../repos/portulan.md`](../repos/portulan.md) moves to
[`../repos/portulan/history.md`](../repos/portulan/history.md) why no recipe count stands on its test line,
and its provenance after the first sentence. The test was the gate-map split's: a sentence that changes what
an agent does in routine work stays; one that explains why moves. So the glossary, every condition, the
Whys of conditions 1 (the Stop-gate runs one recipe, so the condition is still yours) and 8 (what a handoff
is for), and the card's Layout, which `doctor` lints, stay at boot.

**The fourth file was not cut.** [`../../docs/vision.md`](../../docs/vision.md), 9,459 bytes, is the
constitution, and `edit-the-constitution` is Prohibited: no agent edits it, not with approval and not as a
proposal that rewrites it in place. Tiering it is the maintainer's own act; reading it later than boot
would be a change to the boot skill's slot order.

**Measured** on main `e5d82d1`, by the method of `2026-09-23-l`: the nine files of `2026-09-23-h` plus the
boot skill's `packs.md`, which this repository reads because it names packs. `identity.md` 18,362 → 10,549
bytes, `dod.md` 6,811 → 4,980, the repo card 6,715 → 5,253; the on-read files hold 8,997, 2,698 and 2,031.
This repository's boot read-set went from 92,998 to 81,892 bytes (−11.9%), about 3,700 fewer tokens per boot
at `0036`'s estimated 2.99 bytes per token. The demo workspace's read-set is unchanged: it reads its own
files. With the manifest, which the [`context`](../verify/context.sh) recipe counts, the read-set is 88,947
bytes, so this change lowers that recipe's own-boot rail from 102,055 to 90,726: the figure plus 2%,
rounded up, as the recipe says a demotion does in its own pull request.

**What remains.** Since the gate-map split this repository's boot read-set has gone from 95,602 to 81,892
bytes: the boot skill's split and this one took 13,813 off, and a word in the kernel and a line in the boot
skill put back 103. What is left is the gate-map index (26,959), `identity.md` (10,549), the constitution
(9,459), the boot skill (8,917, with `packs.md` 6,281), and five files of 2.9 to 5.3 KB. Going much further
needs the maintainer's decision on the constitution and on the gate-map index.

**Two stale sentences corrected**, each checked against the repository. `dod.md` condition 4 cited
`identity.md` for *"write the limit, not the aspiration"*, which has lived in `principles.md` since milestone
2; it cites `principles.md` now. The same-bytes paragraph ended *"Measured by hand so far — the rail is
routed, not built"*, which its own notes had overtaken: `pack-identity` is declared in the manifest and
`verify.yml` runs it on every pull request and every push to `main`. The sentence is deleted, and a dated
note in `identity/stack.md` says what it read and why it went.

**Why no proposal.** No tier, mode, manifest key, slot or surface is added, and every slot names the file it
named. This applies `0036`'s accepted remedy for an expensive always tier, demotion to a later tier.

**Readers.** `rule-carriers.json`'s three scope lists cover `identity/` and `dod/`; `repos/` already covered
the card's directory. The A/B register gives `identity/` the identity file's disposition, and `dod/` a
deletion under `arm.md` row 3: that row removes conditions 5 to 7 and the directory holds only their
reasons, so the arm's `dod.md` differs from before this change by the condition-4 citation alone. A reason
for a condition the arm keeps stays in `dod.md`; the directory's header and the disposition both say so.
`doctor` reads a card as `repos/*.md`, so `repos/portulan/` is not a second card. `.portulan/README.md`
lists the new directories. The code that changed is the two dispositions in `cli/ab.mjs`, the own-boot rail
line in `verify/context.sh`, and the extended link rail in `cli/compile.test.mjs`, below; no mechanism's
logic changed and no record was edited.

**How it was checked.** The cut was made at text anchors and checked sentence by sentence against main's
files with the gate-map split's tool, run per file: of 224 sentences and table cells, 160 stay verbatim at
boot, 58 moved verbatim, and 6 were edited, each by one of 7 recorded edits: four positional words turned
into links or named referents, one *this cell*, the condition-4 citation, and the stale sentence, which the
dated note quotes. None is in two files. The gate map's link rails in `cli/compile.test.mjs` now read these
three files and their directories too: every section link between a boot file and its on-read files lands on
a heading, and every on-read file is linked from its boot file, one level down. A broken anchor and an
orphaned file each turned the extended rail red.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38: no fresh-context runs unless he asks. The
coordinator session reviewed the diff before the commit; his review is on the pull request.

**Green in this container needs a non-root run.** All 28 recipes ran green as a non-root user on a copy of
this tree.

**Next action.** His review of the pull request.
