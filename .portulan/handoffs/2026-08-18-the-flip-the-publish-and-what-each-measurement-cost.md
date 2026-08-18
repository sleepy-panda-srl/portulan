# Handoff — the flip, the publish, and what each measurement cost

**Session:** 2026-08-18, the maintainer's commission of 2026-08-17, verbatim scope *"proceed with 6,4,5"*
— make the repository public and the package published, **with no false sentence shipped at any point**.
**No milestone row moves.** This is the record the acts themselves owed: the figures, and what they cost
to obtain.

## The two irreversible acts, and the words that authorised them

Both were reserved to the maintainer at the act, and both were given in session rather than assumed from
the commission. The flip:

```
gh repo edit sleepy-panda-srl/portulan --visibility public --accept-visibility-change-consequences
```

The consent flag is **required** by `gh` 2.97.0 when `--visibility` is used, measured from its own help
rather than recalled. The publish was `npm publish --access public`, run by **him**, because it needs a
one-time password no agent can supply.

## The flip, measured either side

| | before | after |
|---|---|---|
| `isPrivate` / `visibility` | `true` / `PRIVATE` | **`false` / `PUBLIC`** |
| `allow_forking` | `false` | **`true`** |
| unauth `GET` api.github.com | 404 | **200** |
| stranger's clone, credential helper disabled | `could not read Username` | **exit 0, 401 files** |

**The negative control earned its place twice.** `curl` against github.com returned **404 after the
flip** — not a failed flip, but GitHub refusing a request with no `User-Agent`; with one it is 200. A
naive re-measure reads that as the act not having landed. And the *authenticated* clone proves nothing
about reachability on a machine holding the maintainer's credentials, which is why the clone cited here
is the one run with the credential helper disabled.

## The publish

`@sleepy_panda_srl/portulan@0.1.0` — 73 files, 490 KB packed, zero dependencies. **`npx` demonstrated
from a directory containing no git repository at all**, which closes milestone 7's named residue
*"undemonstrated: the `npx` spelling, the package being unpublished"* for both halves.

**Byte identity came back stronger than the issue asked, and corrected a belief in this workspace.** The
published tarball and a fresh `npm pack` of the same tree hash to the same value —
`b3790b7159b9e3ba7199c6901a01cee554fe6a3c` — and all 73 files compare byte-for-byte. `cli/eval-bundle.mjs`
states that a tarball hash *"is NOT reproducible from the commit — tar embeds mtimes and ordering"*. True
of `tar`; **not** true of `npm pack`, which normalises both. Recorded on
[#149](https://github.com/sleepy-panda-srl/portulan/issues/149), where the rail is still unbuilt — the
measurement above was taken by hand, exactly as [#242](https://github.com/sleepy-panda-srl/portulan/issues/242)'s
deferral argument predicted would happen if the publish preceded the rail.

## What the acts exposed, which is the part worth keeping

- **Two platform settings took while the repository was still PRIVATE.** `secret_scanning` and
  `secret_scanning_push_protection` both enabled before the flip — refuting this workspace's own record,
  which called them public-only and *"one setting away"*. They were one setting away the whole time and
  nobody had tried. Private vulnerability reporting genuinely is public-only: its endpoint answered 404
  while private and enabled after.
- **`CODEOWNERS` went inert at the organisation rename and nothing said so.** GitHub reads it from the
  **base** branch, so every pull request after the rename had **zero** code-owner reviews requested,
  silently. GitHub's own `/codeowners/errors` endpoint reported **11 unknown-owner** lines. The fix could
  only take effect once it was ON `main`, which is why the sweep merged before the packaging change —
  an ordering the maintainer chose before either of us had identified this reason for it.
- **The org sweep mangled the npm scope.** Replacing `sleepy-panda-works` everywhere also rewrote it
  inside `@sleepy-panda-works/portulan`, producing a scope with hyphens that does not exist. Invisible
  while two branches held different halves; the rebase is what put them in one file.
- **A lowercase sweep missed the case-variant fixtures** — `Sleepy-Panda-Works/…` — which exist precisely
  because GitHub names are case-insensitive. Four tests went red: the rail built against that exact
  mistake catching a sweep making it.

## The review loop, and what it actually bought

Copilot ran **thirty-plus rounds** across five pull requests. Four found defects nothing else would have:
a licensing guard that read only **string** `license` values, so an object — npm's own historic form —
passed untouched; its test passing on a manifest declaring **nothing**; a fixture building `LICENSE` as a
**directory** once it joined the payload, so every fixture-backed test ran against the wrong shape while
staying green; and a roster pin matching **one spelling**, so drift could occur without it firing.

**All four are one class: a description outrunning its check.** None would have been caught by the
thirteen recipes, and all four passed CI. The rest of the rounds were the tree's account of an inverted
mechanism lagging the inversion — five separate descriptions of one function.

## Undemonstrated, and named

The **silence class fired four times**, three of them after a force-push: `copilot-reviewed` went green,
or red on its own 20-minute budget, on heads Copilot never reviewed. **Three merges rest on it** —
[#282](https://github.com/sleepy-panda-srl/portulan/pull/282),
[#288](https://github.com/sleepy-panda-srl/portulan/pull/288) and
[#291](https://github.com/sleepy-panda-srl/portulan/pull/291) — each on the maintainer's knowing word, and
#291's check later reported *"no Copilot review for the commit this run awaited after 1229s"*. That check
is **not required** by branch protection, so it can only ever red after a merge decision, never block one.
Whether it joins the required set is the maintainer's, and
[`proposals/0030`](../proposals/0030-a-declined-contribution-is-not-a-blocked-one.md) is where the
argument sits.

`#149`'s rail is unbuilt. `docs/plan.md` row 7's Status cell still records the package as unpublished —
a milestone row, his hand. And no adopter has run any of this: every measurement here is customer zero's.
