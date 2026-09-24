- **A change's record is its commit, and two open pull requests no longer conflict over records.** The
  doctrine every workspace boots from now puts a change's why in its commit message and asks for a
  handoff only when a session ends with work not committed and pushed; the
  [handoff template](../core/templates/handoff.md) holds open state only, with a filled example, and the
  Stop gate's refusal names committing and pushing as the other way out. A workspace may stop keeping
  its handoff index: with no copy on disk, `portulan index --check` renders the series instead of
  comparing a copy, and `portulan index --handoffs` prints it, while a workspace that keeps one, as
  `init` drafts, is checked as before. `portulan index --changes <dir>` prints changelog fragments, one
  file per change, grouped for a release, which is how this repository now writes its own under
  [`changes/`](../changes/). In Portulan's own repository the Session log retired from `docs/plan.md`,
  and the docs recipe checks that the newest change's commit carries a `Seam-scan:` trailer.
