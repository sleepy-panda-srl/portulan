# Who may commit is verified, not assumed

**type:** rule
**scope:** workspace — this repository's access posture and the contribution channel
**provenance:** `form=link` `href=../handoffs/2026-07-27-who-may-commit.md`
— the maintainer's ruling, Marius Cetanas, 2026-07-27: *anyone may clone and view; only team members
commit and push*, and separately that **external pull requests are not accepted** — outside
participation is proposals and feedback through the issue forms, and no coding work on the repository
without being a team member.

**Anyone may read, clone and fork. Only the `maintainers` team may push. External pull requests are
declined**, and [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) says so in as many words rather than
leaving a contributor to discover it in a closed pull request.

**Why it holds:** *"that's just GitHub's default for a public repository"* is the reasoning this record
exists to refuse. It is approximately true and it is not a measurement, and the gap between the two is
where a stray collaborator grant lives — an invitation accepted months ago, an organisation default of
`write` rather than `read`, a team added for one task and never removed. None of those announce
themselves, and all of them are invisible from inside the working copy. The same class as
[`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md): a permission
posture described from memory is a claim, and claims about access are the expensive kind to get wrong on
a public repository whose history is permanent.

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

**Retire when:** a second person gains push access, or the external-contribution posture changes. Both
falsify the table above rather than merely dating it, and the table is the part that must not be
believed after it stops being true.
