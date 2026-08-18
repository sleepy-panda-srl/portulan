# Security policy

## Supported versions

Portulan is pre-release. Only the latest published version receives fixes; there are no maintained
release branches, and a `0.x` minor bump may carry a breaking change.

| Version | Supported |
|---|---|
| `0.1.1` | Yes — the current release |
| Anything earlier | No |

## Reporting a vulnerability

**Please do not report a security issue in a GitHub issue.** An issue is a permanent record that
everyone with access to this repository reads, and who that is depends on a setting this file does not
control.

Use the first of these that is available to you:

1. **The Security tab → _Report a vulnerability_.** This is the preferred channel and reaches the
   maintainer with no public record. The tab is the authority on whether it exists, because it reflects
   the live repository setting rather than this file's memory of it.
2. **Email the maintainer.** If that button is absent, private vulnerability reporting is switched off.
   Try the maintainer's GitHub profile, then the author address in this repository's commit history —
   either may be absent or a `noreply` alias, because GitHub lets both be masked.
3. **Ask for a channel, in public, without the details.** If neither of the above yields a reachable
   address, open an issue saying only that you have a security report and need a private channel. The
   report itself never goes in the issue.

## What to expect

There is one maintainer and no on-call rotation, so this states what is actually offered rather than a
response time nobody is staffed to meet: reports are acknowledged when the maintainer next reads them,
and you will be told whether the issue is accepted, and when a fix ships. If you would like credit in
the release notes, say so — the default is to credit you by the name you report under.

## Scope

In scope: the engine, the Workspace Definition, the CLI in [`cli/`](cli/), the compiled enforcement in
[`.claude/settings.json`](.claude/settings.json), and the plugin manifests.

Two properties are worth naming because they are the ones a reader is most likely to over-read:

- **A verify recipe's `run` is arbitrary shell.** A workspace that composes a pack has consented to
  that pack's code. The boundary is the feed pin — a pack resolves at a pinned version whose files hash
  to the commit it claims — and not confidence in the pack's author. This is stated in
  [`docs/plan.md`](docs/plan.md) as a limit rather than sold as a sandbox.
- **The compiled enforcement is a host's permission table, not a sandbox.** It is generated from
  [`.portulan/gates.json`](.portulan/gates.json) and committed so it stays reviewable. Enforcement that
  matters lives in the artifact that performs the action.

Out of scope: the fictional workspace in [`examples/`](examples/), which is demo content and is not run
anywhere; and findings that require an attacker to already have write access to your own workspace
files.
