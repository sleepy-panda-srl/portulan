# Handoff — 2026-09-23: what a change spends is read, and a session is told once when to restart

**What landed.** [`cli/ledger.mjs`](../../cli/ledger.mjs) is proposal `0038`'s ledger, item 2 of its order of
work, and [`cli/advisory.mjs`](../../cli/advisory.mjs) the part of item 5 its rulings name: one line at the
prompt, and the status line. For one branch, across the repository's worktrees, the ledger prints requests
and tokens by class (uncached, written by lifetime, read, output) for the sessions and their subagents
apart, the contexts opened, compactions, the largest context, the hit rate, each rebuild with its cause,
tokens per changed line, the difference from the totals the host saves for its last session in a directory,
and the latest session's restart threshold. `compile` wires the advisory into `.claude/settings.json` for
every workspace, whatever its policy says, because it gates nothing: a `UserPromptSubmit` hook that puts one
line into the context, once, at the first prompt whose recorded usage has reached the threshold, and the
status-line command, which shows the human the same figure from the host's own last-call counts. The
[`ledger`](../verify/ledger.sh) recipe rails the reader on
[`cli/fixtures/ledger/`](../../cli/fixtures/ledger/) and the advisory's once, and never reads this
machine's records (`0038`, ruling 4).

**The host's format, as read on 2.1.280.** One transcript per session under `projects/<key>/` in the
configuration home (`CLAUDE_CONFIG_DIR`, else `~/.claude`), one per subagent under
`<session>/subagents/` at any depth, the key being the working directory with every character outside
`[a-zA-Z0-9]` a dash, cut at 200 with a hash past that; the host's own totals per directory in
`.claude.json` beside the home, as `lastTotal*` counters and `lastSessionId`. The key function and the
subagent paths were read from the host's own program text, as strings, not from its documentation, which
covers neither. **Inferred, not read:** that the status-line command runs with `CLAUDE_PROJECT_DIR` set,
as hooks do, which the compiled command's path needs; the program text does not show it, and the first
status line in a real terminal will. Every usage record is written once per content block: this session's transcript held 123 records for
66 requests when the ledger first read it.

**The threshold.** `C* ≈ F × (1 + m_w / (n × m_r))` with `n` = 20. `F` is the session's first request after
its last compaction: the host's floor and the always tier as it sent them. It leaves out the handoff and the
re-orientation reads, which move `C*` up, while a restart reading its floor from the directory's shared
cache moves it down; the module's header says both. No manifest key carries the multipliers yet, so both
surfaces print `undeclared` and use the general read, 0.1×, and the write multiplier of the lifetime the
host recorded, 2× for an hour and 1.25× for five minutes. The general read errs early on the cheaper-read
models, which ruling 2 found the cheaper way to err, and `F` errs the same way. Between a compaction and
the first request after it there is no figure: the context the records last show is the one the
compaction replaced.

**What a call costs.** The advisory runs at every prompt and every status-line refresh, so a call folds in
only the complete lines the transcript gained since the last one, onto running figures kept per session
in the temp directory beside the told-once records, and reads from the start only where nothing is kept
or what is kept no longer describes the transcript. What is kept is counts, message ids and a digest of
the bytes where the last read ended, never the bytes, which can be what the session said, in files only
their owner can read. `readTranscript` folds a whole transcript into the
same figures, so the ledger and the advisory cannot part. Measured on a 7.4 MB transcript, the median of
nine runs each: the first call, with nothing kept, 114 ms and 59 MB resident, where reading the whole
transcript at every call had measured about 150 ms and 71 MB in review; the second, with nothing new,
57 ms and 45 MB, which is the runner's startup (59 ms with no transcript at all); after a turn of 200 KB,
65 ms. Once the line is said, a prompt with nothing new does not open the transcript. Of the startup,
node itself is 30 ms and loading the ledger module about 21, `child_process` among it, which only the
ledger's git calls need: moving the fold into a module of its own would take a few milliseconds off every
call, and is not done here.

