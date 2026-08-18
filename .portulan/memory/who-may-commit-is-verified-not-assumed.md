# Who may commit is verified, not assumed

**type:** rule
**scope:** workspace — this repository's access posture and the contribution channel
**provenance:** `form=link` `href=../handoffs/2026-07-27-who-may-commit.md`
— the maintainer's ruling, Marius Cetanas, 2026-07-27: *anyone may clone and view; only team members
commit and push*, and separately that **external pull requests are not accepted** — outside
participation is proposals and feedback through the issue forms, and no coding work on the repository
without being a team member.

**The ruling's policy is unchanged: only the `maintainers` team may push, and external pull requests are
declined** — [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) says so in as many words rather than
leaving a contributor to discover it in a closed pull request. **What changed is the reach the policy
sits on.** *"Anyone may read, clone and fork"* was true while the repository was public
(2026-07-27 → 2026-08-03); it went false on **2026-08-03**, when the repository went private and
`allow_forking` read **`false`** (re-measured 2026-08-10); and it is **true again** with the second flip
to public. **The policy never moved through any of it** — that is the record's whole point, and the
reason this sentence has now been rewritten twice while the sentence above it has not. The read-backs
below carry the numbers, and the third one is owed at the flip rather than assumed from it.

**Why it holds:** *"that's just GitHub's default for a public repository"* is the reasoning this record
exists to refuse. It is approximately true and it is not a measurement, and the gap between the two is
where a stray collaborator grant lives — an invitation accepted months ago, an organisation default of
`write` rather than `read`, a team added for one task and never removed. None of those announce
themselves, and all of them are invisible from inside the working copy. The same class as
[`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md): a permission
posture described from memory is a claim, and claims about access are the expensive kind to get wrong on
a repository whose history is permanent and part of which was published. **The visibility flip-back of
2026-08-03 is this record's own thesis arriving on it**: the Visibility row below was measured, correct,
and went false without announcing itself — which is exactly the gap the entry exists to refuse, and the
reason the read-back is dated rather than stated.

**The verification, 2026-07-27** — read back rather than assumed, and the numbers are the point:

| What | Reading |
|---|---|
| Visibility | `public`, forking enabled |
| Direct collaborators | **one** — `marius-cetanas`, `admin` |
| Outside collaborators (org-wide) | **none** |
| Organisation members | **one** — `marius-cetanas` |
| `default_repository_permission` | **`read`** — an org member gets read, not write |
| Teams with access | `maintainers`, `push` — membership: one |
| `main` | no direct pushes · `workspace-verify` + `pr-labeled` required · conversation resolution required · `strict: true` · `enforce_admins: true` · force-push and deletion blocked |

So the posture the ruling describes is the posture that is configured. **Nothing was found that needed
revoking**, which is the outcome to record precisely — a check that finds nothing has still been run, and
next time the question is asked the answer will be *"verified on this date"* rather than *"it should be
fine"*.

**Two findings that are not access grants and are worth carrying anyway**, since the same read surfaced
them:

- **Private vulnerability reporting is off**, so there is no private channel for a security report on a
  public repository. `CONTRIBUTING.md` states that honestly rather than pointing at a button that is not
  there.
- **Secret scanning and push protection are off.** Both are free on public repositories, and push
  protection is the one that would have refused a credential *before* it reached a permanent public
  history. This repository's confidentiality discipline is currently a per-commit human scan with no
  platform backstop underneath it — a mandate with nothing checking it, which is
  [`a-mandate-nothing-checks-is-already-broken.md`](a-mandate-nothing-checks-is-already-broken.md)
  pointed at the seam.

Both are repository-settings changes: **Gated**, the maintainer's, and not this record's to make.

**The re-verification, 2026-08-10** — run because the repository flipped back to private on 2026-08-03
and this record's own Retire-when says the table must not be believed after it stops being true. Read
back, not inferred:

| What | 2026-07-27 | 2026-08-10 |
|---|---|---|
| Visibility | `public`, forking enabled | **`private`**, **`allow_forking: false`**, unauth `GET` **404**, 0 forks |
| Direct collaborators | **one** — `marius-cetanas`, `admin` | **one** on the plain read, `marius-cetanas`, `admin` — and **zero** with `?affiliation=direct`: the access is via org ownership, not a repository grant |
| Outside collaborators (org-wide) | **none** | unchanged — **none** |
| Organisation members | **one** — `marius-cetanas` | unchanged — **one** |
| `default_repository_permission` | **`read`** | unchanged — **`read`** |
| Teams with access | `maintainers`, `push` | unchanged — `maintainers`, `push` |
| Secret scanning · push protection | off · off | unchanged — **off · off** |
| Private vulnerability reporting | off | still off — the endpoint answers **404** here |

**Scope of this read-back, stated so a green states its own coverage:** it re-reads the access and
security rows above. It does **not** re-read `main`'s branch protection — the 2026-07-27 row for that
stands as history and is owed its own re-measurement.

**One row moved, and it is the one nobody was watching.** Every access grant is exactly where it was;
the visibility that made the ruling's *"anyone may read, clone and fork"* half true is what reverted.
That is the finding worth carrying: this entry was built to catch a stray grant, and what actually went
stale was the setting the grants were being reasoned *against*.

Two consequences, stated because the 2026-07-27 findings above are now priced differently: the platform
backstop this record called absent is no longer merely switched off — secret scanning and push
protection are free on **public** repositories, and private vulnerability reporting is a public-repository
feature, so on a private repository the gap is harder to close rather than one setting away. The
per-commit human scan ([`../dod.md`](../dod.md), condition 5) is carrying more than it was, which is why
condition 5 now says in as many words that no move of the setting relaxes it.

_(2026-08-17 — **and two of the three are now ON**, on the maintainer's explicit instruction. Measured
after the PATCH, not assumed from it: `secret_scanning: enabled`, `secret_scanning_push_protection:
enabled`. **Both took while the repository was still private**, which refutes this record's own reading
that they were public-only and *"one setting away"* — they were one setting away the whole time.
**Private vulnerability reporting did not:** `PUT /repos/{owner}/{repo}/private-vulnerability-reporting`
answers **404** on a private repository, so it is genuinely public-only and is owed at the flip. The
per-commit scan is unchanged either way — push protection catches credentials, never client material,
and the seam is the second thing.)_

**Retire when:** a second person gains push access, or the external-contribution posture changes. Both
falsify the table above rather than merely dating it, and the table is the part that must not be
believed after it stops being true. _(2026-08-10: visibility moving is **not** on that list and moved
anyway — which is why the table is now two dated columns rather than one, and why the next reader should
re-run the read-back instead of trusting either.)_
