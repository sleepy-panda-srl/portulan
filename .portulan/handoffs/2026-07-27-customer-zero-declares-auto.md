# 2026-07-27 — Customer zero declares `auto`, and what that costs

**The ruling.** Marius, 2026-07-27: **the portulan repository itself runs Auto mode** — fully autonomous
through ship — while **the shipped default for any customer workspace stays Gated**. Customer zero
dogfoods the most autonomous mode; the engine recommends the middle one.

**Why this is a separate change from the mode model.** The mechanism landed at `gated`, where it removed
no gate. This one word removes one: `Bash(gh pr merge:*)` leaves the compiled `ask` list. A constitutional
question does not belong buried in a 1,400-line mechanism diff, and there is one — see below.

**What it actually changed.** One line in the artifact. Every other compiled rule is untouched, and the
Prohibited tier and all thirteen mode-invariant rules are unmoved.

**`auto` removes a prompt, not the floor — but read what the floor guarantees before leaning on it.**
This is the paragraph a future session will be tempted to soften, so it is written hard:

- A pull request that **drew a review comment** still cannot merge until someone resolves the thread, and
  the agent identity is refused `resolveReviewThread` by GitHub. Real, and it holds.
- But resolution establishes that a comment was not *ignored*, **not that anyone agreed** — a reviewer
  can resolve its own thread, which Copilot did on #44.
- And a pull request that **drew no comment at all** trips nothing. Required approving reviews are 0, so
  no floor row demands a human act. **A merge can land here with no human involvement whatsoever.**

That last sentence is what the ruling bought. It is not a gap to close by accident.

**The cost taken deliberately.** The commit-attribution argument — his name on a `main` commit records a
decision he took — rested on every merge being approved. It no longer holds. The gate map was rewritten
in this same change to say his authorship records that he owns the repository and that the change cleared
the floor, and *not* that he decided it should land. Rewritten rather than left standing, because an
argument that quietly rebuilds itself on a weaker footing is the drift that file has been corrected for
twice already.

**The constitution conflict, which is why this needs his hand.** A fresh-context supervisor found it, and
it is real rather than pedantic. At `auto` an agent can open **and merge** a change to `core/` — a rule
change — with no human act, whenever the pull request draws no comment. Against:

- `docs/vision.md:81` — *"No unsupervised self-evolution. Rule changes are proposals → human/eval-gated PRs."*
- `docs/vision.md:113` — *"The human gate on rule changes … never remove it."*

With one human, zero required reviews, and `auto`, those cannot both hold. **`docs/vision.md` is
human-owned and no agent may edit it**, so the redline options are in the pull request body for his own
hand and a fresh review. The machinery cannot split the difference: a gate matcher sees the command, not
the diff, so *"merge stays gated only for rule-change pull requests"* is not expressible today.

**If the cost is judged too high, the lever is one word** in `gates.json` plus a recompile. Nothing else
in the mode model depends on which value this workspace picked.

**Seam scan clean** across files, commit message, and branch name.
