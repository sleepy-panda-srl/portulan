**type:** rule
**dated:** 2026-09-24
**scope:** workspace — this repository's access posture and contribution channel
**provenance:** `form=link` `href=../handoffs/2026-07-27-who-may-commit.md`
— the maintainer's ruling, 2026-07-27: *anyone may clone and view; only team members commit and push*,
and external pull requests are not accepted: outside participation is proposals and feedback through the
issue forms.

**Only the `maintainers` team may push, and external pull requests are declined**, as
[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) says. The policy never moved while the reach under it did:
public from 2026-07-27, private with forking off from 2026-08-03, public again since 2026-08-18.

**Why it holds:** *"that's just GitHub's default for a public repository"* is roughly true, not a
measurement, and the gap is where a stray grant lives: an invitation accepted months ago, an org default
of `write`, a team added for one task. None announces itself or shows in the working copy; access
described from memory is a claim ([`a-stated-enforcer-must-be-the-real-one.md`](a-stated-enforcer-must-be-the-real-one.md)).
The 2026-08-03 flip proved it: a measured, correct visibility row went false without a word.

**So the posture is read back and dated, never assumed.** 2026-07-27: one admin, org default `read`,
`maintainers` with `push`, nothing to revoke ([its handoff](../handoffs/2026-07-27-who-may-commit.md)).
2026-08-10: only visibility had moved, and `?affiliation=direct` lists no one: the admin's access is org ownership.
Secret scanning and push protection are on since 2026-08-17, private vulnerability reporting since the
2026-08-18 flip ([its handoff](../handoffs/2026-08-18-the-flip-the-publish-and-what-each-measurement-cost.md)).
**Owed:** the access read-back after that flip, and a re-read of `main`'s protection.

**Retire when:** a second person gains push access, or the external-contribution posture changes. A
visibility move does not retire it; it dates the read-back, which the next reader re-runs.
