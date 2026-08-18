# Handoff — the guard I deleted was the one that caught me

**Session:** 2026-08-18, the maintainer's commission of the same day: *"Bootstrap Portulan. Update the
docs … to spell out the right version, additional create the first release tag and package"*, then
*"rewrite the entire thing to be professional grade"*, then *"same goes for Contributing or any
documentation that's very visible to the user when accessing Portulan repo."* **No milestone row
moves.** [#298](https://github.com/sleepy-panda-srl/portulan/pull/298), plus the repository's first tag
and first release.

## State

`v0.1.0` is tagged and released; #298 is open with an empty review loop, awaiting the maintainer. The
`0.1.1` cut that corrects the registry's front page is owed and needs his one-time password.

## Decisions + why

- **The tag points at `d6498f0`, not at `main`** — because that is the only commit whose `npm pack`
  reproduces the published tarball. Measured across fifteen candidates: `d6498f0` packs 73 files to
  `b3790b7159b9e3ba7199c6901a01cee554fe6a3c`, which is what the registry serves; every later commit
  drifts, and `main`'s tip packs **74** once `cli/pack-identity.mjs` joined the payload. Tagging the tip
  would have made `v0.1.0` a false claim about what `0.1.0` contains, which is the one thing
  `gates.json`'s own tagging reason forbids. The attached asset was downloaded back from the release and
  compared against the registry byte-for-byte before this was believed.
- **The archaeology came out of the reading path, and that decision is the session's most interesting
  mistake** — see below. The record itself was untouched.
- **`SECURITY.md` is the only carrier of the reporting procedure.** `CONTRIBUTING.md` keeps a one-line
  instruction and cites it; `README.md` and `bug.yml` point at it. The first draft had `CONTRIBUTING.md`
  restating all three steps — a second full carrier created inside the change whose own message argues
  against two carriers.
- **`0.1.1` rather than a re-publish** — npm freezes a README per version, and `0.1.0`'s says *"The
  newest release entry is `0.2.0`"*. Only a new version corrects the registry's front page.

## The finding worth carrying

**I deleted a guard, then committed the defect it guarded against, twice, in two shapes — and three
different instruments caught the three facets.**

The base `CONTRIBUTING.md` carried a note recording that *"in a **public** issue"* had deliberately lost
its adjective, because the instruction never depended on visibility. I cut it as archaeology.

1. The **pre-commit checkpoint** caught `README.md` reintroducing the adjective — while the two files
   that kept the visibility-independent form sat beside it.
2. **Copilot round 2**, entirely through the promoted-note channel with the inline round empty, caught
   `SECURITY.md` and `CONTRIBUTING.md` each asserting *"and this repository is public"* as a separate
   clause two lines below the sentence I had just fixed.
3. The **guard itself** was the thing that would have prevented all of it, and it was in the diff's
   deletions.

The lesson is narrower than *never delete archaeology*: a self-corrective note is a **rail written in
prose**, and deleting one is a rail deletion, which this workspace already treats as the change to
scrutinise hardest. What it is not is an argument for leaving it on the front page — the note belonged
somewhere a reader of the repository would meet it before editing, and no such place exists today.

## Instruments, and what each cost

- **`pack-identity` reads the INDEX** (`git show :<path>`) and **eval-bundle's partition test reads
  HEAD** (`git ls-tree`). Both were red about state the diff had not written yet. Discharged by staging
  and committing, never by touching the check — the third and fourth instances of this class in the
  record.
- **My own count lied.** `grep -c ✔` reported 1972 where the suite is 1714, because it counts each
  parent suite alongside its children. node:test's own `pass` line is the figure this repository means.
- **The seam grep matches substrings**: 19 hits, all ordinary English (`PAT` inside `path`). The
  word-boundary scan over 38 non-generic terms returned zero.
- **`main` moved fourteen commits mid-session**, so the suite figure moved 1714 → 1725 with none of the
  difference mine. A figure that does not name its tree is not a measurement.

## Open questions

- **Should any of the deleted self-corrective notes return to the files themselves?** Raised with the
  maintainer, undecided, and his. The record carries them either way.
- **`0.1.1`'s cut** — his, and the publish needs his OTP.

## Next action

He merges #298, then the `0.1.1` cut: bump `package.json` and both plugin manifests, rename the
CHANGELOG's `Unreleased` heading and merge that **before** tagging, tag, release, and hand him the
publish.

## Recoverability

Nothing is in a partial state. The tag and release are live and verified; #298 is a branch. The two
review threads stay unresolved because no App identity can resolve one — that is the maintainer's token
and his call at the merge.
