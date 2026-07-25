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
   - *Homepage URL:* required. Use `https://sleepypanda.ro` — **not** the repository URL, which is
     private until milestone 3 and would 404 for anyone who saw it.
   - *Description:* shown on the App's page and in the install prompt, and public once the repository is.
     Draft to paste:

     > **What it does.** Posts pull-request comments and review replies on behalf of coding agents working
     > on Portulan, so that agent-authored conversation is attributable to an agent rather than to a
     > person's account.
     >
     > **Why it exists.** A review reply written by an agent and posted with a human's credentials reads as
     > human, and nothing in the record reveals otherwise. Portulan is an operating framework for agentic
     > engineering, and its doctrine refuses records that fabricate a participant — so it applies that rule
     > to its own repository first.
     >
     > **What it cannot do.** Pull-request conversation only: it has no access to repository contents,
     > cannot merge, and cannot change settings. Commits keep their human author's identity, because
     > authorship there records a decision a person actually took.
   - **Uncheck "Active" under Webhook.** There is no webhook receiver, and leaving it on produces
     delivery failures forever.
   - *Repository permissions:* **Pull requests → Read and write**, and nothing else. That covers comments,
     review replies, and resolving threads. Leave Contents at "No access" — the agent reads the repository
     through the maintainer's own credentials, and this token is deliberately not able to write code.
   - *Where can this App be installed:* **Only on this account.**
2. **Note the App ID** from the App's settings page.
3. **Generate the private key — this is a click, not a command.** On the App's settings page, scroll to
   **Private keys** → *Generate a private key*. A `.pem` lands in `~/Downloads`. Nothing below works until
   this file exists.
4. **Move the key out of the way**, alongside the other material that never enters git. The download is
   named `<app-slug>.<date>.private-key.pem`, so the glob deliberately does **not** assume the App's name:

   ```
   mv ~/Downloads/*.private-key.pem "$HOME/Sleepy Panda Projects/portulan-private/portulan-agent.pem"
   chmod 600 "$HOME/Sleepy Panda Projects/portulan-private/portulan-agent.pem"
   ```

   `zsh: no matches found` here means step 3 has not happened yet — the key was never generated — rather
   than anything being wrong with the path. If the glob matches more than one file you have keys from
   earlier attempts; move the newest by hand and delete the rest from the App's settings page.

   `*.pem` is git-ignored as a second line of defence, but the file belongs outside the working copy
   regardless: an ignore rule protects against `git add`, not against a future change to the ignore rule.
5. **Install the App** on `sleepy-panda-works` → *Only select repositories* → `portulan`.
6. **Export the configuration** from your shell profile:

   Find the App's numeric id — from the App's settings page, or by asking GitHub:

   ```
   gh api /orgs/sleepy-panda-works/installations \
     --jq '.installations[] | select(.app_slug=="portulan-agent") | .app_id'
   ```

   Then append the two lines to your profile, substituting that number:

   ```
   echo 'export PORTULAN_BOT_APP_ID=1234567' >> ~/.zshrc
   echo 'export PORTULAN_BOT_PRIVATE_KEY="$HOME/Sleepy Panda Projects/portulan-private/portulan-agent.pem"' >> ~/.zshrc
   source ~/.zshrc
   ```

   **Never write a placeholder as `<…>` inside a shell block.** `<` is a redirection operator, so pasting
   one is not a harmless no-op — it is a parse error, and an earlier draft of this runbook shipped exactly
   that. The repository already learned this once from the other direction, when `<…>` placeholders in the
   templates were changed to `{…}` because GitHub's Markdown renderer silently dropped them. Two different
   surfaces, one rule: a placeholder must be inert wherever it might be pasted.

   **Put these in the profile file itself (`~/.zshrc`), not just in a running shell.** An agent's shell is
   initialised from your profile but does not inherit exports typed into an interactive session, so a
   variable that exists only at your prompt is invisible to the thing that needs it — and the failure
   looks like a misconfiguration rather than a missing export.

7. **Confirm it works** — this prints the repositories the installation can see, and nothing else:

   ```
   ./.portulan/tools/gh-bot api /installation/repositories --jq '.repositories[].full_name'
   ```

   Expect `sleepy-panda-works/portulan`. Note `gh api user` will *not* work: an installation token has no
   user, which is the point.

**Where am I?** The steps are click-heavy and easy to half-finish, so each has a way to check itself
without guessing:

| Question | Command |
|---|---|
| Does the App exist and is it installed? | `gh api /orgs/sleepy-panda-works/installations --jq '.installations[].app_slug'` |
| Did the key download? | `ls ~/Downloads/*.private-key.pem` |
| Is the key in place? | `ls -l "$PORTULAN_BOT_PRIVATE_KEY"` |
| Is the shell configured? | `echo "$PORTULAN_BOT_APP_ID"` |
| Does the whole path work? | step 7 above |

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
- ~~**The end-to-end path is unverified until the App exists.**~~ **Verified 2026-07-25.** The App is
  installed on `sleepy-panda-works/portulan` only, with `pull_requests: write` and `metadata: read`; a
  token minted through this path listed exactly that one repository, was **refused** repository contents,
  and posted the first `portulan-agent[bot]` comment. The contents refusal is the load-bearing one: it is
  what makes "the permission set is the enforcement, not the wrapper" a fact rather than an intention.
