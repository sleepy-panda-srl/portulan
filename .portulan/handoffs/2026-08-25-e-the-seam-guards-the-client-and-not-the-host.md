# Handoff — the seam guards the client and not the host, and the obvious fix scores zero

**Session:** 2026-08-25, after [#345](https://github.com/sleepy-panda-srl/portulan/pull/345) exposed a gap
in the pre-commit seam scan. Scope: *draft a proposal asking the maintainer whether the scan should cover
his own host paths and username.* **Drafted, not taken. No milestone row moves.**

## State

[`0032`](../proposals/0032-the-seam-guards-the-client-and-not-the-host.md) is filed and **OPEN**. No rule
changed, no matcher changed, no term list touched — the private context file was **read** for the draft
and not edited. All eighteen yielded recipes green — `docs` 5c reddened until this branch's second commit
gave `0032` its pull-request URL, which is [#346](https://github.com/sleepy-panda-srl/portulan/pull/346).

## The measurement that turned this from a patch into a proposal

**The obvious repair does not work.** The leaked string was the Claude Code project-directory spelling, in
which the path separators are **dashes, not slashes** — the checkout path flattened into one directory
name. A pattern check for `/Users/`, `/home/`, `$HOME`, a leading slash, or a tilde **matches none of it**
and would have run green on that diff. The only thing that catches it is the **username as a plain
substring**.

That inverts the intuition a reader arrives with — *a path is a pattern, a pattern belongs in a verify
recipe* — and it is why the proposal refuses to recommend a path-pattern recipe on its own: shipping one
would close the proposal while leaving its own incident uncaught, and would read as coverage it does not
have. This is [`memory/a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md)
at the level of the list rather than the matcher.

## Decisions + why

- **Filed as a proposal, nothing taken** — because one candidate carrier is a file **outside this
  repository** that only the maintainer holds, and another would put the seam into `core/` for the first
  time. Both are his to rule on. Alternatives considered: widen the private list directly (would have put
  a *public* string in the *private* file and made that file a precondition for catching a public
  mistake), or ship a path-pattern recipe (scores zero on the incident, see above).
- **Three carriers argued rather than one recommended**, and a fourth — *change nothing* — named, so the
  ruling is not put loaded.
- **The `feedback` half was measured, not assumed.** `cli/feedback.mjs` scans case-insensitive substrings
  and its docblock names *"a host, a path fragment"* as the term shape it was built for — so the mechanism
  fits. But **no list is configured at any of its three locations** in this workspace (no `seam-terms.txt`
  anywhere in the checkout, `$PORTULAN_SEAM_TERMS` unset), so it reports NOTHING WAS SCANNED and sends. The
  two things called *the term list* are **different files and only one exists** — recorded as a finding,
  and deliberately not bundled.

## The live exposure, which is NOT this proposal's to rule on

The #345 branch **tip** is clean, but **`8bc93ff` and `7f2d96c` still carry the string in their trees**,
one file and one line each. Both are pushed and readable now in an open public pull request, and this
repository **rebase-merges**, so they enter `main` as they stand. The 2026-08-19 precedent (`a15dde4`) was
ruled *leave it and record it*; whether that extends here is the maintainer's, and it is flagged in the
proposal's Incident section rather than acted on.

## Open questions

All three are the proposal's and all three are the maintainer's: **which carrier** holds the host-side
terms, **whether anything ships to adopters** given a username is not a fixed string a workspace inherits,
and **whether `feedback`'s absent list is a second defect** to fix in its own review.

## Supervision

**No fresh-context checkpoint ran** — subagent delegation was not available to this session.
[`gate-map.md`](../gate-map.md) → *Supervised-build checkpoints* provides for exactly this: *"If supervision
is unavailable in a session, that is stated plainly and the maintainer reviews the diff."* Stated plainly
here and in the Session log entry rather than left to be noticed. No milestone is being self-certified;
the pull request is the gate.

## Next action

Nothing owed by this session. The proposal waits on a ruling; if it is accepted, the carrier it names
decides which review lands the change.

## Recoverability

Nothing partial. Three files added or appended, no mechanism touched, no term list edited.
