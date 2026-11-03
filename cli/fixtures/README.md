# `doctor` fixtures

Material for [`../doctor.test.mjs`](../doctor.test.mjs), and since proposal `0038` for
[`../ledger.mjs`](../ledger.mjs), which `doctor` is to reach. The task that produced `doctor` calls the
known-bad manifest **not optional**, and says why: *a validator that goes green on first contact with
a manifest written to satisfy it has demonstrated nothing.* So the first thing here is a family of
manifests that must fail, each isolating one violation, plus one that must pass — because a suite in
which everything fails is not a check either.

## Two shapes these files must hold, and neither is a style choice

The fixtures live inside a repository whose own verify recipes scan every tracked file, so a careless
fixture does not merely test badly — it turns CI red for reasons unrelated to any change under test.

1. **A known-bad manifest is well-formed JSON that violates the schema.**
   [`../../.portulan/verify/json.sh`](../../.portulan/verify/json.sh) parses every tracked `.json`
   file, so a fixture that does not *parse* would make the `parse` check permanently red. Bad against
   the schema, never bad against the parser. The one case that genuinely needs unparseable JSON is
   written to a temp directory at run time instead.
2. **Fixture Markdown carries no relative links.**
   [`../../.portulan/verify/docs.sh`](../../.portulan/verify/docs.sh) resolves every relative link in
   every tracked `.md`, and a fixture describing a repository that does not exist would fail it. Paths
   inside fixture Markdown are written as code spans — which is convenient as well as necessary, since
   an unchecked code span is exactly what the claims lint exists to check.

## What is here

| Path | What it is for |
|---|---|
| [`manifests/`](manifests/) | One manifest per schema violation, plus `valid.json`. Every file parses; every file but `valid.json` must produce at least one error naming the constraint and its location. |
| [`drifted-workspace/`](drifted-workspace/) | A whole workspace whose repo card claims a path its tree does not contain — the red path of the claims lint, which neither real workspace exercises, since customer zero passes it and the demo declares no `tree`. |
| [`consumer/`](consumer/) | An invented team's project instruction file, `instructions.md`, for a public library's catalogue service, kept under a name no host loads: [`../instructions.test.mjs`](../instructions.test.mjs) copies it into a repository the real `init` drafts as `CLAUDE.md`, marks three of its sections, moves them to on-read units with the command line, holds the bytes before and after, and joins them back byte for byte. Its domain is chosen to resemble no adopter's. |
| [`guidance/`](guidance/) | A workspace declaring one guidance unit in each load tier, and no gate policy — the source [`../compile.test.mjs`](../compile.test.mjs) compiles into Claude Code's rules and skill, and the on-path target of milestone 12's second demonstration: copy it out, run `compile --workspace` on the copy, open a host there, and touch `api/`. Nothing compiled is committed here, so no copy of its output can go stale. |
| [`personas/`](personas/) | A workspace in `workspace/` whose tree is the directory above it, composing `tools/local-llm` from this repository's `packs/` and binding its `local-worker` persona by hand in `agents/`. [`../compile.test.mjs`](../compile.test.mjs) compiles a copy and byte-compares the binding with `golden/local-worker.md`, the persona's declared fields written into it and nothing else of it changed. |
| [`ledger/`](ledger/) | Synthetic host usage records for [`../ledger.mjs`](../ledger.mjs), in the shape Claude Code 2.1.280 writes them, and `fixture.json` carrying the totals they are known to sum to, which [`generate-ledger.mjs`](generate-ledger.mjs) sums from the requests it writes rather than the ledger. Among them: requests written once per content block, a request copied into a second transcript, a torn line, a record the host writes with no request behind it, a compaction, each rebuild cause, subagents in their own files at two depths and one written inline, a worktree inside the repository and one outside it, a sibling directory whose key shares the repository's prefix, and a project that must never be opened. Paths, ids and models are invented; no line of any real session is here. |
| [`ledger-hybrid/`](ledger-hybrid/) | One hybrid session for [`../ledger.mjs`](../ledger.mjs), in the shape Claude Code 2.1.317 writes it: host requests whose Bash calls ran the local runner, its receipt lines among their tool results, and a local-worker subagent that ran it too and reported the receipt back. Among them: a receipt the server reported no figure for, lines one edit from a receipt, and a receipt quoted by a prompt, by an assistant's text, by the subagent's report and by a result answering no call, none of which counts. `fixture.json` carries the known totals, local receipts included, and the host's restart threshold. |
| [`generate-ledger-hybrid.mjs`](generate-ledger-hybrid.mjs) | Writes `ledger-hybrid/`, summing its known totals from the records and receipts it writes; [`../ledger.test.mjs`](../ledger.test.mjs) holds it to the committed fixture byte for byte, as it does `generate-ledger.mjs`. |
| [`generate-ledger.mjs`](generate-ledger.mjs) | Writes `ledger/`, records and known totals together; [`../ledger.test.mjs`](../ledger.test.mjs) runs it into a temporary directory and compares the result with the committed fixture byte for byte, so the totals are the generator's and no hand's. |
| [`local-worker/`](local-worker/) | A synthetic A/B capture of the `tools/local-llm` runner's two arms for [`../pack-local-llm.test.mjs`](../pack-local-llm.test.mjs): `local-worker.json`, thirty scripted turns over `code`, `codify` and `handoff` with a pass, a fail, a host exit and a host timeout among them, and `local-worker.md`, the register the runner renders from it, on which `eval --verify` is green and every forced drift red. The models, host, commit and machine are named as a fixture's, every output says no model wrote it, and the register opens with a synthetic-fixture banner. Its predicates fingerprint is all zeros, so a predicate file's edit moves no byte here unless a verdict moves, which `--verify`'s regrading reds. |
| [`generate-local-worker.mjs`](generate-local-worker.mjs) | Writes `local-worker/` by running the runner's own capture over a fake local model and a fake host that answer from a fixed plan; the suite regenerates it into a temporary directory and compares it with the committed fixture byte for byte. |

Cases that need a broken filesystem rather than a broken document — a slot pointing nowhere, a
directory slot pointing at a file, a workspace escaping its own directory — are built in temp
directories inside the test. They are not committed because a fixture is only worth committing when
its *content* is the interesting part.
