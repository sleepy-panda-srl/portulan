# What the compiler refuses — the full account

> The rest of the gate map's [section of the same name](../gate-map.md#what-the-compiler-refuses): the third
> outcome, the two backends and what each refuses, the gates neither compiles, composition, and the
> argument for each honest hole. The index carries each hole's rule.

**There is a third outcome, and it is not a per-rule one — it refuses the whole compile.** Since
2026-09-09 a **`gated` or `prohibited`** rule whose path target can never match any path a host submits
raises a `CompileError`, so the run is **could-not-run** and no artifact is written. It is deliberately
not a `refused` row: `refused` is the accounting for a rule a backend legitimately declines, and it exits
0 having written the artifact without that rule — which would leave `doctor` reporting a gate the policy
declares and nothing enforces as ordinary non-coverage. A policy that cannot be enforced as written is
malformed rather than partially covered. Honest holes, entry 8, carries the argument and the residue.

**Two backends read this policy, and what each refuses is different.** The refusals below are the
**Claude Code** backend's — the host on this machine. Since milestone 4 session 1 there is a second, the
**GitHub repository ruleset** in [`compile/github-ruleset.json`](../compile/github-ruleset.json), which is
the platform floor compiled from this same file, and its partition is close to the inverse: `propose` is
exactly what it enforces. `node cli/compile.mjs --matrix` prints every rule against both, and
[`compile/README.md`](../compile/README.md) argues each refusal.

Three kinds of refusal from the Claude Code backend, all printed on every run:

| Refusal | Why |
|---|---|
| tier `auto` | Unattended by **policy**, not by the host — and the difference is the cost. There is nothing for *this compiler* to enforce, but Claude Code prompts for any command it has not been told about, so every Auto action is answered by hand, and the answers land in a per-machine settings file: unseen by review, absent from every diff, and thrown away with the worktree that earned them. Measured on one host, 2026-07-28: **404 hand-added allow entries, exactly one** of them matching an Auto rule here. The maintainer's ruling of 2026-07-27 stands — the compiler only ever adds restriction — but on a narrower reason than the one this row used to give. *"An `allow` would loosen a check"* is not established: `git push` is Auto and `git push --force` is Gated, and whether a narrower `ask` outranks a broader `allow` is host precedence **this repository has never measured**. What holds without that answer is that an allow prefix reaches every spelling beneath it, including ones no rule names — `git push --mirror` is destructive and sits in no tier. |
| tier `propose` | Enforced by the platform floor — pull request, required check, review — not by a permission rule on one machine. **The floor backend compiles exactly these**, which is what makes that sentence a hand-off rather than a shrug. |
| action `none` | No tool-level surface exists, or none that a matcher could honestly cover. **Five**, and the enumeration is the count: renaming or transferring the repository, spending money, and sending something outward are declared here; `commit-without-the-hooks` and `self-certify-a-checkpoint` are composed from `rituals/checkpoints`. _(This row said "the two" while the policy declared three — it never counted `rename-or-transfer-a-repository`. Corrected 2026-08-14 in the change that added the fifth, which is the same undercount-by-enumeration the change is about.)_ |

