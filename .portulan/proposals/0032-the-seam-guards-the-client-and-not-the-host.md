# Proposal — the seam guards the client and not the host

**Status. OPEN — drafted 2026-08-25.** It asks one question: **should the pre-commit seam scan cover the
maintainer's own host identity — the account username and the paths that carry it — and not only the
client term list?** The answer decides where a second class of term lives, and one candidate carrier sits
**outside this repository** where no recipe can read it, so it is asked here and **not taken**. What this
change *does* take is the record: the incident, the measurements, and the fact that the obvious repair
scores zero on it.

## Incident — one change carried both spellings and shipped the wrong one publicly

On [#345](https://github.com/sleepy-panda-srl/portulan/pull/345), the handoff
`.portulan/handoffs/2026-08-25-d-the-consolidation-that-first-made-the-file-bigger.md` — named here as a
path rather than a link, because it lives on that branch and not yet on `main` — named the
agent memory store by its **full mangled project-directory path, personal username included**, in a
repository that is **public with zero forks** (`gh repo view`, 2026-08-25). The **Session log entry two
files away in the same change already used the redacted `~/.claude/projects/…/memory/` form** — so one
diff carried both spellings of one path, and the public one was the wrong one. Fixed at `e42f0eb`.

**Nothing in this repository would have caught it.** [`../dod.md`](../dod.md) condition 5 makes the
pre-commit scan a condition of done, and the term list it enforces lives in `../portulan-private/CONTEXT.md`
— read for this draft, and its contents are **client-identifying terms and nothing else**. The scan ran, was
clean, and was correct: the string was not on the list it was given.

**What caught it was Copilot**, at
[`#discussion_r3854791452`](https://github.com/sleepy-panda-srl/portulan/pull/345#discussion_r3854791452),
which named the redacted form to prefer. A reviewer of last resort caught what the gate was never asked to
look for — the shape [`a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md)
is about, here at the level of the *list* rather than the matcher.

**Where the tree stands, measured rather than assumed.** At `main`'s head there is **not one occurrence** of
`/Users/` or of the maintainer's username in any tracked file, and **none in all 900 commit messages on
`main`**. [`../tools/README.md`](../tools/README.md) names a home-relative location three times and does it
**portably**, with `$HOME/…`. So the habit this proposal would make a rule is already the house habit
everywhere it has been exercised deliberately — the leak happened where nobody was deciding.

**And the fix-forward does not unpublish it.** The branch **tip** is clean; **two of its three commits —
`8bc93ff` and `7f2d96c` — still carry the string in their trees**, one file and one line each. Both are
pushed and readable now in an open public pull request, and this repository **rebase-merges**, so they enter
`main` as they stand unless something else is done. That is
[`a-published-window-cannot-be-unpublished.md`](../memory/a-published-window-cannot-be-unpublished.md)'s
subject and it is **not this proposal's to rule on** — it is recorded here because a proposal that argued
about future commits while its own incident sat unremediated would be describing a cost it had declined to
measure. The 2026-08-19 precedent (`a15dde4`) was ruled **leave it and record it**; whether that ruling
extends here is the maintainer's.

## The obvious repair scores zero on the actual incident

This is the load-bearing measurement, and it is the reason this is a proposal rather than a patch.

The leaked string was the **Claude Code project-directory spelling**, in which the path separators are
**dashes, not slashes** — the checkout path flattened into a single directory name. A pattern check for
`/Users/`, for `/home/`, or for `$HOME` **does not match it**. Nor does a check for a leading slash, an
absolute-path shape, or a tilde. Every path-shaped matcher a reader reaches for first would have run
**green on this diff**.

**What would have caught it is the username as a term** — a plain substring, matching inside the mangled
segment exactly as it matches inside a normal path. So the intuitive split, *"a path is a pattern and a
pattern belongs in a recipe"*, has the incident backwards: **the pattern half is the reassuring half, and
the term half is the one that works.** Any ruling that ships only a path-pattern recipe would close this
proposal while leaving the incident it was opened for uncaught, and would read as coverage it does not
have.

## Proposed rule

> **The seam has two sides.** The pre-commit scan covers, beside the client term list, **the maintainer's
> own host identity** — the account username, and any spelling of a filesystem location derived from it,
> including manglings in which the separators are not slashes.

With the drafting half, which is what makes the scan rarely fire rather than fire often:

> A public artifact names a location **portably or not at all** — `~/…`, `$HOME/…`, or an elision such as
> `~/.claude/projects/…/memory/`. A spelling that is only true on one machine carries nothing a reader
> needs, and the mechanism it describes is identical wherever the directory sits.

And the half that is about the check rather than the terms, carried over rather than re-derived: whichever
carrier holds it, it **runs as its own step whose result reaches the decision**
([`a-gate-that-cannot-reach-the-act-is-a-report.md`](../memory/a-gate-that-cannot-reach-the-act-is-a-report.md)),
and its coverage is **measured against the spelling that actually leaked**, not against the spelling that
seems obvious.

## Where it belongs — three carriers, and the argument against each

**Q1 is the ruling this proposal exists to ask for: which of these carries it.**

**(a) The out-of-repo term list.** The mechanism already fits — it is a list of substrings, and a username
is a substring. But the reason that list lives outside this repository is that **its contents are
confidential**, and the maintainer's username is not: it is on the org, on every commit, on the pull
requests this file links to. Putting a public string in the private file to borrow its machinery makes the
private file's location a **precondition for catching a public mistake**, and a contributor without that
directory then has a scan that silently covers less than the one the maintainer runs — with nothing in the
repository saying so.

**(b) A verify recipe in [`../verify/`](../verify/).** In-repo, readable, red-first-able, and it runs in CI,
which is where the other seventeen rails live. It is the right carrier for the **portable-spelling** half:
an absolute-path pattern is checkable and its coverage is arguable in the open. It is the **wrong** carrier
for the username, which cannot be committed to a public recipe without publishing the very string the rule
exists to keep out — the rule would leak its own subject.

**(c) Both, split by what each can hold.** The pattern in a recipe; the username in whatever list the
scan already reads. This is the only split that survives §"the obvious repair" — and it is also the one
that has to answer for a rule with **two carriers**, which
[`0020`](0020-a-fix-is-not-done-at-the-site-it-was-found.md) is this repository's standing argument
against: one rule with two carriers is obeyed at the narrower. The counter is that these are not two
carriers of one rule but **one rule over two term classes with different confidentiality**, which is a
distinction a reader can check rather than one they must take on trust.

**A fourth option is named so the ruling is not put loaded: change nothing.** Copilot caught this one, the
tree is otherwise clean at `main`, and the exposure class is a username rather than data, a person, or a
document.

## Q2 — does anything ship to adopters?

**Measured, because it changes the answer: `core/` contains no occurrence of the word "seam" at all** — the
seam is entirely this workspace's (`.portulan/`) plus `cli/feedback.mjs`'s plumbing. Anything shipped in
`core/` would be the seam's **first** appearance there.

The two halves generalise differently, and this is the whole of Q2:

- **The portable-spelling rule generalises.** Every adopter has a home directory and a public artifact;
  *name a location portably* needs no per-workspace value to be true.
- **A username does not.** It is not a fixed string an adopter's workspace could inherit — it differs per
  machine and per person — so anything in `core/` naming one would be **configurable or nothing**, and a
  configurable slot with no value set is the state `feedback` already has, described next.

## Q3 — what a widened list would reach at `cli/feedback.mjs`, measured

[`../../cli/feedback.mjs`](../../cli/feedback.mjs) seam-scans every report before it leaves the machine, so
a widened list reaching that path is a real consequence to weigh. Two measurements bound it.

**The mechanism fits, and was built for exactly this.** `parseTerms` takes one term per line with `#`
comments, lowercased; `scan` is a **case-insensitive substring** over the payload's sections, and its
docblock says why in so many words — the terms that matter are *"names and identifiers that turn up glued
to other text — a host, a path fragment, a ticket prefix"*. A username in a mangled directory segment is
that case precisely.

**But it would reach nothing today, because that path has no list.** `feedback` looks in three places —
`--seam-terms`, `$PORTULAN_SEAM_TERMS`, then `<workspace-dir>/seam-terms.txt`. Measured 2026-08-25: **no
`seam-terms.txt` exists anywhere in this checkout, and the variable is unset**, so `portulan feedback` in
this workspace reports *"no term list configured — NOTHING WAS SCANNED"* and sends anyway, which is its
documented and deliberate behaviour.

**So "widen the term list" is ambiguous in this workspace, and that is a finding rather than a caveat:
there are two carriers called the term list, they are different files, and only one of them exists.**
Widening the pre-commit list does **not** reach `feedback`. Whether the two should become one carrier is a
third thing the maintainer may want to rule on, and it is deliberately **not bundled** — it is a mechanism
change with its own review, and it is also the only route by which this proposal's rule would reach an
outward-facing send.

## Honest limits

- **A term list cannot be tested in public.** A recipe that greps for a string it must not contain has to
  read that string from somewhere, and wherever that is becomes a precondition for the green. Any accepted
  form of (a) or (c) inherits this, and it is the reason the private list has no rail today either.
- **This is prose until it is a hook.** Condition 5 binds an agent to run a scan; nothing refuses the
  commit. `a-gate-that-cannot-reach-the-act-is-a-report.md` already carries that limit and this proposal
  does not repair it — it **adds terms to a check with the same standing it had**, which is
  [`a-recorded-limit-is-not-a-managed-limit.md`](../memory/a-recorded-limit-is-not-a-managed-limit.md)'s
  distinction, on the record here rather than left to be discovered.
- **One incident, one class.** A username is the case that leaked. Machine names, serial numbers, local
  ports, and the shape of a private directory tree are the same category and are **not** measured here;
  the rule as proposed names the category ([`0029`](0029-a-constraint-names-a-category-not-a-list.md)),
  which means it reaches them and nothing demonstrates that it does.
- **It would not have been free.** A substring scan for a common personal name produces false positives in
  ordinary prose. The maintainer's is distinctive enough that this cost is small **here**, and that is a
  fact about this one string rather than an argument the rule can carry to anyone else.
- **The incident's own bytes are already out**, per the Incident section. Accepting this rule changes what
  the next commit may carry and changes nothing about `8bc93ff` and `7f2d96c`.

**Retire when:** the seam scan runs as a hook that can refuse the commit — the same condition
[`a-gate-that-cannot-reach-the-act-is-a-report.md`](../memory/a-gate-that-cannot-reach-the-act-is-a-report.md)
sets for its own retirement — **and** that hook's term set is enumerated somewhere a reader can check,
whichever side of the seam it lives on. At that point *which terms are covered* becomes a measurable
property rather than a rule an agent is trusted to have applied, and this file has nothing left to ask.

## Provenance

`form=link`
`href=`[`https://github.com/sleepy-panda-srl/portulan/pull/345#discussion_r3854791452`](https://github.com/sleepy-panda-srl/portulan/pull/345#discussion_r3854791452)
— the Copilot review comment that caught a personal username in a public artifact, and named the redacted
form the same change already used two files away. Fixed at `e42f0eb`. In-repo and resolvable by anyone who
can read this proposal; **no client material, so no seal is needed** — which is itself the fact this
proposal is about.

## Decision

_Undecided. **The decision is the maintainer's**: it is his own identity being scanned for, one candidate
carrier is a file only he holds, and Q2 would put the seam into `core/` for the first time._

**Pull request:** [#346](https://github.com/sleepy-panda-srl/portulan/pull/346) — the change that filed this.
