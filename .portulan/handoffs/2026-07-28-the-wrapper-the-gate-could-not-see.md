# Handoff — the wrapper the gate could not see, and the boundary that held anyway

**Date:** 2026-07-28 · **Between milestones (4 closed, 5 not open)** · Branch
`the-wrapper-the-gate-could-not-see`

A report arrived that `change-settings-through-the-api` is bypassable: `.portulan/tools/gh-bot api …`
reaches the same endpoints as `gh api`, matches neither the compiled `Bash(gh api:*)` prefix nor
`compile/gate.mjs`'s one level of unwrapping, and was allowlisted by hand in
`.claude/settings.local.json`. The report was right about the gate and wrong about the consequence, and
the difference is the whole of this session.

## What was measured, before anything was decided

The installation holds `metadata: read` and `pull_requests: write` and **no** `administration`. Through
the wrapper, on 2026-07-28:

| Attempted | GitHub |
|---|---|
| `PATCH repos/{owner}/{repo}/rulesets/{id}` | `403 Resource not accessible by integration` |
| `GET repos/{owner}/{repo}/branches/main/protection` | `403` |
| `GET repos/{owner}/{repo}/rulesets` | **`200`** |

So the settings **change** the rule exists to stop was already refused, by the platform, on a spelling no
local layer could see — which is `core/operating/autonomy.md`'s claim about the floor demonstrated rather
than repeated. The **read** was not refused, and that rule gates reads deliberately, so one half was a
real gap rather than a technicality.

## The ruling: no cleverer matcher, and the reasons are structural

The obvious fix — teach the compiler this wrapper's spelling — was rejected, and it is worth having the
argument on the record because it will be proposed again:

- **Gating `gh-bot api` wholesale gates pull-request conversation**, which is the one thing that identity
  exists for. An agent meeting a dead end there reaches for plain `gh` and posts as the maintainer — the
  exact failure `memory/agent-activity-is-attributable.md` exists to prevent. The cure is worse.
- **Gating only the settings endpoints is not expressible.** A permission prefix cannot discriminate on a
  path segment several deep, and `cli/compile.mjs` refuses `:` in a shell target for its own good reasons.
- **A compiler feature with no consumer is this repository's signature defect** —
  `memory/a-manifest-field-can-validate-and-load-nothing.md`. No rule in this policy wants a
  multi-spelling target, so adding one would be machinery justified by a hypothetical.

What was built instead is an endpoint allowlist **inside the wrapper**, running before the token is
minted, so a refused call never creates a credential. It is a guard against habit and is labelled one in
the file that carries it: an agent with shell access can mint the token and call `gh` directly, and
`graphql` is admitted whole. The rail is the permission set, and the gate map now says so.

## Two claims this repository made about itself that measuring disproved

Both in `gate-map.md`, both in the *inference* rather than in the recorded fact — the permission set was
written down accurately on 2026-07-25 and the conclusions drawn from it drifted:

- *"The agent identity's token cannot do these at all"* — false of reading. Ruleset reads ride on
  `metadata`. Corrected to name what it cannot **change**, with the surface's real edge stated.
- *"That token writes pull-request conversation and nothing else"* — true of writes, silent about a read
  surface that turned out to matter.

This is the drift no lint over this tree can catch, which the file already says about itself in a
neighbouring paragraph. It was found by making a request, not by reading.

## What is left undemonstrated, said plainly

- **The `PATCH` refusal is inferred from two `403`s, not observed.** Attempting it is a settings change
  nobody approved; a branch-protection read and the App's own permission set are what stand behind it.
- **The permission set is a live setting no file here pins.** Widening that App turns hole 4 from a
  documented gap into a live bypass and nothing in this tree would notice. `tools/README.md` now says so
  at the step that would do it.
- **The local `allow` entry was left broad.** `Bash(./.portulan/tools/gh-bot api *)` is now bounded by the
  wrapper rather than by the pattern. Narrowing a git-ignored glob would risk prompting mid-feedback-loop
  for no gain the wrapper does not already give.

## Incidental, and recorded because the record is the product

A probe run while testing the guard used `-f body=hi`, which makes `gh api` **POST** — it posted a `hi`
comment as `portulan-agent[bot]` on [#8](https://github.com/sleepy-panda-srl/portulan/issues/8). Deleted
on the maintainer's instruction the same minute. The lesson is small and general: a read-only probe of a
write-capable tool is only read-only if you check the verb.

## What is next

Milestone 5 — memory lifecycle and the librarian — is unchanged and unstarted by this session.
