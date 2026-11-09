# Recipe execution and cleanup

`finish` and the Stop-gate share `recipe-runner.mjs`. Finish allows ten minutes.
Stop allows ninety seconds unless its trusted workspace declares
`verify.stopTimeout` in seconds at spec 2.14 or later. Recompile after declaring it:
the compiled Stop hook allows that deadline plus sixty seconds for other checks
and cleanup. An invalid declaration prevents execution. Output is drained as it arrives; only the last
64 KiB and at most one incoming chunk are retained.

Stop reads both command and deadline from the hook-told workspace and runs in the
hook-told root. The payload's session worktree selects its record/work checks,
and cannot choose executable policy. Verification of that other worktree remains
the separate #311 trust question; a green here covers the told tree.

After three actual recipe refusals in a session, further Stops skip that recipe
and release explicitly unverified/RED. Repairing files then does not resume
automatic verification in that session: run it explicitly before claiming done,
or use a new session. A still-pending handoff at its cap, nine total refusals, or
the thirteenth consecutive hook-provoked Stop also suppresses recipe execution.
Skipped runs never charge a recipe failure or become green evidence. A handoff
that clears before the other bounds allows execution again; ordinary Stops reset
the chain, and a measured green before the recipe cap clears its streak.

The deadline tests inject a long selection and exercise a short live timeout;
they demonstrate configuration and cleanup, not a real five-minute recipe or a
live host's outer-timeout enforcement. Counter-file failure/concurrent-write
limits remain; this is not a cross-session scheduler or a cache of green trees.

On POSIX, Bash starts in a detached process group. A timeout sends TERM to the group;
SIGINT, SIGTERM and SIGHUP received by the active runner are forwarded to it. After
250 ms the runner sends KILL to that group, even if Bash has already exited or closed
its pipes. Repeated interruptions do not restart that grace period. Cleanup allows
one further second for closure and reports failures as could-not-run. Finish retains
an observed interruption, stops its recipe loop, rolls back its provisional commit
and pushes nothing.

On Windows, the runner checks an absolute system `taskkill.exe` path before starting
Bash. Cleanup invokes `/PID <owned pid> /T /F` with a one-second command timeout;
this is forced tree termination rather than POSIX signal forwarding. Missing tools
and termination errors produce could-not-run diagnostics. Command construction and
error paths have unit controls here; native Windows execution has not been tested.

A normally exiting recipe keeps the existing behavior: inherited pipes are drained
for at most one second, and background processes can continue. Descendants that
intentionally escape the POSIX group are outside its cleanup. OS signal denial,
runner SIGKILL and failures outside active recipe execution cannot promise cleanup
or commit rollback. This runner does not impose a deadline on finish's other Git
operations.

`recipe-set --agent` wraps each command in `recipe-output.mjs`. That executor
spools stdout and stderr separately to private descriptors, unlinks their names
before starting the child, and replays all bytes on failure. Green is one counted
line. The runner's ordinary tail remains bounded; the executor's failure stream
is complete at its own boundary. Output capture, replay or setup failures return
could-not-run, never green.

The runner marks the environment of its owned child. A nested executor shares
that process group and delegates its deadline to the outer runner. On POSIX it
checks its actual group with `ps` before inheriting ownership, so the outer
timeout or interruption reaches every descendant even if the executor is killed.
An inner capture failure also terminates that owned group. Anonymous descriptors
leave no named temporary logs behind on a hard kill. Standalone executors own
their own recipe group and a ten-minute deadline. Native Windows execution of
this output mode remains untested, as does its forced-termination filesystem
behavior; inability to create anonymous spools refuses execution.

The platform mechanisms follow [Node's detached-process documentation](https://nodejs.org/api/child_process.html#optionsdetached)
and [Microsoft's taskkill reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill).
