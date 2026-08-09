# `actions-pinned` — what it checks, and what it cannot

One recipe. `bash ${PACK_ROOT}/verify/actions-pinned.sh`, run from the adopting repository's root.

**`${PACK_ROOT}` is expanded by the composing reader** ([`cli/recipe-set.mjs`](../../../../cli/recipe-set.mjs))
to the pack's resolved root, relative to the repository root, before the command reaches a shell. A pack
does not know the adopter's layout — the token is how a composed recipe names its own files without
guessing one.

## The three exits

| Exit | Means |
|---|---|
| `0` | every `uses:` reference examined is pinned to a full 40-character commit SHA |
| `1` | at least one is pinned to a tag or a branch, or carries no `@ref` at all |
| `2` | **could not run** — there is no `.github/workflows/` directory, or it holds no `.yml`/`.yaml` file |

**Exit 2 on an absent or empty workflows directory is a decision, not an accident.** The alternative —
reporting green over a directory nobody looked in — is the false green: "nothing looked" reported as
"nothing wrong", and enumeration is a precondition here exactly as it is inside every recipe this
repository writes. A workspace with no GitHub workflows has composed a pack that cannot do its job, and
the honest answer is to say so rather than to hand back a green it might be mistaken for coverage. What
to change in that case is the `packs` array, not this exit code.

## Known limits, each with its reason

- **One `uses:` per line.** The scanner reads line-oriented `uses:` entries, which is the spelling every
  workflow in the wild uses. A folded scalar or a flow-mapping spelling would not be seen. A YAML parser
  would close this, and it would make the recipe depend on a parser the pack would then have to ship or
  require — priced and declined at this size. A matcher that claimed to read YAML while reading lines
  would be worse than the stated limit.
- **Local actions are exempt.** `uses: ./.github/actions/thing` lives in the adopter's own repository and
  moves with it; there is no third-party commit to pin, so requiring one would be a check that cannot be
  satisfied.
- **Container references are exempt.** `uses: docker://…` is pinned by image digest, not by commit. Out
  of scope, and named rather than silently passed.
- **A pinned SHA is not verified to exist.** Checking that `owner/action@<sha>` is reachable in that
  repository needs a network call, and **a network call inside a verify recipe is a standing prohibition
  in this project** — recorded in row 7's own exclusions. So a 40-hex string that is not a real commit
  passes here. The check is *shape*, not *existence*, and the shape is what stops a moving target.
- **It does not read reusable-workflow `uses:` differently from action `uses:`.** Both are pinned by the
  same rule, which is correct, but a reusable workflow in the same repository is a local reference and is
  therefore exempt for the reason above.

## What this does not replace

`sha_pinning_required` is enforced by GitHub itself at the organisation and repository level for this
project, and where an adopter has it the platform refuses an unpinned action at run time regardless of
this recipe. See the [pack README](../README.md) for why the recipe still earns its place — the short
form is that this fires at the pull request rather than at the run, and that a pack travels to adopters
whose platform enforces nothing.
