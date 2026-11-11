# Ritual admission evidence

The manual acquisition uses actual Claude Code **2.1.321** on 2026-11-11 with a
synthetic loopback backend. No real provider, sign-in or generated answer is used.
It compiles a synthetic ritual pack to project settings, with no cap in the
process environment. The native Agent tool launches real child contexts; their
scripted backend responses are held to observe overlap. Native tool results
identify successful launches and concurrency refusals. Background completion
notifications add parent requests; requested calls alone do not count as launches.

| Project setting | Observed peak child requests | Native refusals | Actual children |
|---|---:|---:|---:|
| Compiled cap 1 | 1 | 1 | 2, sequential replacement |
| Compiled cap 2 | 2 | 0 | 2 |
| Compiled cap 1 entry removed | 2 | 0 | 2 |
| Compiled cap 2 changed to 1 | 1 | 1 | 2, sequential replacement |

The production ledger reads each run's isolated host transcripts and records one
parent plus two child contexts, six requests under cap 1 and five otherwise.
This demonstrates ordinary fresh-Agent admission on this installed host, **not**
a lifetime context budget or universal maximum: resumes/forks, workflow/team
systems, higher-precedence settings and experimental/ultracode paths qualify the
[native contract](https://code.claude.com/docs/en/sub-agents#concurrent-subagent-limit).
The cap 1 control deliberately exceeds one child over the session's lifetime.

`capture.mjs` is manual and excluded from recipes. It uses a fresh
`CLAUDE_CONFIG_DIR`, an isolated `/private/tmp` working directory outside the
repository, a fake API key, explicit tools, empty strict MCP configuration and an
environment allowlist. A sandbox denies outbound network except its exact
loopback port; positive loopback and negative external probes must pass before
each host run. Raw host/backend records stay in a new private acquisition
directory. Only closed event labels, numbers, source hashes and guard receipts
enter `capture.json`. The source hashes identify acquisition-time code; they do
not require future whole-file bytes to remain frozen.

Development first exposed background Agent notifications and trailing system
environment messages. Request classification and completion handling were then
corrected before the successful four-control run. The final capture uses the
finished compiler. There was no provider sampling.

`verify.mjs` checks the public receipt offline and replays its numeric context
shape through production ledger tallying. Tests mutate settings, overlap, native
admission counts, guards and ledger totals. These checks reject inconsistent
receipts; they do not independently prove acquisition. The fresh checkpoint
checks raw originals and source provenance without copying private text.
