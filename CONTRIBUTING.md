# Contributing to Portulan

Portulan is developed in the open and is **not** open to outside code contributions.

That is a deliberate posture, not an oversight or a temporary state, so it is worth stating plainly
rather than leaving you to infer it from a closed pull request.

## What anyone may do

- **Read, clone, and fork.** The repository is public and forking is enabled. Everything here — the
  engine, the workspace, the plan, the record of how each decision was reached — is yours to read and to
  learn from, under the terms in [`LICENSE`](LICENSE).
- **Report a bug.** [Open an issue](https://github.com/sleepy-panda-works/portulan/issues/new/choose) using the **Bug report** form.
- **Suggest an improvement.** Use the **Improvement** form. Proposals are genuinely wanted, including
  ones that argue the current design is wrong.
- **Send feedback.** Use the **Feedback** form for anything that is neither a defect nor a concrete
  proposal — what was confusing, what did not survive contact with your repository, what you expected to
  find and did not.

Those three forms are the contribution channel. They are not a lesser path to it.

## What only team members may do

**Commit and push.** Code lands only through members of the `sleepy-panda-works` organisation with write
access to this repository. Pull requests from outside that group are not accepted and will be closed with
a pointer back to this file — not because the change was bad, but because this is not the way changes
enter this repository.

If you have opened one already: thank you for the effort, and sorry for the wasted work. That is exactly
what this file exists to prevent.

## Why

Portulan's product is its files — the doctrine, the rulings, and the recorded reasoning behind them.
Nearly every change here is a change to a standard that other work is graded against, and the value of
that standard depends on a small number of people holding a consistent line on it and being accountable
for it. A patch queue optimises for throughput; this repository is optimising for a coherent argument.

This may change. If it does, it will change in this file, and the change will be dated.

## If you are a team member

The working discipline lives in the repository, not here:

- [`.portulan/gate-map.md`](.portulan/gate-map.md) — what an agent may do unattended, what needs
  approval, and what nothing approves. Also the autonomy **mode** this workspace runs.
- [`.portulan/dod.md`](.portulan/dod.md) — the definition of done.
- [`.portulan/verify/README.md`](.portulan/verify/README.md) — the verify recipes. All of them are green
  before every commit; CI runs every recipe the manifest declares.
- [`docs/plan.md`](docs/plan.md) — milestones, and the Session log every session appends to.
- [`docs/vision.md`](docs/vision.md) — the constitution. **Human-owned; no agent edits it, ever.**

`main` is protected: no direct pushes, required checks must be green, every review conversation must be
resolved, and administrators have no exemption. Every pull request carries at least one label from
[`.portulan/labels.json`](.portulan/labels.json).

## Security

**Please do not report a security issue in a public issue.** The repository's **Security tab** is the
authority on what private channel exists, because it reflects the live setting rather than this file's
memory of it: if it offers *Report a vulnerability*, use that — it reaches the maintainer with no public
record. If the button is absent, GitHub's private vulnerability reporting is off, and the fallback is
email to the maintainer — the address on the maintainer's GitHub profile or, if the profile shows
none, the author address on this repository's commits (`git log` shows it; a profile can hide email,
a commit cannot). Enabling private reporting is a repository-settings change — Gated, and the
maintainer's — and it is the right fix; this paragraph is written to stay true on either side of
that switch.
