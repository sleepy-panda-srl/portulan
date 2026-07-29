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
| [`portulan-agent-logo.svg`](portulan-agent-logo.svg) | The App's avatar, in source form |

The avatar is a **portolan wind rose**: the rhumb-line network radiating from a compass rose is the one
feature that makes a portolan chart recognisable at a glance, which is the same reason the product carries
the name. Thirty-two rhumbs, an eight-point rose with faceted points, and the north point marked in
vermilion — as it is on the charts themselves, where north is the one direction worth colouring
differently. Kept as SVG rather than only a PNG so it can be re-rendered at any size and edited without a
design tool; export a 1000×1000 PNG to upload, since GitHub does not accept SVG avatars. It is drawn to
survive the crop and the scale that actually matter: a circle, at roughly forty pixels, next to a comment.

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
     private until 2026-07-27 and would have 404'd for anyone who saw it before the flip.
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
   - *Repository permissions:* **Pull requests → Read and write** and **Contents → Read-only**, and
     nothing else. *(The App as installed today holds pull-requests write and no contents at all; the
     Contents line is what step 1 of the librarian setup below applies.)* Pull-requests write covers comments and review replies. It does **not** cover
     resolving a review thread: GitHub refuses `resolveReviewThread` to any App with `Resource not
     accessible by integration`, so resolving stays the maintainer's — see
     [`../gate-map.md`](../gate-map.md). **Contents read-only** is the one permission this App has
     ever been given beyond its original two, ruled on 2026-07-28; it exists so the scheduled librarian
     can *open* a pull request, which GitHub refuses without it. Contents **write** stays out, and that is the line that
     matters: this token still cannot push a commit, which is what makes "the permission set is the
     enforcement" true. [`../proposals/0015-the-librarian-files-as-the-agent.md`](../proposals/0015-the-librarian-files-as-the-agent.md)
     carries the decision and its cost.
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
   echo 'export PORTULAN_BOT_APP_ID=1234567' >> ~/.zshenv
   echo 'export PORTULAN_BOT_PRIVATE_KEY="$HOME/Sleepy Panda Projects/portulan-private/portulan-agent.pem"' >> ~/.zshenv
   ```

   **`~/.zshenv`, not `~/.zshrc` — and the difference is the whole point.** An agent's shell is
   *non-interactive*, and zsh reads `~/.zshrc` only for interactive shells. Configuration placed there
   works perfectly at your own prompt and is invisible to the thing that actually needs it, which is the
   worst shape a misconfiguration can take: it looks correct everywhere you would think to check. `~/.zshenv`
   is read by *every* zsh, which is exactly why it is the right file here — and why it should stay small
   and fast, since everything in it runs on every shell start.

   Verified rather than assumed, because an earlier version of this runbook said `~/.zshrc` for precisely
   this purpose and did not achieve it:

   ```
   zsh -c  'echo $PORTULAN_BOT_APP_ID'   # non-interactive — what an agent gets
   zsh -ic 'echo $PORTULAN_BOT_APP_ID'   # interactive — what you get
   ```

   Both must print the id. If only the second does, the lines are in the wrong file. _(On bash the split
   differs again — non-interactive bash reads neither `~/.bashrc` nor `~/.bash_profile` unless `BASH_ENV`
   points at a file — so the rule to carry away is not a filename but a question: does a **non-interactive**
   shell see this?)_

   **Never write a placeholder as `<…>` inside a shell block.** `<` is a redirection operator, so pasting
   one is not a harmless no-op — it is a parse error, and an earlier draft of this runbook shipped exactly
   that. The repository already learned this once from the other direction, when `<…>` placeholders in the
   templates were changed to `{…}` because GitHub's Markdown renderer silently dropped them. Two different
   surfaces, one rule: a placeholder must be inert wherever it might be pasted.


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

### Setup for the scheduled librarian — two secrets, added 2026-07-28

**Also not steps an agent can take**, and for the stronger of the two reasons: handling a credential is
outside what an agent does here, and changing repository settings is Gated regardless. The scheduled
pass in [`../../.github/workflows/librarian.yml`](../../.github/workflows/librarian.yml) mints its own
installation token through `gh-bot-token.mjs`, which needs the same two values your shell already has —
this time as repository secrets, because a workflow has no `~/.zshenv`.

1. **Widen the App to `contents: read`** on the App's settings page, per
   [`../proposals/0015-the-librarian-files-as-the-agent.md`](../proposals/0015-the-librarian-files-as-the-agent.md).
   GitHub then asks the installation to accept the new permission — until you accept it on the
   *installed* App, the setting on the App page is a request rather than a grant, and a token minted
   in between still gets the 422. Read it back with:

   ```
   gh api /orgs/sleepy-panda-works/installations --jq '.installations[] | select(.app_id==4390104) | .permissions'
   ```

2. **Add the two secrets**, from the values already in your environment, so nothing is retyped:

   ```
   gh secret set PORTULAN_BOT_APP_ID -R sleepy-panda-works/portulan --body "$PORTULAN_BOT_APP_ID"
   ```

   ```
   gh secret set PORTULAN_BOT_PRIVATE_KEY -R sleepy-panda-works/portulan < "$PORTULAN_BOT_PRIVATE_KEY"
   ```

   The second reads the `.pem` from the path your shell already exports, so the key is never pasted into
   a terminal and never lands in shell history. It still leaves the private key in GitHub's secret store
   as well as on your disk, which is a second copy of a credential and worth knowing rather than
   discovering: rotating it means regenerating the key on the App page and re-running both the `mv` in
   step 4 above and this command.

**Until both are done the workflow refuses to file anything.** It checks for the secrets and fails the
job with the reason, leaving its branch pushed and waiting, rather than opening a pull request with
`GITHUB_TOKEN` that could never merge.

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
- ~~**The App cannot open a pull request, only talk on one.**~~ **Superseded 2026-07-28** — the
  measurement stands, the reasoning did not. The measurement: creating a pull request requires
  repository-contents read, which this installation was refused, and GitHub answers `not all refs are
  readable` (HTTP 422). Measured 2026-07-26. What was written beside it was that granting contents
  "would give the token the ability to **write code**". It would not: `contents: read` is read, write is
  a separate permission, and the two were conflated in the sentence. It was also written while this
  repository was **private**; since 2026-07-27 it is public, so that scope grants the ability to read
  what any stranger can already read, and nothing re-read the sentence when the visibility changed.
  The widening is **ruled and not yet applied** — Marius accepted it on 2026-07-28, and changing an
  App's permissions and accepting them on the installation are his acts, not an agent's. Read the live
  set back at the supervised checkpoints rather than from this paragraph. Once applied, the App opens
  the scheduled librarian's pull request — see
  [`../proposals/0015-the-librarian-files-as-the-agent.md`](../proposals/0015-the-librarian-files-as-the-agent.md),
  which also prices what the widening does still cost: visibility is a live setting, and a repository
  made private again would turn this back into a real grant with nobody re-deriving it. **Write is still
  refused**, so the bullet above — the permission set cannot write code — is unchanged, and a pull
  request opened by a person or a session still goes under the maintainer's credentials with the
  attribution in the body. Recorded in [`../gate-map.md`](../gate-map.md).
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
- **`gh api` is allowlisted by endpoint, since 2026-07-28 — and the sentence above is why that is a
  guard rather than a fix.** `api` is the one subcommand that reaches everything GitHub has, so the
  subcommand refusals said nothing about it, and this wrapper is a spelling no rule in
  [`../gates.json`](../gates.json) can see: a shell gate compiles to `Bash(<prefix>:*)`, a literal
  prefix match against the command as typed. It grew against that file's `gh api` gate, which was
  removed on 2026-07-28 — so this allowlist is now **narrower than the policy**, refusing a ruleset
  read that plain `gh api` performs unattended. Deliberate: it bounds a token this repository mints,
  and narrower is the safe direction for that. Measured before deciding what to do about it — the
  installation holds `contents: read` (added 2026-07-29), `metadata: read` and `pull_requests: write`,
  and no `administration`, so:

  | Attempted through `gh-bot` | GitHub |
  |---|---|
  | `PATCH repos/{owner}/{repo}/rulesets/{id}` | `403 Resource not accessible by integration` |
  | `GET repos/{owner}/{repo}/branches/main/protection` | `403 Resource not accessible by integration` |
  | `GET repos/{owner}/{repo}/rulesets` | **`200`** — ruleset reads ride on `metadata` |

  The settings *change* was already refused by the platform, which is the floor working. The **read**
  was not, and that rule gates reads on purpose, so the wrapper now refuses any endpoint outside
  pull-request conversation *before* it mints a token — a refused call never creates a credential. Its
  limits, stated because a guard nobody knows the edges of gets trusted as a rail: `graphql` is admitted
  and carries arbitrary queries, and the whole check is bypassable by minting a token and calling `gh`
  directly. The rail is the permission set. [`../gate-map.md`](../gate-map.md) carries this as hole 6,
  and [`../../cli/gh-bot.test.mjs`](../../cli/gh-bot.test.mjs) asserts both directions offline.
- **Widening this App's permissions is a gate-policy change, not a settings tweak.** Step 1 says *Pull
  requests → Read and write, and nothing else*, and the bullets above are what that sentence is holding
  up: two of them stop being true the moment `administration` is granted, and nothing in this repository
  would notice. The permission set is a live setting no file here pins — the same limit
  [`../gate-map.md`](../gate-map.md) records for branch protection. Read it back at the supervised
  checkpoints; change it only alongside the gate map.
- ~~**The end-to-end path is unverified until the App exists.**~~ **Verified 2026-07-25.** The App is
  installed on `sleepy-panda-works/portulan` only, with `pull_requests: write` and `metadata: read`; a
  token minted through this path listed exactly that one repository, was **refused** repository contents,
  and posted the first `portulan-agent[bot]` comment. The contents refusal is the load-bearing one: it is
  what makes "the permission set is the enforcement, not the wrapper" a fact rather than an intention.
