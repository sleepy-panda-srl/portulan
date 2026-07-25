# Handoff — the agent gets its own GitHub identity

**State.** Tooling, rule, and runbook are in; **the identity itself does not exist yet and cannot be
created by an agent.** [`../tools/`](../tools/) holds a token minter and a `gh` wrapper; the rule is
[`../memory/agent-activity-is-attributable.md`](../memory/agent-activity-is-attributable.md); the gate map
now says which identity takes which action. What remains is the maintainer creating a GitHub App,
installing it, and exporting two environment variables — the runbook is
[`../tools/README.md`](../tools/README.md).

**Decisions + why.**

- **A GitHub App, not a machine user.** An App posts as `<name>[bot]`, the same unambiguous suffix
  `copilot-pull-request-reviewer[bot]` already carries on these pull requests, so the record reads
  correctly with no convention for anyone to trust. A second human-shaped account would have been simpler
  to wire and would have left attribution resting on whether the account name looked bot-ish — which is
  the class of rule this workspace keeps replacing with rails. The App also brings short-lived tokens and
  a permission set narrow enough to be the actual enforcement.
- **The token can write pull-request conversation and nothing else.** Not Contents, not merges, not
  settings. The wrapper's refusal of a few `gh` subcommands is a guard against habit and is bypassable in
  one line; the permission set is what holds. Worst case is therefore a comment in the wrong voice, never
  a change in the wrong hands.
- **Commits stay the maintainer's, deliberately, and that is not an inconsistency.** It looks like one
  until stated plainly: attribution is not one principle applied uniformly, it is *who actually did this*.
  He owns the commit record — the build's provenance discipline depends on it — and he did not write the
  review replies. The gate map now carries that asymmetry in a table rather than leaving it to be
  inferred.
- **Zero dependencies in the credential path.** `node:crypto` signs the JWT, global `fetch` exchanges it.
  A JWT library would be a supply-chain dependency in the one place that handles a private key, which is
  the last place it belongs.
- **The tools directory is not a slot.** The Workspace Definition indexes the policy layer's named parts;
  operator scripts are not one. Adding a slot for one repository's convenience is exactly the invention
  [`../../spec/slots.md`](../../spec/slots.md) exists to refuse, so `tools/` is simply a directory the
  workspace README documents.

**Verification, run rather than asserted.** Everything that does not need real credentials was exercised:

| Path | Result |
|---|---|
| no `PORTULAN_BOT_APP_ID` / no key path | exit `2`, names the missing variable |
| key path does not exist | exit `2`, `ENOENT` |
| file that is not a PEM | exit `2` — *could not run*, never *refused* |
| RS256 signing, against a throwaway key | signature verifies; `iat` backdated 60s; ttl 540s (GitHub's max is 600) |
| real API call with a nonexistent App | exit `1`, GitHub's `404 Integration not found` surfaced |

The throwaway key was generated in a scratch directory and deleted; no real credential was involved at any
point. That last row corrected the code: a bogus App id returns **404**, not 401, so the 401 hint would
have sent a reader looking at their clock instead of their App id. Both hints now name both causes.

**Open questions.**

1. **The App does not exist — steps 1–5 of [`../tools/README.md`](../tools/README.md) are the
   maintainer's.** Nothing here works until then, and until then replies keep going out under his name
   with a signature line, which is a convention rather than a rail.
2. ~~**The end-to-end path is unverified.**~~ **Closed the same day.** The App was created and installed,
   and the whole path ran: token minted, installation scope confirmed as this repository alone, repository
   contents **refused**, and the first `portulan-agent[bot]` comment posted on the pull request carrying
   this change. Two runbook defects surfaced by a human following it rather than by review — a `<…>`
   placeholder inside a shell block, where `<` is a redirect and the paste is a parse error; and a glob
   assuming the App slug, in a runbook that warns the name may need a suffix. Both fixed.
3. **Nothing enforces that an agent reaches for the wrapper.** An agent with shell access can call `gh`
   directly and post as the maintainer. The App's permissions bound the damage but not the
   misattribution. A pre-commit-style hook is not obviously the answer, since the failure is on GitHub
   rather than in the tree.

**Next action.** Done — the App exists, is installed, and has posted. What remains is habit: agents
reach for [`../tools/gh-bot`](../tools/gh-bot) for anything a human will read as prose, and open question 3
stays open because nothing enforces that.

**Recoverability.** Three new files under [`../tools/`](../tools/), one new memory entry, one `.gitignore`
addition, and edits to three existing documents — the gate map, the workspace README, and the plan's
session log. Nothing outward was taken, no credential exists yet, and no repository setting changed.
Reverting removes tooling nothing depends on and restores three documents to describing an arrangement
that had not been decided.
