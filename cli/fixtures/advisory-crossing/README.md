# First crossing and host visibility

`capture.json` records two actual Claude Code **2.1.321** sessions on 2026-11-11
using scripted synthetic responses from a loopback backend. It contains only
response IDs, context counts, hook-visible completed IDs and production advisory
output. The host ran the real Read tool and the configured prompt/tool/Stop
commands. Each session had four responses and three Read calls. The below control
used contexts 1,000 / 1,500 / 1,500 / 1,500; the crossing control changed only
request 2 to 1,700. With horizon 20 and resume 0, threshold was 1,625.

The crossing control reported request 2 once with its tool result. The below
control and both final Stops emitted nothing. Completed response IDs and the
actual hook-visible IDs correlate each hook with the backend response sequence:
**zero completed-request lag was observed**. This is a lifecycle measurement for
this host and these controlled responses, not provider usage evidence or a
universal transcript timing bound. `advisory-crossing.test.mjs` separately forces
delayed multi-request batches, including a crossing followed by negative savings.

`capture.mjs` is a **manual acquisition tool**, never called by recipes or tests.
It uses a fresh configuration directory, isolated working directory and state,
an explicit synthetic API key, an empty MCP configuration and a sandbox denying
outbound connections except its exact loopback port. Each run must pass positive
loopback and negative external-address connection probes before starting Claude.
It does not use an existing sign-in or a provider endpoint. Run it explicitly with
a new private output directory; raw host configuration/transcripts stay there.
Only the numeric `capture.json` is public. Its source SHA-256 values identify the
acquisition code and production modules at capture time; they are provenance,
not a claim that future source revisions have the same whole-file hashes.

Acquisition development included a successful paired trace before advisory text
was shortened to fit the existing hook footprint rail. The shipped paired trace
was then acquired with the final formatter; neither run used generated model
answers. Two preliminary guard probes corrected the sandbox's required
`localhost:port` syntax before any host acquisition.

`node cli/fixtures/advisory-crossing/verify.mjs` replays the public trace against
the production advisory without launching Claude or opening a socket. The ledger
recipe runs it; the tests recipe also mutates usage, visibility, output and the
network-guard receipt to demonstrate rejection. A data receipt cannot independently
prove its own acquisition: the fresh checkpoint checks the raw local originals,
source hashes and acquisition mechanism.