**What this change does not do.** The manifest keys for the multipliers, the horizon and the declared
block, with `init`'s offer (item 4, the next free MINOR); the mid-stretch `PostToolUse` line and the
declared Stop-gate block (the rest of item 5); `doctor`'s spend report (item 3); the per-host multiplier
table, which names models and is made from a local session. And one of row 13's demonstrations is not
made here: the difference from the host's own totals *on a real session* needs a session the host has
closed and saved, and this container's only session is this one, still running. The fixture shows the
comparison; a closed session on the maintainer's machine shows it for real.

**A cost of the status line, said where it is compiled.** A project's `statusLine` outranks the user's, so
the compiled one takes the place of a status line a person set in their user settings, in that repository.
`compile` says so on every run and names `.claude/settings.local.json`, which outranks the project's, as
where to keep one's own. The line at the prompt is unaffected.

**Readers.** `HOOK_RUNNERS` in `compile.mjs` gains the advisory as its third runner, so `payload.mjs`
classifies it a hook runner and the ledger `imported` through it, and the fourteen modules reachable from
nothing stay fourteen; `cli/README.md` carries the four rows, the roster names and that sentence;
`verify/README.md` the recipe's row and run-list line; `cli/fixtures/README.md` the fixture's row; the
manifest the recipe, 190 bytes more in this repository's boot read-set (88,947 → 89,137, under its rail
of 90,726); `drills.mjs` its drill, which disables the per-block deduplication. The A/B arm is
compiled like any workspace, so [`evals/ab/register.md`](../../evals/ab/register.md), regenerated, counts 6
hooks pinned to this machine where it counted 5, and `arm.md` and `ab.mjs` say the status line is pinned
with them. An arm runs one `--print` prompt, before any request is recorded, so the line is not said in
one: true by the construction of the one-turn arm, not by a guard, and not observed.

**Delegated calls.** Three design questions were the coordinator session's to decide, under the
maintainer's delegation of design questions of 2026-09-23, on the criterion of the better performance
enhancement. One pull request carries item 2 and the ruled part of item 5, departing from `0038`'s order
of one change per item, with items 1, 3 and 4 listed first: it stands because the ruled part of the
advisory needs no key and item 4 adds declaration on top of the general defaults, so the benefit lands
earlier with no rework. The status line is compiled by default: `0038` places it in the default report,
the note naming `settings.local.json` carries the override, and item 4 adds the declaration that turns it
off. `F` is the first request after the last compaction, stated as erring toward an earlier line.

**How it was checked.** 32 cases in [`cli/ledger.test.mjs`](../../cli/ledger.test.mjs) and 19 in
[`cli/advisory.test.mjs`](../../cli/advisory.test.mjs), every one over a temporary directory or the
committed fixture, and one new case in `compile.test.mjs` with the no-shell case widened to the two new
commands. Among them: every fixture transcript folded in two pieces, cut at every line, gives what one
read gives, and a transcript appended to in cuts that fall inside lines, inside characters and across
reads keeps what one read gives. The fixture's known totals are summed by
[`generate-ledger.mjs`](../../cli/fixtures/generate-ledger.mjs) from the requests it writes, never by the
ledger, which reproduced all twenty on its first run; a case regenerates the fixture and compares it byte
for byte. A named `--projects` or `--config` that is not a directory or a file is exit 2, never "0
transcripts". The drill fired,
`exit 1 · said "does not reproduce"`. Run once over this session's own records, numbers only, the ledger
put this session at 288,127 tokens against a threshold of 160,958 at the general multipliers: the session
building the advisory was past the threshold it computes, and carried on to finish the step, as the line
itself says to.

**Checkpoints.** Skipped by his instruction of 2026-09-23 12:38: no fresh-context runs unless he asks. The
coordinator session reviewed the diff before the first commit; his review is on the pull request.

**Green in this container needs a non-root run.** As root, `tests` fails its permission cases, because a
chmod-000 fixture never denies root. All 29 recipes ran green as a non-root user on a copy of this tree.

**Next action.** His review of the pull request. Then `0038`'s next items: `context.md`'s second part,
`doctor`'s spend report, and the manifest keys with `init`'s offer, after which the advisory prints the
declared multipliers instead of `undeclared`.
