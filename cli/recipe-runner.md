# Recipe execution and cleanup

`finish` and the Stop-gate share `recipe-runner.mjs`. Their limits remain ten minutes
and ninety seconds respectively. Output is drained as it arrives; only the last
64 KiB and at most one incoming chunk are retained.

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

The platform mechanisms follow [Node's detached-process documentation](https://nodejs.org/api/child_process.html#optionsdetached)
and [Microsoft's taskkill reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill).
