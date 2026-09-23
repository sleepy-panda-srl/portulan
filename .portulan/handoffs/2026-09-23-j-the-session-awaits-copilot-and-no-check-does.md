# Handoff — 2026-09-23: the session awaits Copilot's round, and no check does

**What landed.** `copilot-review.yml` is removed, 1,658 lines, and with it the `copilot-reviewed` check:
the three-minute window, the round matcher and its #286 classifier, the promotion of suppressed notes into
threads, the derived verdict and its dismissals, and the re-run re-request. The awaited half of the merge
rule moves to the session that owns the pull request: it awaits Copilot's round on the final head, and its
ready message carries one line, `Copilot: review <id> on <commit>: fixed <what>; answered <what>.`, in the
form [`merge-discipline.md`](../gate-map/merge-discipline.md) fixes. Conversation resolution still blocks
a merge while a thread is open, and [`copilot-request.yml`](../../.github/workflows/copilot-request.yml)
still asks for the round on a bot's pull request, unchanged but for its comments and one summary line.

**Why.** The maintainer's words at 17:21 UTC: *"Work with coordinator on this, the whole process needs to
be rethought, discarded, approach completely differently if need be - anything that's actually more
streamlined, with less friction than it is now. Today too many PRs have CI red because of the Copilot
review step."* He chose removal over one consolidated check at 21:22 UTC. `copilot-reviewed` was never a
required context, so it held no merge; that day it went red at its close on #431 and #432, and every round
it saw carried Copilot's new `## Copilot review overview` body, which its matcher read as unrecognised.

**What was checked before removing it.** Nothing outside the job read the check's outputs: the required
contexts are `workspace-verify` and `pr-labeled`, `gates.json` names no Copilot check, and no workflow
runs on its completion. The promotion step fed no record, only threads that conversation resolution then
gated, and none of the three review bodies read that day carried a suppressed block. Neither promotion nor
the verdict acted that day: #435's reviews are the maintainer's, Copilot's and the sessions' replies, and
none is the agent identity's. The verdict was display in any case, with required approving reviews at 0.
`gh-bot-token.mjs` and the App's secrets stay, because `librarian.yml` mints its token with them.

**What else moved.** The filters recipe drops the workflow from its list with its six jq fixture sections
and every awk fixture, 1,670 → 942 lines, and no longer refuses when no workflow runs awk: `awkPrograms`
still refuses a file whose raw awk tokens its parse did not reach, and `bindAwk` a fixture that binds to
nothing. The gate map's index amends its *Merge discipline* section and drops the derived-verdict row from
*Which identity acts*, as `identity.md` does.
[`a-review-is-awaited-not-just-resolved.md`](../memory/a-review-is-awaited-not-just-resolved.md) is
rewritten around the new carrier, 8,158 → 4,665 bytes;
[`an-answer-lands-on-the-thread-that-raised-it.md`](../memory/an-answer-lands-on-the-thread-that-raised-it.md)
retires its promotion paragraph and keeps its rule; the owning session reads the review in whatever form
Copilot files it, threads or body, and the doctrine no longer depends on which. Links to the workflow in
records now point at its last version on `main`, `74a2a31`, so `docs` keeps resolving them.

**What is given up, and why that is acceptable here.** The awaited half is discipline, not a rail, which
the record states in so many words. It holds because every merge here is Gated: the maintainer reads the
ready line against the head at a merge he approves anyway. If merges stop being Gated, the half needs a
rail again, one that reads the round rather than a clock.

**Why no proposal.** The ruling stands and the change removes an actuator and moves a carrier. No axis,
mode or surface is added.

**Carried from #436.** Copilot's round on #436's last head found one Low point, carried here by the
maintainer's choice at 18:11 UTC: the look loop kept `last_error` from an earlier failed look, so a wait that
ended on looks reading no pull request quoted that earlier error as the last look's. The request job's rewrite
in #444, after #436's first live run was refused, clears it at every look, so the point closed there. Its next
round found a Medium point, answered rather than fixed: a push landing between a run's last look and its
request draws a second round of the newer head, which a re-read before the call would only narrow, since no
request can pin a commit. The header's stated price now names that whole window.

**Copilot's round on `4c242b2`.** One thread, Low, and right: the filters recipe's rewritten comment lost its
verb and could be read as its harness still covering the removed workflow; it now says which workflow still
branches on jq's null and which did. The summary named three more with no thread, all taken. A Moderate one:
this change's own claim that every head a bot pushes draws a round ignored the pending run a later push
cancels, which the request job's header already describes, so that header and *Merge discipline* now say the
newest head's run is the one that asks. Two nits on the review meter: its comment still gave the deleted
file's path and offered to lift a program that is gone. It now links the workflow's last version and puts the
lift in the past, and its three other carriers say the copy would have been a second spelling.

**How it was tested.** All 28 recipes green, `tests` as a non-root user in a copy. The lifted
`copilot-request.yml` step ran against the stub `gh` in the twenty-four cases of #444's harness, with the same
exits as #444's head in every case, and the same summaries but for the one line this change rewrites, in the
seven cases that ask and are confirmed, and the look counts of the two that time out, which vary from run to
run. The harness is in the project's shared files, not in this repository.

**#444's observation, made.** The first run of the rewritten request job, on #446's push of `7ab7022` at 20:21
UTC after #444 merged (run 35915428845), went green. Copilot still held a request from the head before, so the
job waited 215 seconds until that round landed, asked at 20:25:29 with the maintainer's token, and its own
token's first read after the call listed Copilot, so GitHub shows the Bot to the job's token. Copilot's run
for `7ab7022` started at 20:25:41 and its review landed at 20:29:19. The timeline was not read; the run
starting on that head is the evidence.

**Observation (proposal 0007).** On the next pull request a session opens, its ready message carries the
line and the review it names is on the head; on the next bot-authored one, Copilot's own run shows among
the head's checks and no `copilot-reviewed` check does.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38 (no fresh-context runs unless he asks);
the coordinator session reviewed the diff before the commit; his review is on the pull request.

**Left as found.** Issue [#355](https://github.com/sleepy-panda-srl/portulan/issues/355), whose route
needed the removed matcher, is his to close. Proposals `0021` and `0023` stay as records.

**Next action.** The ten-round measurement the rewritten *Merge discipline* describes.