**Three gates *this workspace declares* are compiled by neither backend**, printed by `--matrix` and by
`doctor` because a policy stating a gate nothing enforces should never read as configured:
`rename-or-transfer-a-repository`, `spend-money-or-register-a-domain`,
`send-something-outside-this-repository`. Each is a prompt-level habit and the Gated tier's header, and
nothing else, until something reaches it. _(The third of them now has one enforced spelling — milestone
8's emitter refuses its own export without a **committed** opt-in, exactly as `portulan feedback send`
refuses without `--approve`. That is enforcement in the artifact rather than in a host's permission
table, so this row is unchanged: the compiled backends still emit nothing for it, and a reader must not
read either tool's refusal as coverage of the action as a whole.)_

**Composition contributes gates to this policy, and until milestone 7's close nothing here said so.**
`rituals/checkpoints` adds two: `commit-without-the-hooks` (tier `gated`) and `self-certify-a-checkpoint`
(tier `prohibited`). **Neither is compiled by either backend.** The first was, by the Claude Code backend,
until 2026-08-14 — it carried `git commit --no-verify` as a matcher, and that matcher was removed on the
ruling recorded in [`0029`](../proposals/0029-a-constraint-names-a-category-not-a-list.md) Q3, for the reason
set out in [the **Gated** tier](gated.md#commit-without-the-hooks-composed): a hook bypass has unbounded spellings, and one of them is not
coverage.

**So the uncompiled count is not fixed, because composition moves it — and for one milestone the two
printers did not agree on it.** It stands at **five**, both composed gates among them, measured on this
tree by `compile --matrix` and `doctor` alike. It was **four** until 2026-08-14. Measured on `74240fa`: `compile --matrix` reported **4** and named it;
`doctor` reported **3** and did not. **Settled 2026-08-13: `doctor` now reads the policy this workspace
yields — declared plus composed — through `compile`'s own `packContributions`/`composeFragments`, and
the two agree.** The divergence is kept here as the record of what it cost, not as current behaviour —
**and the sentences describing it are past tense for that reason.** Neither printer *was* wrong about what
it read: `--matrix` *walked* the composed rows and `doctor` *walked* only the rules this workspace
declares. They *were* two readers of one policy answering the same question differently, which is
[`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s shape. It was ruled a **behaviour change** rather than a record repair — it moves what a verdict says about
every workspace composing a pack — and so landed in its own change after milestone 7's close, which is
the pass that found this sentence claiming three while citing two printers that disagreed.

**The third reader of one policy was [`cli/gate.mjs`](../../cli/gate.mjs), and it was swept last.** *Declares*
versus *yields* has now been repaired three times: `dod.md`'s condition 1, then `doctor` above, then the
PreToolUse hook — which walked `gates.json` alone while the permission rules compiled beside it came from
the composed set ([#269](https://github.com/sleepy-panda-srl/portulan/issues/269)). It composes through
the same `packContributions`/`composeFragments` for the same reason it already imported `matchesRule`: a
second composer drifts the way a second matcher does. Session 16 wrote the transferable rule down —
*when a rule has been fixed on one noun, look for the other nouns* — without naming which nouns were
left; this was one of them, and the sweep it asks for did not happen until [#269](https://github.com/sleepy-panda-srl/portulan/issues/269).

**What that cost on this repository is nothing, and the number is the point rather than a reassurance.**
Both fragments `rituals/checkpoints` contributes carry `action: none`, so no matcher reaches them and
neither layer ever could; the defect was **latent here and fixed on its shape**, demonstrated on a fixture
whose pack contributes a *matchable* prohibition. Manufacturing a live case on this tree would have meant
giving a `none` rule a matcher, which is the ruling [`0029`](../proposals/0029-a-constraint-names-a-category-not-a-list.md)
Q3 made in the opposite direction. Measured before and after on the live runner: a composed `prohibited`
fragment matching `curl` drew **zero bytes** from the hook and now draws `deny`, wrapper spellings included.

**Two decisions inside that repair, both deliberate.** The hook answers with the **strongest** matching
tier rather than the first listed. Composition is what makes that matter *systematically* — added rules
are appended, so a pack-contributed `prohibited` rule is always the later one and first-match hands the
call to a broader declared `gated` rule, answering `ask` on an action the policy prohibits. **It is not
composition's defect alone, and a draft of this paragraph implied it was:** a workspace composing nothing
and declaring `git push` gated above `git push --mirror` prohibited diverged the same way, measured. So
this repair reaches single-file policies too — and this repository's own is unchanged only because
`edit-the-constitution`, the one `prohibited` rule it declares, is listed first. The change is
strengthen-only in every case: `ask` may become `deny`, never the reverse.
And a composition that is *refused* — a pack demoting a rule, a `pack.json` that will not parse — falls
back to the **declared** policy rather than stepping aside, so a dependency cannot switch off the gates
this workspace declares in its own file. Composition only ever adds a rule or raises a tier, which is what
makes **the fallback** strengthen-only; the strongest-tier answer is strengthen-only on the tier order
alone, composition or none — as the measured single-file divergence one paragraph up already shows.

**Two layers are emitted for every gate, and only one of them is the gate.** The permission rule holds;
the hook supplies the sentence. That split is forced by a measurement rather than chosen: on CLI 2.1.220 a
hook that *crashes* fails **open** — the tool proceeds — on the identical wiring that blocks when the hook
is healthy. A permission rule does not fail open. So [`cli/gate.mjs`](../../cli/gate.mjs) is written to
step aside silently on any internal error, handing the decision back to the layer that cannot be removed by
a syntax error.

## The honest holes

**The honest holes, named because they are the ones to know.** Nine of them — seven until 2026-08-24,
when the gate corpus found the eighth on its first run, and nine since 2026-08-31 — and the first is smaller than
an earlier draft of this paragraph claimed — that draft said the wrapper spelling "falls through to the
host's default mode", which was true *before* the hook existed and false of the shipped configuration. A
pre-commit supervisor measured it and found the hook's `ask` governing and its sentence reaching the agent.
Corrected here rather than left, because a gate map that overstates a hole is as wrong as one that hides it.

1. **Spellings neither layer sees.** The permission rule matches a literal prefix; the hook peels **one**
   shell wrapper. Two wrappers, a heredoc *whose target is interpolated*, an interpolated variable, or a
   command assembled at runtime reach neither. For a `write:` rule's shell half the list is its own:
   an interpolated path, a language runtime writing the file itself (`python3 -c "open(…,'w')"`), a
   writer outside [the shell half's table](prohibited.md#the-shell-half-and-why-the-strongest-rule-here-had-the-weakest-layer), and a program that **invokes** a writer (`find -exec cp`, `xargs cp`)
   — parsing those to find the real command is the ambitious parser this repository keeps refusing.
   Quoting is honoured to one level, so a write-shaped string inside a `node -e` script can produce a
   false **red**; measured on this repository's own tooling while testing this very change. Every entry
   is asserted as a test rather than only written down, so anyone tempted to call this layer a rail
   meets the counterexample.

   One more, added 2026-07-28 and narrower than it was that morning: **a heredoc opener that opens
   nothing, whose delimiter word happens to appear on a later line anyway.** Openers are found on the
   raw line, so `<<EOF` inside a quoted string or after a `#` sets a delimiter on text that opened
   nothing. Until this date the lines that followed were then swallowed whole looking for a terminator
   that never came — a fail-open manufactured by a defensive step, and the plainest bypass yet found
   here, since it hid a gated command on *any* later line. An unterminated opener is now treated as no
   opener, which closes it in the fail-closed direction at the cost of a possible false red. What
   remains is only the coincidence case, and closing that needs a quote-aware parser this repository
   refuses to grow. Found by Copilot review, against a matcher three rounds of review had already
   improved.

   One more, added 2026-08-25 and found by [`../../cli/fuzz-shell.mjs`](../../cli/fuzz-shell.mjs) rather
   than by a reader: **a QUOTED command substitution.** `echo "$(git push --force origin main)"` is a
   command bash runs, and it reaches nothing — the segmenter's quote loop steps over the parentheses,
   so no split happens. The **bare** form `echo $(git push --force origin main)` is CAUGHT, because
   `(` and `)` are in the operator class. One concept, two spellings, opposite answers, which is why
   the fuzzer's table is keyed on the spelling and never on the idea, and why this entry names the
   spelling rather than saying "command substitution". Asserted on both matchers.

   _This list was wrong when first published — four items, five missing, the plainest of them a
   newline. It was corrected by a fresh-context supervisor that tried to defeat the matcher instead of
   reading it. A hole list is a claim like any other, and the only thing that checks it is somebody
   attacking it. **It was still short one spelling on 2026-08-25**, a year of reviews later, and the
   thing that found that one was a generator._
2. **A gated command that was not the first word on the line reached nothing — now closed for
   SEPARATORS, still open for leaders, and still open at the permission layer.** `ls && git push
   --force origin main` matched no gate at all until 2026-07-28: the matcher prefix-matched the whole
   command string, so **every** Gated outward action here was defeated by putting anything in front of
   it. The hook now splits a line on its separators and matches each command.

   What that does not reach is a word sitting in front of a command *inside* a segment, and those
   forms are ordinary rather than exotic. Measured on the runner, 2026-07-28 — each of these steps
   aside where the bare spelling answers `ask`:

   | Still escapes | Spelling |
   |---|---|
   | a leading assignment | `FOO=bar git push --force origin main` |
   | a command prefix | `env git push --force …`, `sudo git push --force …` |
   | a compound-statement keyword | `if true; then git push --force …; fi` |
   | a loop body | `for x in 1; do git push --force …; done` |
   | a brace group | `{ git push --force …; }` |

   **A leading redirection was the sixth row of this table until 2026-08-24, and is now closed** —
   `2>&1 git push --force …`, `> /tmp/log git push --force …`, and the `>|` and `&>` spellings the
   row never named. See below for why that one row could close while these five cannot.

   Stripping a **named table** of leaders would close the common ones the way the writer table does,
   and is deliberately not done: that table has no natural edge — `nice`, `time`, `nohup`, `timeout`,
   `command`, `stdbuf`, `doas` — and one missing entry buys exactly the false confidence this list
   exists to deny. Asserted as tests rather than only written down.

   **Closing it also WIDENED the write half, which nobody predicted and one reviewer predicted the
   opposite of.** The strip lives in `commandSegments`, which both matchers use, and Copilot round 9
   of [#336](https://github.com/sleepy-panda-srl/portulan/pull/336) read that shared use as a write-gate
   bypass: `> docs/vision.md echo ok` would have its redirection stripped and `shellWrites` would stop
   seeing it. **Measured across 24 spellings, it does not happen** — `matchesRule`'s write branch is an
   OR whose *first* arm reads the RAW command through `shellWrites`, which segments with
   `shellSegments`, a different reader that keeps redirects; `commandSegments` is only the second arm,
   so a strip there cannot remove coverage the first arm already gives. What the same probe found
   instead is **four write-gate holes this change closed**, each a redirection leading a segment whose
   wrapper hides the write — reachable only through that second arm, and answered `false` by the
   matcher on `main`. All four are asserted now, with a false-red control.

   **The redirection row was not like the others, and naming that difference is what let it close.**
   A leading redirection has a *closed* grammar — an optional file descriptor, one of `<` `>` `>>`
   `<>` `>&` `&>` `>|`, and a word — so unlike the leader table it could be stripped completely, with
   an edge a reader can check. It was left open in #60 only because the same change would have been a
   matcher change on the same day this entry stopped overclaiming, and one of those at a time is the
   honest order. Filed as [#71](https://github.com/sleepy-panda-srl/portulan/issues/71) on that basis
   — **a decision rather than a limit** — and closed 2026-08-24.

   **Closing it cost more than the issue predicted, and the difference is the part worth keeping.**
   #71 forecast that the fix would "flip exactly one assertion"; it flipped **four**, because the
   suite had grown two redirection spellings since the issue was written. And a strip alone would not
   have worked: `commandSegments` splits on `&` and `|`, so `2>&1 git push …` had already broken into
   `2>` and `1 git push …` before anything could strip a whole redirection, and `>|` broke the same
   way. The operators had to stop being read as separators first — which closed `>|` and `&>` in the
   same stroke, two spellings this table never named.

   **The grammar above says "and a word", and the first cut of the fix read that as "non-whitespace".**
   A shell word may hold spaces when it is quoted or escaped, so `> "foo bar" git push --force …`
   stripped `> "foo` and left `bar" git push --force …` — no gate, and the segment corrupted. Five
   spellings escaped that way, and bash was measured running the command after each. Two review passes
   also missed it, and the reason is worth recording beside the hole: **the fix's own tests probed the
   grammar at exactly the width the fix implemented**, so they could not see the width the sentence
   claimed. Found by Copilot on the double-quoted case alone; the other four were closed with it. The
   target reader now recognises quoted spans and escaped characters — the same three things
   `shellWords` recognises — and the unquoted two-word spelling `> foo bar git push …` stays UNGATED,
   because there bash really does run `bar`.

   **It took a third round, and the third one is the reason the suite changed shape.** Round 3 found
   the same class one level in: `"[^"]*"` could not hold a backslash-escaped quote *inside* a
   double-quoted span, so `> "foo \"bar baz\"" git push --force …` ended the span early and escaped.
   Measured, with bash measured creating the file and running the command behind it. **Two rounds, one
   class, both fixed at the spelling that was quoted** — so `cli/compile.test.mjs` now asserts the
   RULE rather than the spellings: whatever `shellWords` calls one word, the strip consumes whole, with
   an unquoted two-word counterexample stopping that from degenerating into *consume everything*. A
   fourth sibling reds in the suite instead of arriving in a review.

   **What must not follow from it.** This does not license a named table of command prefixes. That
   table is refused for a reason the redirection grammar does not share, stated one paragraph up, and
   the two changes look similar enough to be proposed together.

   **A third spelling was open until 2026-08-25, and it was the widest of them: a separator INSIDE a
   wrapper.** `bash -c "ls; git push --force origin main"` answered **false**, and so did every other
   Gated shell action written that way — the same total defeat this entry opens by describing, reached
   by putting the separator on the other side of the quote. The composition closed above tests the raw
   command's segments and each segment's spellings; it never tested a **spelling's** segments, so one
   wrapper plus one separator walked through. `ls && bash -c "…"` was closed and `bash -c "ls; …"` was
   not, which is why reading either claim on its own left the gap invisible — the same *"two claims
   that each held and did not compose"* shape recorded one paragraph up, met again in the change that
   recorded it.

   **The write matcher never had this gap, and that asymmetry is the lesson rather than a footnote.**
   Its callback is `shellWrites`, which segments AGAIN internally with `shellSegments`, so the write
   half received a third segmentation for free while the shell half — whose test is a plain prefix
   compare — received none. *A fix landing in one carrier and not its sibling*
   ([`proposals/0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)) between two
   branches of one function, for the second time in this file's history.

   Repaired at the **class**: a spelling is now segmented on both arms, so
   `ls && bash -c "x; git push --force …"` — a separator outside *and* inside — closed in the same
   stroke rather than becoming the next round's finding. The unwrap budget is unchanged at one level
   and `bash -c "sh -c '…'"` still escapes, asserted in the corpus as well as the suite because a
   composition change is exactly what peels a second level by accident. **Found by
   [`../../cli/fuzz-shell.mjs`](../../cli/fuzz-shell.mjs)**, milestone 8 clause (b), which generates the
   grammar rather than reading it — the first live bypass here found by a machine rather than by a
   supervisor or a reviewer.

   **This entry said "now closed at the hook" without qualification until 2026-07-28**, which was a
   sentence broader than its matcher — hole 5, one entry down, in the paragraph claiming to have
   closed a hole. Found by Copilot review on the pull request that wrote it.

   The permission rule reaches none of it either — `Bash(git push --force:*)` is a prefix pattern on
   the host, and nothing in that DSL reaches a command in second position — so this stays a gate whose
   reach beyond the first word is the hook's alone.
3. **A gate whose only layer is the hook — and the hook is the one that fails open.** New with [the shell
   half of `edit-the-constitution`](prohibited.md#the-shell-half-and-why-the-strongest-rule-here-had-the-weakest-layer). Everywhere else the permission rule is the gate and the hook
   adds reach; there, the hook *is* the reach, because no `Bash(prefix:*)` pattern can name a path sitting
   anywhere in a command. A syntax error in [`cli/gate.mjs`](../../cli/gate.mjs) removes tool-level
   coverage of shell writes to the constitution and leaves the `Edit` denial standing — which the host
   matches for every file-editing tool, `Write` and `NotebookEdit` included, and which is a
   partial gate that looks from the outside exactly like a whole one. `compile` names the affected rules in
   a note on every run for that reason.
4. **A local `allow` rule beside the compiled gates is unmeasured.** `.claude/settings.local.json` is
   git-ignored, so an adopter's own allow rules sit invisibly next to these. A compiled `deny`/`ask` beats
   an `allow` for the *same* pattern; what a broad local `Bash` allow does to the *wrapper* spelling has
   not been measured, and is not claimed either way.
5. **A rule whose sentence is broader than its matcher.** Guarded against by splitting rather than by
   trusting prose — `rename-or-transfer-a-repository` compiles to nothing and says so, rather than hiding
   inside a neighbour's matcher.
6. **This repository ships a wrapper of its own, and holes 1 and 4 meet in it.** Added 2026-07-28.
   [`tools/gh-bot`](../tools/gh-bot) runs `gh` under the agent identity, so `./.portulan/tools/gh-bot …`
   is a spelling no compiled rule sees: every shell gate here compiles to a `Bash(<prefix>:*)` match
   against the literal command, and [`cli/gate.mjs`](../../cli/gate.mjs)'s one level of unwrapping
   knows `sh -c` and nothing about this path. On the maintainer's machine the wrapper is also
   allowlisted by hand, which is hole 4 with the unmeasured part removed — the entries are for
   different spellings, so no precedence question arises and the wrapper simply runs unattended.

   **This was found against the `gh api` gate, and that gate no longer exists.** Reaching repository
   settings through `gh api` stopped being Gated on the same day — see the amendment at the end of
   [Gated](gated.md#the-gh-api-amendment) — so the specific bypass that
   prompted this entry is moot. The **class** is not: every Gated rule here is a prefix match on a
   literal command, and this wrapper is a second name for `gh`. What keeps that from mattering today is
   the App's permission set, not the wrapper and not a matcher.

   **What that was worth is a measurement, and the answer is the reason this stayed a documentation
   change rather than becoming a cleverer matcher.** The App is granted `metadata: read` and
   `pull_requests: write`, no `administration`; a ruleset `PATCH` and a branch-protection read both come
   back `403 Resource not accessible by integration`. The settings change was refused by the floor, which
   is [`../../core/operating/autonomy.md`](../../core/operating/autonomy.md)'s claim about the floor being
   demonstrated rather than repeated, and the measurement [the Gated amendment](gated.md#the-gh-api-amendment) leans on when it
   says the floor is what is left holding. What was *not* refused is a ruleset **read**, which rides on
   `metadata` and returned `200`. The wrapper refuses any endpoint outside pull-request conversation,
   before it mints a token.

   **That allowlist is stricter than the policy now, deliberately.** Since the `gh api` gate came off, a
   ruleset read through plain `gh api` is unattended, while the same read through this wrapper is
   refused. The two do not contradict each other because they are not the same principal: the
   maintainer's credentials are his to spend, and the agent identity is a token this repository mints,
   whose reach should be the smallest thing that does its job. A wrapper narrower than the policy costs
   an agent one redirection to a spelling that works; a wrapper wider than its job costs a credential
   nobody audited.

   **Three things that guard is not.** It is not a rail: an agent with shell access can mint the token
   and call `gh` directly, exactly as [`tools/README.md`](../tools/README.md) has always said of the
   subcommand refusals. It is not complete: `graphql` is one admitted endpoint carrying arbitrary
   queries, bounded by the permission set and by nothing local. And it is not a *rule* — no entry in
   [`gates.json`](../gates.json) targets the wrapper, on purpose. Gating `gh-bot api` wholesale would gate
   pull-request conversation, which is the one thing that identity exists for, and an agent meeting a
   dead end there reaches for plain `gh` and posts as the maintainer. Gating only the settings endpoints
   is not expressible: a permission prefix cannot discriminate on a path segment several deep, and the
   compiler refuses `:` in a shell target for reasons of its own. So the boundary is where the doctrine
   already put it — the token's scope — and this row exists so that is stated rather than discovered.

   **The standing risk, since it is the one to watch.** The permission set is a live setting no file here
   pins, and [`tools/README.md`](../tools/README.md) already anticipates one reason to revisit it. Widening
   that App converts this from a documented gap into a live bypass, and nothing in this tree would say
   so — the same class as every other live-settings claim on this page, and read by hand at the
   supervised checkpoints.
7. **A pack the hook cannot resolve, where `compile` can.** Added 2026-08-14, and it is the remainder of
   [#269](https://github.com/sleepy-panda-srl/portulan/issues/269) rather than a hole that change
   opened. [`cli/gate.mjs`](../../cli/gate.mjs) composes from the root **derived** from the workspace
   manifest's `tree` and wires **no discovery**, so a pack that resolves only from the host's plugin
   cache contributes to what a bare `compile` yields and not to what the hook composes. Deliberate: this
   runner is on every tool call, and a gate whose answer moved with what is installed on the machine
   could not be reviewed from the repository. Two consequences follow and are named rather than left to
   be met — a workspace with **no `tree`** composes nothing here, and a **refused** composition falls
   back to the declared rules. Which of the two resolution sets is the right one for a *rail* is
   [#264](https://github.com/sleepy-panda-srl/portulan/issues/264)'s question, not this entry's; what
   this entry states is which one the hook uses. Asserted as a test rather than only written down —
   and the first draft of that test was **inert**, a poisoned plugin record shaped so that no reader
   could have picked it up, green against a runner that went looking. Found by the pre-commit
   supervisor, which wired discovery in and watched the rail stay green.
8. **A rule whose target is the whole repository matches nothing at runtime.** Added 2026-08-24, and
   found by the gate corpus on its first run rather than by a reader. `matchesPath` strips a leading
   `./` and any leading `/` from the target, which reduces `"./"` to the empty string — and the empty
   string is then refused explicitly, because a target that matches everything is far likelier to be a
   malformed manifest than an intended rule. So `edit-on-a-working-branch` (`write: "./"`) and
   `read-anything-in-the-repository` (`read: "./"`) answer **false for every input**.

   **Nothing is mis-enforced today, and the reason is the whole shape of this entry.** Both rules are
   `auto`; the compiler refuses the `auto` tier wholesale, and [`cli/gate.mjs`](../../cli/gate.mjs) reads
   only `gated` and `prohibited`, so neither layer ever asks. What existed, **until this entry's closure below on
   2026-09-09**, was a divergence waiting for its first author: a **gated** or **prohibited** rule written
   `./` compiled to a named permission surface — the bare `Edit(./)` — while the runtime matcher covered
   nothing, so the compiler reported it **compiled** and `doctor` counted it covered: a partial gate that looks from the outside exactly like a
   whole one, which is hole 3's failure mode reached by a different road. _(This sentence read *"a
   permission rule that covers the tree"* until 2026-09-09. Re-derived: a real target compiles to a `**`
   glob and `./` does not, so what is emitted is the bare spec and what a host makes of it this
   repository installs nothing to measure. Either reading is a hazard; the one measurable here is the
   accounting.)_

   This is the same class as the path-prefix divergence [`cli/compile.mjs`](../../cli/compile.mjs) records
   at `matchesRule`, and it was found the same way that one's cost was: by attacking the matcher rather
   than reading it. Recorded here and asserted in
   [`evals/goldens/gates/`](../../evals/goldens/gates/) as `documented-hole` cases, so if someone repairs
   `matchesPath` the corpus goes red until this entry is updated. Tracked as [#337](https://github.com/sleepy-panda-srl/portulan/issues/337), which
   sets out the three defensible answers rather than presuming one.

   **CLOSED at the enforcing tiers, 2026-09-09 — and the entry stays, because only half of it closed.**
   _(Every date in this entry read **2026-09-03** — the day the evidence table was measured — until the
   milestone-8 close re-derived the merge: [#408](https://github.com/sleepy-panda-srl/portulan/pull/408)
   was created `2026-09-03T18:57:23Z` and merged `2026-09-09T07:48:12Z`. A closure is dated by the act
   that closes it, and here that is the merge; six carriers across three files said otherwise.)_
   The change that closed it took #337's **option 3**, the narrowest of the three: the Claude Code
   backend now refuses outright — a `CompileError`, so the compile is could-not-run rather than a
   partial artifact — a **`gated` or `prohibited`** rule whose path target can never match. The
   predicate is `neverMatches` in [`../../cli/compile.mjs`](../../cli/compile.mjs), derived from that file's
   own `normalisePath`, and the refusal sits beside `HOST_GATE_TIERS` rather than at `parse`, because
   `parse` holds no tier partition by a decision its own docblock records. So the hazard this entry
   was written about — a hollow gate **of this class**, a target whose comparison form is not normalised —
   can no longer be **compiled**, and so can no longer merge: `compile` exits 2 and `doctor` exits 1, and
   both run inside `workspace-verify`, whose loop fails the required check on any non-zero recipe. _(The
   qualifier is owed and was missing: `docs/**` at `gated` compiles to a surface byte-identical to a real
   `docs/` target's while `matchesRule` answers false for every input, so a hollow gate is still
   reachable by a **glob metacharacter**, which this predicate does not read and #337 did not scope.
   Measured on #408's review; filed rather than folded.)_

   **Nothing fires at commit time, and not for want of a reader.**
   [`../../cli/gate.mjs`](../../cli/gate.mjs) reads this policy on every `Bash` call, `git commit` included.
   But it matches the *action* against the rules and validates no target — it loads the policy through
   `parse`, which carries no such check — so at any tier it could only ever have gated the commit
   itself, never read the rule being committed; and the rule a `git commit` falls under,
   `commit-to-a-working-branch`, is `auto`, so it does not do even that. _(This paragraph said the reason
   was "the tier rather than the absence of a reader", which is the wrong half: the tier is why the hook
   does not act, and the absence of a target check is why it could not have helped at any tier. Copilot
   on #408 caught the reference; the review caught the causation.)_

   **What remains, and it is why every case below still expects FALSE.** The two rules above are
   `auto`, that tier is refused one step earlier, and their targets still answer false for every
   input: the divergence between what `./` says and what it matches is untouched, because **what `./`
   should MEAN as a policy target is still nobody's ruling** — option 3 exists precisely to leave that
   open. And the residue at the hook is real: [`../../cli/gate.mjs`](../../cli/gate.mjs) reads the policy
   through `parse`, which this change does not touch, so a workspace that has already committed such a
   rule still loads it at run time, `matchesRule` answers false, and the hook steps aside because
   nothing matched. The refusal is at **compile** time — when the artifact that gates the host is
   written — and not at the hook.

   **The class is wider than the spelling this entry names, and it took several cuts to find its width
   — [`../../cli/compile.mjs`](../../cli/compile.mjs)'s `neverMatches` docblock is the one carrier of that arc.**
   It is not a list of spellings but a comparison: `matchesPath` compares a **tail**, and a host hands
   over an absolute path with no `.` segment, no empty segment and no backslash — **an assumption about
   the host, stated rather than measured**, since nothing here controls what `file_path` arrives. The
   refusal does not rest on it either way: a rule matching only `/repo/x/.` gates nothing anybody meant
   to gate. So a target whose comparison form is not already normalised is compared against a spelling
   no candidate can carry. Three families fall under it. **Targets that reduce
   to nothing** — `./` `.` `./.` `././` `.//` — compiling to `Edit(./)`, `Edit(./.)` or, for `././`, the
   real subtree glob `Edit(././**)`. And **targets with an interior `.` or empty segment** —
   `docs/./vision.md`, `docs//vision.md`, `docs//`, `docs/.`, `./docs/./`, `docs/vision.md/.` — each
   compiling to a named surface on a real-looking path, which is strictly more misleading than
   `Edit(./)` and is the same hollow gate. **And a third: a target carrying a backslash** —
   `docs\\vision.md`, `docs\\` — which `matchesPath` can never match, because it normalises the
   *candidate*'s backslashes to `/` and never the target's; that one holds on every platform and has no
   conditional reading at all. Thirteen measured, against `docs/` `./docs/` `docs/vision.md`
   `core/operating/loop.md` among the controls that must stay matchable — nine are pinned by
   [`../../cli/compile.test.mjs`](../../cli/compile.test.mjs)'s `CONTROLS`, which is the carrier that measures
   them and the one to read rather than this line; `docs//` is hollow and `docs/` is not,
   which is why exactly one trailing slash is read as *the subtree* and removed before the comparison.

   _(The first cut of the predicate asked only whether a target reduced to **empty**. It caught the
   first family, and three carriers of its prose — this entry among them — claimed the class. Found at
   a pre-commit checkpoint by probing the neighbouring spellings rather than by re-reading the sentence;
   the third went the same way one grade later. Each time the checkpoint offered narrowing the prose as
   an equally honest repair and each time the predicate was widened instead, because defining a class by
   the examples it was written for is
   [`0020`](../proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md)'s shape. **Three forced reds
   hold it**: disabling the refusal reds six suite cases, narrowing the predicate to normalise-to-empty
   reds five, and dropping the backslash arm alone reds four.)_

All of which is the same point: **this layer is a convenience above a rail, not the rail.** The rail is the
[platform floor](../gate-map.md#the-platform-floor), which refuses the push at the server regardless of what any local file says, and is
the only layer indifferent to how a command was spelled.

One qualification, added when this section met [the floor audit](platform-floor.md) rather than left to read as stronger
than the floor now claims to be: that audit records the floor as **three layers with one of them
unverified** — the interaction between the organisation ruleset's bypass actors and `enforce_admins` is
undocumented and deliberately untested. So "the rail beneath this" is very probably intact and is not
certified. This layer being a convenience is unchanged either way; what changes is that neither layer
should now be described as unconditional.

9. **A write gate's permission layer rests on one host behaviour, and a host that changed it would
   narrow the gate with nothing going red.** Added 2026-08-31. `compile` emits `Edit(path)` as a write
   gate's **only** permission pattern, because Claude Code 2.1.240 **discards** `Write(path)` and
   `NotebookEdit(path)` — *"only `Edit(path)` rules are"* matched by file permission checks, said on
   every start — and matches `Edit(path)` for every file-editing tool. Measured with controls, both
   directions: with `Edit(./x)` alone denied, a `Write` and a `NotebookEdit` to that path were both
   refused, while the same tools writing a **different** path succeeded.

   **The hole is the dependency, not the behaviour.** If a later host stops treating `Edit(path)` as
   tool-general, this gate silently covers one tool of three at the permission layer — `Write` and
   `NotebookEdit` would fall to the hook, which [`../../core/operating/autonomy.md`](../../core/operating/autonomy.md)
   and hole 3 both record as the layer that fails open. **Nothing here would go red**: the artifact
   would still byte-compare, the suite would still pass, and the emitted pattern would still be exactly
   what the compiler intends. It is a fact about one CLI version, and `compile` prints it as a note on
   every run with a re-measure mandate — the pairing [`compile/README.md`](../compile/README.md) names for
   this shape, and hole 8's precedent for recording a divergence that has no instance today.

   **The same clause runs backwards and is why the change is version-stamped rather than presented as a
   repair.** No earlier CLI was re-measured. On a host that honoured all three patterns and did *not*
   treat `Edit` as tool-general, this narrowing **removes** two working permission rules. `compile` is a
   tool every adopter runs, so that reaches further than this tree.
