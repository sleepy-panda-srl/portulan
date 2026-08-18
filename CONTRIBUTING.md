# Contributing to Portulan

Portulan is built as an open-core product and is **not open to outside code contributions**.

That is a deliberate posture, not an oversight and not a temporary state, so it is worth stating
plainly rather than leaving you to infer it from a closed pull request. The paths that *are* open are
open to anyone, need no account of ours, and are genuinely the contribution channel — not a lesser
path to one.

## What anyone may do

**Read, clone and fork**, under the terms in [`LICENSE`](LICENSE). Everything here is yours to read and
learn from: the engine, the workspace, the plan, and the recorded reasoning behind every decision.

**Report a bug, suggest an improvement, or send feedback** through the
[issue forms](https://github.com/sleepy-panda-srl/portulan/issues/new/choose):

| Form | Use it for |
|---|---|
| **Bug report** | Something does not do what it says it does |
| **Improvement** | A concrete proposal — including one that argues the current design is wrong |
| **Feedback** | Anything that is neither: what confused you, what did not survive contact with your repository, what you expected to find and did not |

Blank issues are off on purpose. If none of the three fits, **Feedback** is written loosely enough to
be the closest.

### Filing from the terminal

`portulan feedback` files into those same three forms — the same channel, not a second one. There is no
relay and no account of ours in the path: reports are filed under your own GitHub login.

```bash
portulan feedback draft bug --title "doctor reports green on a missing gates file"
portulan feedback preview feedback/<report>.md
portulan feedback send feedback/<report>.md --approve
```

`draft` takes one of three kinds — `bug`, `improvement` or `feedback` — and writes the report into
your workspace's `feedback/` directory for you to edit. `preview` shows the exact bytes. `send` files
them through your own `gh` login, and approval is per send and never inherited.

**Nothing leaves your machine that you have not read first, and that is enforced rather than promised.**
`preview` stamps a digest of the payload into the report and `send` refuses any payload that does not
match it, so a report edited after you read it is refused rather than sent. If you keep a list of terms
that must never reach an issue tracker, point `--seam-terms` at it and a hit refuses the send; if you
keep none, the preview says so in the same breath as the bytes, rather than letting silence read as a
clean scan.

## What only team members may do

**Commit and push.** Code lands only through members of the `sleepy-panda-srl` organisation with write
access to this repository. Pull requests from outside that group are not accepted, and will be closed
with a pointer back to this file — not because the change was bad, but because this is not how changes
enter this repository.

If you have already opened one: thank you for the effort, and sorry for the wasted work. Preventing
exactly that is why this file exists.

## Why

Portulan's product is its files — the doctrine, the rulings and the recorded reasoning behind them.
Nearly every change here is a change to a standard that other work is graded against, and the worth of
such a standard depends on a small number of people holding a consistent line on it and being
accountable for it. A patch queue optimises for throughput; this repository is optimising for a
coherent argument.

This may change. If it does, it will change in this file, and the change will be dated.

## For team members

The working discipline lives in the repository rather than here:

- [`.portulan/gate-map.md`](.portulan/gate-map.md) — what an agent may do unattended, what needs
  approval, what nothing approves, and the autonomy mode this workspace runs.
- [`.portulan/dod.md`](.portulan/dod.md) — the definition of done.
- [`.portulan/verify/README.md`](.portulan/verify/README.md) — the verify recipes. All of them are
  green before every commit, and CI runs every recipe the manifest yields: the workspace's own, plus
  those the packs it composes contribute.
- [`docs/plan.md`](docs/plan.md) — the milestones, and the Session log every session appends to.
- [`docs/vision.md`](docs/vision.md) — the constitution. **Human-owned; no agent edits it, ever.**

`main` is protected: no direct pushes, required checks must be green, every review conversation must be
resolved, and administrators have no exemption. Every pull request carries at least one label from
[`.portulan/labels.json`](.portulan/labels.json).

## Security

**Please do not report a security issue in an issue.** An issue is a permanent record that everyone
with access reads, and this repository is public.

[`SECURITY.md`](SECURITY.md) is the policy and the only place the procedure is written: the reporting
channels in the order to try them, what is in scope, and what response to expect. It is not restated
here, because a procedure with two carriers is obeyed at the narrower one.

## License

By reading, cloning or forking this repository you are working under [Apache-2.0](LICENSE).
Contributions filed through the issue forms are made under the same terms.
