# Task 0059 — a closing command an adopter's agent can run

**Lane:** full · **Opened:** 2026-11-11 · **Status:** implemented; pre-commit pending

[Issue 657](https://github.com/sleepy-panda-srl/portulan/issues/657): the boot card `portulan init`
drafts tells an agent to close a change with `node <plugin root>/cli/finish.mjs`, written by
`cli/form.mjs`. Nothing an adopter's session loads resolves `<plugin root>`, and in two sampled runs
on 0.4.0 the agent searched the whole disk for the file until the two-minute tool limit. The
placeholder is deliberate, because a committed card cannot spell one machine's install directory.

The maintainer ruled twice in conversation on 2026-11-11. First, the fix: add `portulan finish`,
chosen over a sentence in the card that explains the placeholder. Second, the constitution: amend
`docs/vision.md` to name `finish` among the subcommands, as it was amended for `new` and `feedback`,
chosen over naming it only through a proposal.
[Proposal 0041](../proposals/0041-portulan-finish.md) records both.

**Acceptance criteria.**

- When `portulan finish <arguments>` is run, it shall behave as `node cli/finish.mjs <arguments>`
  does, with the same exit codes, and `portulan --help` shall list it. `finish.mjs`'s own usage text
  shall name both spellings.
- When the subcommand list names `finish`, `docs/vision.md` shall name it too, the commit message
  shall cite the maintainer's ruling for that edit, and every live sentence that counts the
  subcommands shall agree with the list: `README.md`, `docs/pricing.md`,
  `plugin/skills/portulan/steps.md` with whatever rails or embeds its bytes,
  `.portulan/repos/portulan.md`, `.portulan/products/portulan/product.md`, `docs/plan.md` and the
  help text in `cli/portulan.mjs`. `CHANGELOG.md` and earlier proposals stay as history.
- When `portulan init` drafts a card, its Records section shall name `portulan finish` as the
  closing command. For a machine where `portulan` is not on the path, which a plugin-only install
  is, it shall name `npx @sleepy_panda_srl/portulan finish` and say not to search the disk; it shall
  no longer carry `<plugin root>/cli/finish.mjs`.
- When a workspace is vendored, the note that the Portulan package is not in the copy shall still
  appear for a card that names `portulan finish`.
- When the change is tested, tests written first and seen red shall assert the drafted card's
  command, the subcommand's dispatch and the vendor note. The tests that pin the count of eight and
  the help sentence change with the list; no check is weakened beyond that.
- When the change is demonstrated, a tarball packed from this tree and installed into a scratch
  prefix shall run `portulan init`, `portulan compile` and `portulan finish --help` with exit 0 in a
  scratch repository, and the compiled card shall carry no `<plugin root>/cli/finish.mjs`.
- When the change is closed, it shall carry a changelog fragment that says cards already drafted
  keep the old line and gives the one-line hand edit, and the proposal shall name its pull request
  by full URL.

## Plan

Record the rulings as proposal 0041, noting that they preceded it and that the implementation
shares its pull request. Add the failing tests, then the `finish` entry in `cli/portulan.mjs`, the
card line in `cli/form.mjs`, the vendor note and the usage text. Amend the constitution's list and
the sentences that count. Regenerate what is rendered from code, and run every recipe.

Out of scope, each named so it is not lost: an `upgrade` repair that rewrites the line in cards
already drafted, to be filed as a follow-up issue; other card commands that use the placeholder,
such as `symbols.mjs`; this repository's own card, which names `node cli/finish.mjs` from the
checkout.

Fresh session-open, Claude Fable 5.2 subagent, 2026-11-11: **APPROVE-WITH-ADJUSTMENTS**. All eleven
are folded above. The constitution question it raised went to the maintainer and is ruled. It found
that `finish.mjs` already exports the `run` the dispatcher calls, and that the card line lives only
in `cli/form.mjs`. It could not verify the rulings, which were given in conversation.
