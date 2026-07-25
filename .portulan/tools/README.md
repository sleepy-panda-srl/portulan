# `.portulan/tools/` — operator tooling for this repository

> Small scripts for *operating* this repository, as distinct from [`../verify/`](../verify/), which
> decides whether a change is done. Nothing here is part of the Portulan product; it is how customer zero
> is run. It lives in the workspace because a future session needs it and would otherwise have to
> rediscover it.
>
> Not a slot. The Workspace Definition indexes the policy layer's named parts, and a directory of operator
> scripts is not one of them — a schema that grew a slot for this would be inventing structure for one
> repository's convenience, which [`../../spec/slots.md`](../../spec/slots.md) exists to refuse.

| Script | What it does |
|---|---|
| [`gh-bot-token.mjs`](gh-bot-token.mjs) | Mints a short-lived GitHub App installation token and prints it |
| [`gh-bot`](gh-bot) | Runs a `gh` command as the agent identity rather than as the maintainer |

## Why the agent needs its own identity

An agent replying to review threads through the maintainer's credentials makes the conversation read as
human when it is not. On a repository whose doctrine turns on honest records and on refusing fabricated
contemporaneity, that is a provenance defect — and an invisible one, because nothing in the artifact
reveals it. A GitHub App posts as `<app-name>[bot]`, which is unambiguous without anyone having to trust
a convention. The rule and its incident are in
[`../memory/agent-activity-is-attributable.md`](../memory/agent-activity-is-attributable.md); which
identity may take which action is in [`../gate-map.md`](../gate-map.md).

## Setup — the maintainer's steps

**These are not steps an agent can take.** Creating accounts and handling credentials is outside what an
agent does here, and this section is written to be followed by a human once.

1. **Create the App.** `github.com/organizations/sleepy-panda-works/settings/apps` → **New GitHub App**.
   - *Name:* `portulan-agent` — it must be globally unique on GitHub, so expect to need a suffix. Whatever
     it becomes is what appears on every comment, so pick something that reads as a bot at a glance.
   - *Homepage URL:* anything valid; `https://sleepypanda.ro` will do.
   - **Uncheck "Active" under Webhook.** There is no webhook receiver, and leaving it on produces
     delivery failures forever.
   - *Repository permissions:* **Pull requests → Read and write**, and nothing else. That covers comments,
     review replies, and resolving threads. Leave Contents at "No access" — the agent reads the repository
     through the maintainer's own credentials, and this token is deliberately not able to write code.
   - *Where can this App be installed:* **Only on this account.**
2. **Note the App ID** from the App's settings page.
3. **Generate a private key** — same page, "Private keys" → *Generate a private key*. A `.pem` downloads.
   **Move it outside this repository**, alongside the other material that never enters git:

   ```
   mv ~/Downloads/portulan-agent.*.private-key.pem "$HOME/Sleepy Panda Projects/portulan-private/portulan-agent.pem"
   chmod 600 "$HOME/Sleepy Panda Projects/portulan-private/portulan-agent.pem"
   ```

   `*.pem` is git-ignored as a second line of defence, but the file belongs outside the working copy
   regardless: an ignore rule protects against `git add`, not against a future change to the ignore rule.
4. **Install the App** on `sleepy-panda-works` → *Only select repositories* → `portulan`.
5. **Export the configuration** from your shell profile:

   ```
   export PORTULAN_BOT_APP_ID=<the App ID>
   export PORTULAN_BOT_PRIVATE_KEY="$HOME/Sleepy Panda Projects/portulan-private/portulan-agent.pem"
   ```

6. **Confirm it works** — this prints the repositories the installation can see, and nothing else:

   ```
   ./.portulan/tools/gh-bot api /installation/repositories --jq '.repositories[].full_name'
   ```

   Expect `sleepy-panda-works/portulan`. Note `gh api user` will *not* work: an installation token has no
   user, which is the point.

## How the agent uses it

Only for pull-request conversation:

```
./.portulan/tools/gh-bot api repos/sleepy-panda-works/portulan/issues/8/comments -f body='…'
```

The wrapper mints a token, passes it to `gh` through the environment for that one command, and never
writes it anywhere. **Do not `export GH_TOKEN` instead** — an exported credential outlives the command and
silently re-attributes everything typed afterwards, which is the failure this mechanism exists to prevent.

## Honest limits

- **This does not make the agent's *commits* attributable, and must not.** Commits stay under the
  maintainer's git identity because the build's provenance discipline requires his authorship on the
  commit record. The App's permissions cannot write code at all, which is the enforcement rather than the
  intention. See [`../gate-map.md`](../gate-map.md).
- **The token is short-lived but real.** An installation token lasts an hour and can comment as the bot
  for that hour. It is minted per command and never stored, which is the mitigation; there is no way to
  make a credential harmless.
- **"Conversation and nothing else" is very slightly generous to itself.** Pull-requests write also lets
  the App *submit a review* — including an approving one. That is inert here because the required approving
  review count is zero, and it becomes load-bearing the moment a second reviewer exists and that count
  rises. Worth knowing before it does.
- **Nothing enforces that the agent uses this instead of the maintainer's `gh`.** The wrapper refuses a
  few obviously-wrong subcommands as a guard against habit, but an agent with shell access can bypass it
  trivially. The real enforcement is the App's permission set: that token cannot push, cannot merge, and
  cannot change settings, so the worst case is a comment in the wrong voice rather than a change in the
  wrong hands.
- **The end-to-end path is unverified until the App exists.** Signing, configuration errors, and GitHub's
  refusal responses are all exercised; minting a real token against a real installation is not, because
  that needed credentials that were correctly not available while this was written.
