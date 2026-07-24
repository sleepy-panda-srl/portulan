# Template — Repo card

> A **repo card** is the per-repo layer of the resolution cascade (`core < pack < workspace < repo card
> < task`): the small, high-value facts an agent needs to work in *this* repository and cannot infer
> safely. Keep it short — it is loaded often. Copy the skeleton below into a repo and fill it; delete
> lines that don't apply rather than leaving them blank. (Placeholders are in `{braces}`.)

---

# Repo — {name}

**What it is.** {one or two sentences: the repo's job and its blast radius.}

**Build / test / run.**
- build: `{command}`
- test: `{command}`   ← the verify recipe the Stop-gate runs (see `../operating/verification.md`)
- run:  `{command}`

**Gates.** {actions here that deviate from the workspace gate map — e.g. "migrations require a DBA
review." Leave empty to inherit the workspace default; see `../operating/autonomy.md`.}

**Layout.** {the 3–6 paths a newcomer agent most needs — not a full tree.}

**Quirks.** {the non-obvious facts that cause wrong changes: the flaky test to rerun, the generated file
never to hand-edit, the module that looks dead but isn't.}

**Provenance.** {link the card, or any rule in it, back to the incident that earned it — so it can be
retired when it no longer applies.}
