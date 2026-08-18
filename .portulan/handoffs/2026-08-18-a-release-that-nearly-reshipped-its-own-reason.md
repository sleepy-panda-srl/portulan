# Handoff — a release that nearly re-shipped its own reason for existing

**Session:** 2026-08-18, continuing the same day's commission after [#298](https://github.com/sleepy-panda-srl/portulan/pull/298)
merged. Verbatim: *"yes, start the 0.1.1 cut and I want it filled anyway then I want to publish a new
version."* **No milestone row moves.** [#299](https://github.com/sleepy-panda-srl/portulan/pull/299).

## State

#299 is open with the Copilot loop at round 1 answered. `v0.1.1` is not tagged; the npmjs publish and
the GitHub Packages publish are both still ahead, and the first of them needs the maintainer.

## Decisions + why

- **`0.1.1` exists to reach a page no edit to `main` can reach.** npm freezes a README per published
  version, and `0.1.0`'s says *"The newest release entry is `0.2.0`"*. Fixing the tree was necessary
  and not sufficient. This is the second-order cost of the defect `0.1.0` recorded, not a new one.
- **GitHub Packages fills the sidebar under a DIFFERENT name, ruled after both costs were put to him.**
  Measured: `@sleepy-panda-srl/portulan` 404s on npmjs, `@sleepy_panda_srl/portulan` is 200. No single
  name satisfies both registries. He was told the two costs — a second package identity, and a token
  required to install even a public package — and reaffirmed. Both are stated in the workspace's own
  artifacts rather than left to be discovered: the workflow header, the CHANGELOG and the README.
- **The rewrite happens in the working copy at publish time, verified before anything is published**,
  because a publish that silently kept the npmjs name would either fail on a scope mismatch or land on
  the wrong registry entry. Idempotent by design: npm's refusal to overwrite a version is correct
  rather than an error, so a re-run reports and exits 0.

## The finding worth carrying

**The release nearly re-committed the exact defect it exists to correct.** `README.md` still read
*"Current release: `0.1.0`"*, and `README.md` is in `package.json`'s `files`. Publishing would have
frozen a front page stating a false current version — same file, same freeze mechanism, same shape as
the `0.2.0` sentence that is the whole reason for `0.1.1`. The pre-commit checkpoint caught it. The
difference between this and last time is only *when* it was caught.

**And the sibling was missed again, with the map already in the tree.**
`.portulan/products/portulan/product.md` is recorded in `docs/plan.md` as one of *"the two carriers …
fixed in one stroke"* — one release ago, by me. I swept one of the two, again. **A sibling list written
in prose is not a rail**, and this is now the second consecutive release to prove it on the same pair.
The candidate rail is cheap and is not built here: a check that every prose statement of a current
version agrees with `package.json`.

## Instruments

- **Every defect the checkpoint found was version-currency prose** — four blocking, all of that one
  class, in a change whose entire subject is a version number.
- **`always-auth=true` was dead config**, and the vendor's claim was checked rather than taken: npm
  11.19.0 answers *"always-auth is not a valid npm option"*.
- **Copilot's round-1 finding was taken while its stated mechanism was refused.** It said `inputs.ref`
  can raise on a `release` event; the `inputs` context is in fact recognised here because the workflow
  declares `workflow_dispatch.inputs`. The spelling changed anyway, for a better reason recorded in the
  file: the workflow has never fired and cannot be evaluated from a checkout, so on an unexercised path
  whose failure mode is checking out the wrong ref, the undisputed spelling wins.

## Open questions

- **A current-version rail** — worth an issue; the same two carriers have now drifted twice.
- **Whether `0.1.0` stays supported** once `0.1.1` ships. `SECURITY.md` currently answers only that
  `0.1.1` is the current release. His call.

## Next action

He merges #299. Then: tag `v0.1.1`, cut the release — which fires the GitHub Packages workflow for the
first time — and hand him the npmjs `npm publish`, which needs an OTP no agent can supply.

## Recoverability

Nothing partial. `v0.1.0` and its release are live and unaffected. #299 is a branch. **The GitHub
Packages workflow is entirely undemonstrated** — if it fails on first fire, the sidebar simply stays
empty and nothing else is damaged; it publishes to a registry the documented install path does not use.
