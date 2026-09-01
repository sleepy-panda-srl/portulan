# Changelog

Every release of Portulan, and what changed in it. Kept because
[`docs/plan.md`](docs/plan.md) — Protocol → Versioning — requires a changelog per release; SemVer
from `v0.1.0`, and from milestone 8 each release carries an eval result as well.

**`## Unreleased` accumulates.** A change that a reader of a release would want to know about adds its
entry as it lands; the cut then renames that heading to the version and dates it, in a change merged
before the tag is created, so the tagged tree still contains its own entry.

_The rule this replaces said only that the file "is written in the change that cuts the release", which
makes a heading named `Unreleased` one that must always be empty. **The ground for changing it is not
that accumulation was already the practice — it was not.** The record is one accumulating write, at
milestone 4 session 0, and then two sessions that saw the sentence go false and **deliberately declined
to fix it**, citing this header: [#85](https://github.com/sleepy-panda-srl/portulan/pull/85) and
[#87](https://github.com/sleepy-panda-srl/portulan/pull/87) cut no release, so under the old rule
editing the file would have contradicted it. That is the actual refutation, and it is worse than mere
drift: the rule made a **known-false sentence unfixable**, and it stayed false for a day, across the
close of a second milestone. A rule whose only compliant response to a falsehood is to leave it standing
is the shape
[`.portulan/memory/a-mandate-nothing-checks-is-already-broken.md`](.portulan/memory/a-mandate-nothing-checks-is-already-broken.md)
names. The maintainer's ruling, 2026-07-29 — recorded verbatim, with the two alternatives he declined,
in a comment on [#94](https://github.com/sleepy-panda-srl/portulan/issues/94) and again in the pull
request that closes it. It settles the half that issue routed to him, not merely the stale sentence that
prompted it._

_**What accumulating does not license.** The bar is still what a *reader of a release* gets, not what a
session did: the Session log in [`docs/plan.md`](docs/plan.md) is the per-session record and this file
must not grow into a second one. Nothing checks the bar. It is the same judgement the date rule above is
left to, and for the same reason._

**A date here is the day the release was cut, in the maintainer's timezone (Europe/Bucharest) — not
the `git tag` timestamp. The merger corrects the date if the cut slips past midnight.** The timezone
is named because "past midnight" means nothing without one, and that ambiguity is the part that would
actually bite. Nothing checks this: the true cut date is exactly the class of fact `doctor` never
judges, and the one readable artifact — the tag's own timestamp — is the thing this rule declares
non-authoritative. It is human-owned prose on purpose, and it is not a candidate for a lint.

The Session log in [`docs/plan.md`](docs/plan.md) is the fuller record — it is per *session* and it
records how things were found. This is per *release* and records what a reader gets.

## Unreleased

### Added

- **A rail now refuses a release that carries no eval result — and no release carries one yet** —
  milestone 8's ninth clause, landed to its mechanism and **half-vouched**: nothing has been cut since
  the clause acquired an owner on 2026-08-24, so the rail's green today reads *no release from `0.1.3`
  onward has been cut yet*. The lede says so because every other carrier of this change does, and a
  changelog entry announcing a state four paragraphs before correcting it is read by more people than
  the correction. [`cli/release-eval.mjs`](cli/release-eval.mjs) captures, for the version being cut, the verdict
  every recipe the workspace **yields** returned at a named commit, and renders a register from it that
  the `release-eval` verify recipe byte-compares. Records live one pair per version under
  [`evals/releases/`](evals/releases/); [`.github/workflows/publish-github-packages.yml`](.github/workflows/publish-github-packages.yml)
  runs `--tagged` against the tag's own checkout before publishing, which is the only check here that
  sees a release rather than a tree.

  **What an eval result consists of, where it is carried, and whether a rail or a person refuses one
  were the three things the 2026-08-24 amendment left open.** They are settled as: every yielded
  recipe's verdict plus the A/B baseline's **identity and never its figures**; one file per version that
  the changelog and the release body cite rather than restate; and **both** — a rail for the tree and the
  tagged checkout, a person for the release body, split because those are answerable at different times
  and no in-tree check reaches a body authored on GitHub.

  **Two designs were reversed before a line was written, both by a fresh context.** Keying cut detection
  to `CHANGELOG.md`'s top heading never fires — the cut re-seeds `## Unreleased` above the version it
  just wrote, so that heading is `Unreleased` on the cut commit too. And keying it to `package.json`'s
  version alone grades one record at a time: once `0.1.4` is declared, `0.1.3`'s record could be deleted
  in silence. The subject is every version this file records from `0.1.3` onward, permanently, graded in
  both directions so a record for a release that was never cut reds as well.

  **`0.1.0`–`0.1.2` carry no record and are not asked for one.** The Protocol's wording is *from
  milestone 8*, and a retro-fitted record would be a capture nobody ran. **No release has been cut since
  the clause acquired an owner, so nothing carries one yet** — the rail's green today reads *no release
  from `0.1.3` onward has been cut yet*, and it prints that rather than letting exit 0 imply a graded
  set. The clause's central arm is exercised by a forced-red drill that moves the boundary until an
  already-cut release becomes governed and requires the rail to fire.

- **Compiled gates now ship with the attack cases that prove their coverage** — milestone 8 clause (a).
  `cli/goldens.mjs` grades a corpus at `evals/goldens/gates/` against the gate policy a workspace
  **yields**, through the compiler's own exported `matchesRule` rather than a second implementation, and
  runs as the `goldens` verify recipe. Two rails: a rule that compiles to a matcher and carries no
  fixture is red, so coverage is measured rather than named; and a case marked `documented-hole` that
  starts being *caught* is red too, so a hole record cannot go stale in either direction.

  **What it is not** is stated in the tool, the recipe and `evals/README.md` alike: a **presence floor**.
  One trivial fixture per rule satisfies it while proving nothing adversarial, and no check can tell the
  difference — the runner prints that limit on every green rather than letting an exit code imply more.

  It went red on its first run and found a hole nobody had recorded: **a rule whose target is `./`
  matches nothing at runtime**, because `matchesPath` reduces `"./"` to the empty string and refuses it.
  Nothing is mis-enforced today — the two rules shaped that way are `auto`, which no layer asks about —
  but a *gated* rule written that way would compile to a permission rule covering the tree and a matcher
  covering nothing. Now entry 8 of the gate map's honest-holes list, and asserted in the corpus.

### Fixed

- **A leading redirection no longer defeats a shell gate**
  ([#71](https://github.com/sleepy-panda-srl/portulan/issues/71)). `2>&1 git push --force …`,
  `> /tmp/log git push --force …` and their kin reached no gate: a word in front of a command inside a
  segment escapes the matcher, and this was the one such word whose grammar is *closed* — an optional
  file descriptor, one operator, a word — so it could be stripped with an edge a reader can check.

  Closing it also required `commandSegments` to stop reading the `&` of `>&`/`&>` and the `|` of `>|`
  as separators, since those spellings were already in pieces before any strip could see them — which
  closed `>|` and `&>` as well, two spellings the issue never named. **The five remaining leaders —
  `env`, `sudo`, a leading assignment, a `then`/`do` branch, a brace group — are untouched by decision:**
  a named table of command prefixes has no natural edge, and one omission buys exactly the false
  confidence a hole list exists to deny.

  **The grammar says "and a word", and the first cut read that as *non-whitespace*.** A quoted or
  escaped target holds spaces, so `> "foo bar" git push --force …` stripped `> "foo` and left
  `bar" git push --force …` — no gate. Five spellings escaped, and bash was measured running the command
  after each. The target reader recognises quoted spans and escaped characters now, and the *unquoted*
  two-word spelling stays ungated, because there the shell really does run the second word.

  **A third round found the same class one level in** — `"[^"]*"` could not hold a backslash-escaped
  quote *inside* a double-quoted span. Two rounds, one class, each fixed at the spelling that was
  quoted; so the suite stopped asserting spellings and now asserts the **rule**: whatever `shellWords`
  calls one word, the strip consumes whole, with an unquoted two-word counterexample keeping that from
  becoming *consume everything*. `shellWords` is exported for it. A fourth sibling reds in the suite
  rather than arriving in a review.

- **Three writer-table entries were covered by the matcher and exercised by nothing**
  ([#70](https://github.com/sleepy-panda-srl/portulan/issues/70)). `shred`, `gsed` and `ruby` now have
  admit cases, **generated from the declaring tables** rather than hand-listed, so a fifteenth entry
  cannot ship unasserted. `&>` gained the regression test it never had, alongside `2>`, `>|` and `>>`.

### Changed

- **A GitHub Packages visibility flip is paid once per package, not once per release.** `0.1.2`
  recorded that `npm publish --access public` does not govern on that registry and that making the
  package public took two manual UI steps with no API behind either. What it left open — because the
  question had not arisen yet — is whether that cost recurs on every publish.

  It does not. Measured 2026-08-20 on the workflow's **third** fire, the release of `v0.1.2`: the
  publish reported `visibility: public` with no manual step in between (run
  [32337456931](https://github.com/sleepy-panda-srl/portulan/actions/runs/32337456931)), and the API
  agrees — `/orgs/sleepy-panda-srl/packages/npm/portulan` returns `public`, carrying both `0.1.1` and
  `0.1.2`. The per-package setting is a property of the package and every later version inherits it.

  **Two things this fire did not establish, stated because the entry it corrects reads as though it
  had.** The package was **already public** when this ran. So nothing here tests a *first* publish
  under a *new* package name now that the organisation policy has been changed — whether such a
  package is created public, or created private and still needing its own flip, is untested, and it is
  the half that would matter to anyone adding a second package. And for the same reason this cannot
  re-test `--access public`: a flag cannot be shown to govern nothing on a package that was already
  public, so `0.1.2`'s finding about it stands on the 2026-08-18 measurement alone, neither confirmed
  nor refuted here.

  _Recorded rather than left as a happy surprise, and the limits recorded with it, because the shape
  this repository keeps getting wrong is a measurement true of one case written down as though it were
  true of the class._ The workflow header carries the same correction beside the claim it qualifies.

### Fixed

- **`compile` reported a workspace that declares no gate policy as an unreadable file.** A workspace
  with no top-level `gates` key falls back to the conventional `gates.json` path — a shape
  `policyPath`'s own note calls *"a legitimate shape, and refusing it would make the key required,
  which is a spec change nobody decided"*. The next line handed that path to the reader, which refused
  it with `ENOENT`, so a documented-legitimate state was reported as a corrupt or deleted file and sent
  the reader hunting for one that was never supposed to exist. The refusal also happened before packs
  were composed, so it could not say what the absence costs: pack-contributed gate fragments reach
  nothing, because a fragment tightens a policy and there is none to tighten.

  The diagnostic now names the state, counts the stranded pack rules and names the pack. It remains
  exit 2 and still writes nothing — nothing was compiled, and a compiler reporting success having
  emitted nothing is the failure this repository keeps writing checks against.

- **A declared `gates` path inside a directory whose name begins with `..` was refused as an escape.**
  The containment test was a hand-rolled `!path.relative(base, resolved).startsWith("..")` — the
  spelling `cli/inside.mjs` exists to replace — in a module that already imports `isInside`. A policy
  at `..policy/rules.json` is inside the workspace; it fell back, and was then told the manifest had no
  `gates` key. Two wrong answers in series. Pre-existing; found by review.

- **The undeclared-policy diagnostic asserted one cause for four.** *No manifest*, *no `gates` key*, and
  *a `gates` value the compiler refused* are three different situations, and all three were reported as
  *"`workspace.json` has no top-level `gates` key"* — telling the author of a manifest that did name a
  policy to add a key already there. Each arm now names itself, with its own remedy.

- **`portulan new gate-policy` emitted a scaffold that `portulan compile` refuses**, so the two halves
  of the documented path did not join up — and `new`'s own success message names `compile` as the next
  step. The skeleton declared `"portulan": { "gates": "1.0" }`, where the compiler reads
  `portulan.spec` and knows `2.1` and `2.2`; and a `floor` of `require_pull_request` /
  `block_force_push`, where the compiler reads `branch`, `checks`, `reviews`,
  `resolve_conversations`. Neither key was marked as a placeholder, so both read as already correct.

  A third fault sat under those two: no rule in the skeleton reached the `floor` it declared, so even a
  faithfully filled-in draft was refused. The skeleton now ships the force-push and ref-deletion pair
  filled in — the two destructive **ref** spellings the floor backend can express, and the pair the
  template's own closing paragraph already recommended starting from. (That backend also emits
  `pull_request` and `required_status_checks` for a `propose` rule once `floor.checks` is non-empty, so
  "the two it can express" would be too broad; the template's own wording said that and is corrected in
  the same change.)

  `cli/init.mjs`, `spec/slots.md` and this repository's own `gates.json` carried the correct shape
  throughout. Of the two carriers that *generate* a gate policy, the one with a compiling test
  (`cli/init.mjs`) was right and the one without was wrong; `spec/slots.md` is prose, and nothing runs
  prose either, so it is not evidence in this comparison. The scaffold's test was named *"a scaffolded
  gate policy parses AND compiles"* and asserted two object keys.

  **What the scaffold is now, stated precisely:** a draft that compiles **once the adopter fills the
  `{braces}`**, which is the step `new` already tells them to take. It is not a policy that compiles
  unfilled, and it was never meant to be — `compile` still refuses a `{rule-id}`. The defect was that
  filling it in *faithfully* still produced a refusal; that is what is fixed.

## 0.1.2 — 2026-08-20

**A release about refusing to guess.** Where a declared pack resolves both from a root discovered on
the host *and* from the repository's own tree, four tools — `compile`, `index`, `recipe-set` and
`skills-set` — now exit **2**, naming both roots and the two spellings that proceed, instead of
silently picking one. The silence was the defect rather than the ambiguity: on this repository's own
host it re-compiled a `git commit --no-verify` matcher the tree had deliberately removed, and
`skills-set` printed as its *remedy* the `--write` that deletes a tracked declaration. **This changes
commands that used to succeed**, and only on a host carrying both copies — a pack developer's machine,
which is where the hazard lives. Elsewhere nothing moves.

Beside that: the compiled artifact records which world compiled it, so a drift RED names a difference
its reader can find; the Stop-gate asks its questions about the tree the session actually worked in
rather than the one it was told about, closing a silent allow; and two entries replace expectations
about the second registry with what it was measured doing — a flag that is accepted and does not
govern, and a Packages sidebar that is empty for a reason no `curl` could have seen.

### Changed

- **`skills-set` refuses a shadowed pack too, and its printed remedy no longer strips a declaration.**
  The same discovered-first resolution reached this tool, and here it bit harder: the installed copy
  answers, it sits outside the plugin root, so containment fails and the tool concluded a **correct,
  tracked** skills path belonged to no composed pack — then printed `--write` as the remedy, where
  `--write` is the act that deletes it. Measured on a copy rather than argued: unpinned `--write`
  exited **0**, reported success, and dropped `./packs/rituals/checkpoints/skills/` from
  `.claude-plugin/plugin.json`. It now refuses at resolution — **exit 2**, the artifact untouched —
  naming both roots and both spellings that proceed. Like `compile`'s, it fires **even where the two
  copies agree** — what differs is the REASON, and the message says which case it is. There, agreeing
  manifests still compile to different bytes because the artifact records the answering root; here the
  deciding fact is which side of the plugin root answered, so agreement cannot save it even in
  principle.
  ([#317](https://github.com/sleepy-panda-srl/portulan/issues/317))
- **`index` and `recipe-set` refuse a shadowed pack too.** The refusal below reached only
  `compile`, because neither of these resolves through `packContributions`. Both now exit **2** on the
  same terms — a declared pack answering from a root discovered on this host while the repository also
  carries it — naming both roots and the two spellings that proceed.

  **Their grounds differ, and the messages say so rather than repeating `compile`'s.** `index` digests
  the answering copy's memory scope into a **committed** index; it does *not* record which root
  answered, deliberately, so that the index regenerates identically on two machines. `recipe-set` is
  the sharper case: a composed recipe's `${PACK_ROOT}` expands to the answering pack directory, so two
  copies whose manifests are byte-identical still compose **run lines pointing at different files** —
  what CI runs and what a bare local run runs would diverge with nothing in either output to say so.

  **This changes commands that used to succeed** on a host where a declared pack is both installed and
  in the tree — a pack developer's machine, which is where the hazard lives. Elsewhere nothing moves.
  ([#318](https://github.com/sleepy-panda-srl/portulan/issues/318))

- **`compile` refuses a shadowed pack instead of picking one.** Where a declared pack resolves from a
  root discovered on the host *and* the repository also carries it, `compile` now exits **2** naming
  both directories by path, what differs, and the two spellings that proceed — `--pack-root packs` for
  the tree, which is what `verify/compile.sh` checks, and `--pack-root auto` for the installed copy.

  **This changes a command that used to succeed.** A bare `compile` on such a host previously wrote the
  discovered copy's policy and reported success; on this repository's own host that re-introduced a
  `git commit --no-verify` matcher the tree had deliberately removed as false coverage — a rule reading
  as protection and providing none. `--check` had explained the situation since the entry below; the
  **write** path had no warning at all, and it is the one that changes the world.

  The refusal fires at resolution, so `--check` and the write path answer the ambiguity the same way:
  refusing only on write would have left the check adopting the discovered world and exiting 1,
  asserting that the *repository* had drifted when it had not. It fires even where the two copies
  agree, because the artifact records which root answered — so agreeing manifests still compile to
  different bytes. A named root is unaffected: it replaces the derived one, leaving nothing to shadow.
  ([#316](https://github.com/sleepy-panda-srl/portulan/issues/316))

- **The compiled artifact records which world compiled it.** Pack resolution is discovered-first and
  first-match-wins, so an unpinned `compile` on a machine with the plugin installed **would read** the
  host's plugin cache while `verify/compile.sh` reads the tree — an arrangement the entry above now
  refuses outright — and the drift RED named a difference no
  reader could find in the repository, because the deciding input was a directory outside it. On this
  repository's own host the two had already diverged in substance: the cached pack carried a
  `git commit --no-verify` matcher the tree had deliberately removed. `$portulan.packs` now records,
  per declared pack, the **origin** it resolved from (`tree`, `discovered`, `outside-tree`) and the
  version its manifest declares — origins, never root paths, since an absolute path under somebody's
  home directory would make a tracked artifact machine-dependent and red the recipe everywhere. The
  drift RED names the origin difference and gives the pinned spelling, so its remedy no longer prescribes
  the act that caused it, and `doctor` reports a shadowed pack together with **what differs**.
  ([#264](https://github.com/sleepy-panda-srl/portulan/issues/264))

- **The Stop-gate asks its questions about the tree the session actually worked in.** Its root came
  from `CLAUDE_PROJECT_DIR`, which names the repository the hook governs — not always the working tree
  the session used, since a session in a git worktree has both. Where the told tree was clean and the
  session's own tree carried unrecorded work, the gate **allowed in silence**: a false green, and one
  the previous change could not reach, because its naming sentences fire only when the gate blocks.
  The tree is now resolved from the Stop payload's `cwd`, and the did-work and handoff questions follow
  it. **Only within the same repository** — `cwd` is the one input a gated agent can steer, so any tree
  it named would otherwise excuse work in the governed one; a foreign path degrades to the told root
  and says so. A payload with no `cwd` behaves exactly as before, silently. The refusal counter and the
  verify recipe deliberately keep the told root, the recipe because the gate runs it through `bash -c`.
  ([#220](https://github.com/sleepy-panda-srl/portulan/issues/220), second arm)

- **The GitHub Packages workflow now records what it actually did, in place of what it expected to
  do.** The workflow has now fired twice, and this records what it did rather than what it was expected to do.

  **`npm publish --access public` does not make a package public on GitHub Packages.** Measured
  2026-08-18 on the first fire: npm sent the flag and reported *"Publishing to
  https://npm.pkg.github.com with tag latest and public access"*, the publish succeeded, and the
  package's `visibility` came back `private` — on a repository that was already public. Two manual
  steps made it public, and **neither has an API**: an organisation-level policy change (until then
  the package settings page read *"Public — Setting is disabled by organization administrators"*),
  and then a per-package visibility flip. `PATCH /orgs/{org}/packages/npm/{name}` answers 404, the
  GraphQL schema's only package mutation is `deletePackageVersion`, and `/orgs/{org}/settings/packages`
  does not exist.

  The flag is **kept**: it is required on npmjs, where the same tree also publishes, and it costs
  nothing here. What changed is the claim about it. This is also the vindication of the post-publish
  visibility report added in the same release — it printed `visibility: private` on a run that was
  otherwise indistinguishable from success, which is the only reason any of the above was noticed.

  _Recorded because nothing this project ships predicted it, and the next release would otherwise
  rediscover it._

- **A public package on a public repository is still absent from that repository's Packages sidebar,
  for a logged-out visitor.** Measured 2026-08-19: in a signed-out
  browser that runs the page's JavaScript, the sidebar renders About, Topics, Resources, Releases (2),
  Contributors (3) and Languages, and **no Packages block at all** — zero package links, and not the
  empty state either. Meanwhile the package's own page serves full content anonymously at HTTP 200,
  and the API reports it `public` and repository-linked.

  **The instrument matters more than the observation here.** No `curl`-and-grep check could ever have
  answered this: the server sends the Packages heading as a **loading skeleton** which hydration then
  removes, so the raw HTML contains the word and the rendered page contains no block. Both halves were
  measured. A check reading the served bytes would have reported the heading present and concluded the
  opposite of the truth.

  **The mechanism, measured.**
  The anonymous repository page is served with **no package data at all** — its embedded payload
  carries no package key, so there is nothing for the block to render from. This is not a cache, not a
  hydration failure, and nothing about this package: it is public, repository-linked, and its own page
  serves 200 anonymously. GitHub's package *listing* surfaces require authentication even for a public
  package — `GET /orgs/{org}/packages?package_type=npm` answers **401 "Requires authentication"** — and
  a package's own page is a separately servable public route, which is why that one is 200 while the
  sidebar has nothing.

  **The block DOES render for a signed-in viewer, and that settles what this is.** The maintainer
  confirmed that the Packages block appears in his sidebar while signed in, which is what the
  mechanism above predicts: the anonymous page carries no package data, an authenticated one
  does. **So this is normal GitHub Packages behaviour rather than a defect, and nothing about this
  repository's configuration causes it or can change it.** The package is public, publishes on every
  release, and appears wherever GitHub renders package listings at all.

  _The precise claim is **"absent for anonymous visitors"**. One case remains untested and is named
  rather than folded in: a signed-in visitor who is **not** an organisation member. Between the
  anonymous case (absent, measured) and the member case (present, measured), that is the only cell of
  the table still empty._

## 0.1.1 — 2026-08-18

**A release cut to correct the registry's own front page.** `0.1.0` shipped with a `README.md` saying
*"The newest release entry is `0.2.0`"* — a sentence this file had already retired hours earlier, in the
same day's work. npm freezes a README per published version, so the registry served a wrong version
number about itself and no edit to `main` could change it. That is the whole reason this version exists,
and it is the second-order cost of the defect `0.1.0` recorded rather than a new one.

### Added

- **This release begins publishing the package to GitHub Packages as well, as `@sleepy-panda-srl/portulan`.** That
  registry requires the npm scope to equal the repository owner, and the owner is `sleepy-panda-srl`
  with hyphens while the npm organisation is `sleepy_panda_srl` with underscores — no single name
  satisfies both, so the same tree ships under two names.
  [`.github/workflows/publish-github-packages.yml`](.github/workflows/publish-github-packages.yml)
  rewrites `name` in the working copy at publish time, verifies the rewrite took before publishing
  anything, and is idempotent: a re-run of an already-published version reports and exits 0, because
  npm's refusal to overwrite a version is correct rather than an error.

  **Two costs, ruled on with both put to the maintainer first.** The tarballs are **not** byte-identical
  across the two registries — they differ in the `name` field by construction, so no sentence anywhere
  may claim otherwise; `pack-identity` compares a pack against the *tree* and is unaffected. And
  **GitHub Packages requires a token to install even a public package**, so that route does not carry
  the property the npmjs route does and that `README.md` makes a point of.
  npmjs stays the documented path; this is an additional route for people already inside GitHub's
  authentication.

### Changed

- **`README.md` and `CONTRIBUTING.md` are rewritten for a first-time reader.** Both carried the
  repository's own archaeology in the reading path — parenthetical corrections of counts the file had
  previously got wrong, and a visibility history restated in three places — which is the record's job
  and not the front page's. Every operative claim survives: the install paths, the eight subcommands
  and the issue links behind them, the three issue forms, `portulan feedback`'s digest and seam
  guarantees, the team-member discipline, `main`'s protection, and the security path. The record they
  were carrying is untouched in [`.portulan/handoffs/`](.portulan/handoffs/),
  [`.portulan/proposals/`](.portulan/proposals/) and [`docs/milestones/`](docs/milestones/).

- **The release number the tree states is `0.1.0`, in both places that state it.** `README.md` and
  [`.portulan/products/portulan/product.md`](.portulan/products/portulan/product.md) each said the
  newest release entry was `0.2.0` — a number this file retired on 2026-08-18, when the two prepared
  cuts that never shipped were folded into the first real one. Both are siblings of one defect and are
  fixed in one stroke. Nothing checks a release number written in prose against `package.json`, which
  is why this is the second correction of the same sentence.

### Added

- **A `SECURITY.md`**, so the Security tab and GitHub's community-standards checklist stop reporting
  that this repository has no policy. It states the reporting channels in the order a reporter should
  try them, and it names what it does *not* offer — there is one maintainer and no rotation, so it
  promises acknowledgement rather than a response time nobody is staffed to meet. Two properties are
  named as limits rather than sold as guarantees: a verify recipe's `run` is arbitrary shell, and the
  compiled enforcement is a host's permission table rather than a sandbox.

  **It is the only carrier of that procedure.** `CONTRIBUTING.md` kept the one-line instruction and
  cites it; `README.md` and the bug issue form point at it. The first draft of this change left
  `CONTRIBUTING.md` restating all three steps, which would have created a second full carrier of one
  procedure in the same change whose message argues against exactly that — and the drift was already
  observable, since the three surfaces had begun to disagree on the opening sentence.

## 0.1.0 — 2026-08-18

**The first release, and the first version — corrected on the maintainer's ruling of 2026-08-18.**
This file previously carried two release headings, `0.2.0 — 2026-07-29` and `0.1.0 — 2026-07-26`.
**Neither was ever released.** Measured at the correction: `git ls-remote --tags origin` returns
nothing and `gh release list` is empty, so no tag, no GitHub release and no registry entry ever
carried those numbers. They recorded cuts that were prepared and never shipped.

Publishing `@sleepy_panda_srl/portulan` to npm is the first time any Portulan artifact leaves this
repository under a version, so it is **0.1.0**, and the two earlier headings are folded in below as
the development they actually were. Their content is unchanged and none of it is discarded — what
moved is the claim that they shipped. _(The package also changes scope here: the npm organisation is
`sleepy_panda_srl`, while the GitHub organisation remains `sleepy-panda-srl`. The repository URL is
unaffected.)_

### Added

- **`@sleepy_panda_srl/portulan` is on the npm registry**, published `0.1.0` on 2026-08-18.
  `npx @sleepy_panda_srl/portulan` is a live path — demonstrated from a directory containing no git
  repository, which is what milestone 7 named as its undemonstrated clause and what
  [#242](https://github.com/sleepy-panda-srl/portulan/issues/242) was filed to route. Both are closed
  by it.

  **The same-bytes claim is now measured against the registry rather than against `npm pack` alone.**
  The published tarball and a fresh pack of the same tree hash identically —
  `b3790b7159b9e3ba7199c6901a01cee554fe6a3c` — and every file in it compares byte-for-byte
  ([#149](https://github.com/sleepy-panda-srl/portulan/issues/149), where the measurement also
  corrects this repository's recorded belief that a tarball hash cannot be reproducible: true of
  `tar`, not of `npm pack`, which normalises mtimes and ordering).

  What the package contains is narrower than what the repository holds: no test suite, no fixtures,
  and none of the evaluation-bundle issuer machinery — an npm consumer receives the eight
  subcommands, not the stamp press.

### Changed

- **The Stop-gate no longer demands a handoff from a session that did nothing, in a repository that
  rebase-merges.** Its third did-work signal asked `git log HEAD --not --remotes` — a *reachability*
  question. A rebase-merge rewrites commits, so a merged branch's originals are on no remote, and once
  the remote branch is deleted on merge they never will be: every commit of every merged-and-deleted
  branch satisfied it **permanently**, and any checkout left on such a branch reported *did work*
  forever. The signal now compares by **patch-id** (`git cherry`) against the remote's own recorded
  default head. A repository with no remote still reads every commit as work, unchanged. Where the
  comparison cannot be made the gate **keeps the blocking reading and says which comparison failed** —
  `git cherry` on an unknown ref exits 128 printing nothing, so counting `+` lines alone would have read
  a failed command as *nothing unmerged*, and that direction would have turned a case that blocks into
  a pass. A refusal now also **names the working tree and branch it read**, and reports a handoff dated
  today carried by some other ref already on disk, because the sentence was once true about a tree the reader was
  not thinking of. (first arm of [#220](https://github.com/sleepy-panda-srl/portulan/issues/220), which stays open: the
  gate still scopes both questions to the told-or-cwd root, and where that tree is clean while the
  session's work sits in a divergent live tree it allows silently — the naming arms fire only on the
  block path)

- **`doctor`'s enforcement report now counts the gate policy a workspace *yields* — declared plus
  composed — rather than the rules its own `gates.json` declares.** Measured before the change on
  `d5a5eb7`: it printed `Claude Code: 10 of 23 rule(s) compiled … → .claude/settings.json` while that
  file carried **eleven** rules' compilation, and it reported **3** uncovered gates where
  `compile --matrix` reported **4**. An arrow naming an artifact beside a number that was not that
  artifact's. Composed rules are now **attributed to the pack that contributes them**, so a reader knows
  which file to change, and the sentence says *policy this workspace yields* rather than *declared
  policy*. Counts and coverage remain reports and move no exit code. Composition runs through
  `compile`'s own `packContributions`/`composeFragments` rather than a second implementation.

  A workspace that composes gate-contributing packs while declaring **no** policy of its own is now
  reported too, instead of passing in silence — `compile` exits 2 on that shape, and `doctor` said
  nothing at all. Report severity, deliberately: `examples/` is that shape and a required recipe grades
  it every run.

- **`doctor`, `compile` and `index` answer `--help`**, on stdout, exit 0, in the shape the other five
  subcommands already used — `portulan.mjs` has always stated the contract ("asking for help is a
  request, and it succeeded"). `compile` previously answered `unknown argument "--help"`; `index`
  treated it as a workspace path and reported `cannot read --help/workspace.json`; `doctor` had no
  `--help` handling at all and fell through to its no-arguments usage line on stderr at exit 2.

- **`doctor` and `index` now refuse an unknown flag by name instead of swallowing it.** `doctor`'s
  parser silently discarded any `-`-prefixed argument it did not recognise, so
  `doctor --repo-rot /some/path` **dropped the misspelled flag and graded `/some/path` as a
  workspace** — a red verdict for a reason unrelated to what was asked. A typo in a flag is
  could-not-run, and each refusal names both real invocations.

- **A pack root is now discovered whether or not you ask, so `--pack-root` is optional where discovery
  finds one.** It was not optional before, and the measurement rather than the wording is what settles
  that: on the workspace `portulan init` drafts by default plus one pack of the adopter's own,
  `doctor` exited **1** with no flag and **0** under `--pack-root auto`, `recipe-set` and
  `skills-set --check` exited **2**, and `compile` composed the bound checkpoint pack's two gate
  fragments into nothing. Three of five tools were unusable without a flag whose value is a path nobody
  should have to know.

  **What `auto` still does, since it no longer unlocks anything: it selects the strict degrade.** Asking
  for discovery and being unable to look is **could-not-run — exit 2**, unchanged. Not asking and being
  unable to look keeps the `tree`-derived root and **reports the diagnostic** — never an empty set and
  never exit 2, because nobody asked and the readability of a host's record cannot be a precondition for
  grading a repository. One union order in both arms, discovered first.

  **A named root is untouched and still wins outright**, so *"this pack resolved from the feed"* remains
  unsatisfiable by a copy in the local tree wherever a root is named, and asking for a named root **and**
  `auto` is still refused.

  **Two things, stated at their real width because a bare-run verdict DOES move with the machine — by
  design, since this tool is a per-host capability report.** First, every **required** check names its
  root, which replaces every other source, so a required check cannot consult the host at all; that is
  what the old narrowing was really protecting and it is now carried by the pins rather than by the
  absence of a default. Second, `doctor`'s note-vs-fail distinction is keyed on a root's **origin** rather
  than on how many roots there are, so machine state can never turn a **miss** into a failure — a
  *discovered* root is nobody's claim about this workspace, and it can only turn a note into a
  resolution. Neither makes a bare run host-independent, and the second does not cover a *hit*: a
  discovered copy that resolves and is invalid FAILS, with its origin named, because that is a claim the
  pack's own files make — measured: `doctor --pack-root auto
  examples` exited **1** before this change and **0** after, because `examples` derives no root and the
  count-based key let host state flip a workspace's verdict.

  **What `init` does with it, and the line it may not cross.** The pre-draft resolvability check and the
  closing advice consult discovery, so an adopter on a host carrying the pack is told to run `doctor
  <workspace>` with no flag at all — and is told that the root used is the machine's, not the
  repository's. On the unasked path a pack that does not resolve is **advice and never a refusal**: `init`
  drafting on one host and refusing on another would make the existence of files a function of the
  machine. **The drafted files are byte-identical on every host** — advice may vary, files may not, which
  is [`docs/vision.md`](docs/vision.md)'s *no auto-generated curated context*.

- **`--pack-root auto` no longer turns a correct red into a green on a host it could not read.** Two
  fail-opens, measured on the workspace `portulan init` drafts by default plus one pack of the
  adopter's own. On a host whose installed-plugin record is **absent** — which is every CI runner —
  or **unreadable**, asking for discovery took a run that correctly exited **1** and made it exit
  **0**, by discarding the tree-derived root it already had; a pack that resolved perfectly well from
  the adopter's own tree stopped being looked at.

  **An absent record is now an answer, not a failure to look.** A host with no record is a host with
  nothing installed, so discovery reports *looked, found nothing* and the derived root survives.

  **An asked-for discovery that could not look is now could-not-run — exit 2** at every caller that
  builds a resolution plan. The user asked; the question is unanswerable; that is what the third exit
  code is for. It also keeps the promise `RECORD_VERSIONS` makes: on the day a host bumps its record
  schema, discovery stops loudly rather than silently converting every `auto` user to derived-only.

  **What did NOT change:** the unasked path, byte for byte. A run with no `--pack-root` resolves
  exactly as before. _(True of this change and no longer true of the tool: the entry above it, dated
  2026-08-13, makes the unasked path consult discovery. Kept as written because it is scoped to what
  **this** change did, which is the ordering that made it safe to land first.)_

- **`--pack-root auto` now searches the discovered roots *and* the `tree`-derived one, discovered
  first.** It replaced the derived root before. The change is a measurement rather than a preference:
  a workspace composing a cache-installed pack **and** a pack of its own — which is what `portulan
  init` drafts by default the moment an adopter adds one — had **no green `doctor` invocation** that
  did not require typing the host plugin-cache path by hand. All four arrangements were measured; only
  the one naming both roots went green, and one of those two is a path nobody should have to know.

  **A named root is unaffected and still wins outright**, so the property milestone 6 demonstrated —
  *this pack resolved from the feed*, unsatisfiable by a copy lying in the local tree — holds wherever
  a root is named. What the union trades is the weaker version of that guarantee, which `auto` alone
  used to imply. It is bought back in the form the original constraint asked for, which objected to
  roots being added **silently**: under the union, **every pack's resolution states which root
  answered and whether it was discovered or tree-derived**, as a field rather than a sentence.
  So `auto` no longer implies provenance, and a green under it certifies resolution rather than
  origin. What bounds a pack's content is unchanged and is the feed pin.

  **The unasked path is untouched by construction** — the union lives inside the branch `auto`
  triggers — so no required verify recipe begins reading the host's plugin record. _(Scoped to this
  change. The unasked path gained the union on 2026-08-13; what still keeps a required recipe off the
  host is that each one **names** its root, which the same day's pins delivered.)_

  **Asking for a named root and `auto` together is now refused (exit 2) in every tool that takes the
  flag** — five when this entry was written, seven since `recipe-set` and `init` joined them. They
  silently dropped the `auto` before, which is the behaviour this change is about, one layer up.

### Fixed

- **`skills-set --pack-root auto` was silently inert, and read the host to be so.** It passed a
  discovery result without asking for discovery, so the answer was computed and discarded and
  resolution fell back to the derived root with nothing said. The eager call also defeated the thunk
  that keeps unasked paths off the host's plugin record.
- **`init`'s closing advice contradicted a check `init` had already run.** After drafting a workspace
  that composes a checkpoints pack it said *"nothing resolves a pack for you … validation is RED until
  you name where it lives"* — unconditionally, including when `--pack-root` had just resolved the pack
  and `init` had verified it. It now prints the invocation that works, and offers `auto` rather than
  only `<dir>` where no root was named. Stale since discovery landed; found by running `init` on a
  never-seen repository rather than by reading it.
- **`resolverFor`'s `discovery` parameter could never be consulted** — `recipe-set` accepted it and
  passed it on without the flag that reaches it, so the pair looked wired and was not.

### Added

- **The evaluation-bundle cutter, `cli/eval-bundle.mjs`, with its verify rail.** Cuts a
  named-recipient, 90-day-term evaluation copy of the shippable payload from an explicitly named
  commit: the Apache licensing is swapped for a stamped per-copy `EVAL-LICENSE.md`, NOTICE and every
  machine-read `"license"` field are patched to `LicenseRef-Portulan-Eval`, the README's own License
  section is rewritten to describe the copy it is in, and a guard **refuses any cut in which a
  machine-read Apache assertion survives** — detected both as the canonical byte form anywhere and
  by parsing every JSON's `license` fields at any depth, because one spelling is not a category.
  `EVAL-STAMP.json` carries the recipient, the source commit, and a content digest reproducible
  from the commit plus the stamp's own recorded parameters — the tarball hash identifies one
  delivery; the digest identifies the content. The license text renders from
  `cli/eval-license.template.md` **as it stood at the payload commit**, never from the invoking
  working tree, so `source_commit` pins payload and terms as one sha and a later template edit
  cannot drift under an already-stamped bundle. The payload roster is **pinned in both directions**
  and enforced on every pull request by the new `eval-bundle` recipe: a new top-level path, or a new
  manifest asserting Apache, goes red with a repair menu instead of silently thinning or
  mislicensing the next bundle. Issuance stays a human act — the tool cuts and stamps;
  the issuance ledger, and all recipient data, live outside the repository permanently. In the tree
  on the maintainer's ruling of 2026-08-17, replacing the unreviewed, untested script that ran
  outside it.

- **`portulan`'s verify recipes name their resolution root.** A required check answers *does this tree
  hold its own claims*, so its verdict must not move with what happens to be installed on the machine
  running it — and a named root replaces every other source. Six invocations pin: the `doctor`,
  `compile`, `index` and `plugin` recipes, the CI workflow's recipe-set call, and the command the
  definition of done quotes. `cli/pinned-roots.live.test.mjs` fails if any of them drops it.

  Pinning also changes what the demo workspace's grade *means*: `examples/` was reported
  *unverifiable* and is now actually validated.

- **`recipe-set` takes `--pack-root`** (repeatable, `auto`, and the shared refusal when both are
  asked). It is the one carrier of the runnable recipe set and CI calls it, and it had no way to name
  a root while its resolver already accepted one.

- **`portulan upgrade` — the eighth subcommand, and the migration mechanics under it.** All eight names
  in `docs/vision.md` now dispatch. `upgrade` migrates a workspace in **either** residence: an in-repo
  one directly, and a `pointer` by resolving `governed_by` through the host's installed-plugin record
  and reporting with the resolver's own sentence.

  **`spec/migrations/` is new, and it is part of the Workspace Definition rather than part of a tool** —
  it ships in the package, so it reaches an `npx` user. This README's own promise that a directory
  *"arrives when a migration needs code"* is what admitted it: a step is a zero-dependency ESM module
  of one of **two kinds** — `version` (a MAJOR migration) or `repair` (something a rewriter owes a
  workspace it touched). Two ship: `1.0 → 2.0`, the one migration the spec documents, and the
  re-derivation of the machine-local bundle path `init` bakes into a drafted `verify/index.sh`.

  Three properties are the design, and each replaces machinery that would otherwise be needed.
  **Owedness is derived from the workspace's state, never from a stamp**, so there is no applied-ledger
  to keep in sync and nothing that can lie about what ran. **Every step is idempotent**, so a run
  interrupted partway is recovered by re-running rather than by a transaction. And **`owed` is
  three-valued** — `true`, `false`, and *could not tell*, which exits 2 and never green.

  What it refuses is as much of the contract as what it does. A workspace **ahead** of this bundle, by
  MAJOR or MINOR, is could-not-run: the CLI is the old thing, and the remedy names that. A workspace
  **behind** by a MAJOR that no step reaches is could-not-run too — either would otherwise plan to
  nothing and report *current*. A workspace `doctor` already reds is refused before anything is
  planned, so a red afterwards cannot be confused with one the migration caused. `--write` grades the
  result with the real `doctor` and **rolls back on a red**, reporting what it could not put back
  rather than claiming the tree is clean. **No MINOR is ever restamped** — a manifest declares the
  version its content needs — which is why `examples/` stays on 2.4 and `upgrade --check` says it owes
  nothing.

  **What is not demonstrated, said here rather than left to be inferred:** the `1.0 → 2.0` step has no
  subject in this tree or any we have seen — nothing declares 1.0 — so it is exercised against a
  fixture. The repair is exercised end to end on workspaces the real `init` drafts, with the drafting
  bundle deleted and the rail **run** before and after; it has no subject in this repository's own
  workspace, whose rail was hand-written and carries no marker.

### Changed

- **Workspace Definition 2.8 — the memory byte rail moves from the store to the record.**
  `memory.store.budget` gains an optional `record_kilobytes`: the most bytes any **one** record may
  hold. Additive — `kilobytes` stays legal and unchanged, nothing is defaulted, and every 2.7 manifest
  is a valid 2.8 manifest untouched. This repository's own workspace now declares `record_kilobytes: 8`
  in place of `kilobytes: 120`; `examples/` keeps `kilobytes` and stays on spec 2.4, so both rails have
  a live carrier in the tree.

  Why the axis moved. An aggregate over individually-authored records cannot see inside its units —
  the same hole `columns` closes for `lines`, one level down — and it lands on the wrong party: the
  record that grew to 15.7 KB never felt the total at write time, while three unrelated changes hit it
  afterwards, one with 551 bytes of headroom. It had also run out of legal repairs, which
  `spec/slots.md` had already named as the state that gets a whole recipe switched off. A per-record
  cap makes a breach **local** — record X over its cap never blocks writer Y — fires on the author
  growing the record at the moment of growth, and keeps a live repair menu: **split, compress, demote**,
  never a raise in the change that breached it.

  What a reader of this release gets, beyond the key: `index` reds name the record, its size, the
  overage and that menu, and report **every** over-budget record rather than the first; the scheduled
  librarian's weekly report gained a *largest record* distance naming the file it measured, which
  otherwise would have printed `Store: no budget declared` over a store that is fully railed;
  `core/skills/consolidate/SKILL.md` learned **split** as a move — the inverse of merge, asked as one
  question about granularity, and **before** compressing, because a record holding two facts reads as
  an incompressible one. Proposal `0025`, ruled on [#199](https://github.com/sleepy-panda-srl/portulan/issues/199).

### Fixed

- **The pack this project's private feed ships registered no skills, because its payload declared none.**
  `packs/` is installed as a plugin in its own right — the feed's entry is a `git-subdir` source rooted
  there — and it carried no `.claude-plugin/plugin.json`, so a host read nothing and reported `Skills (0)`.
  It now declares `./rituals/checkpoints/skills/`, the directory that actually holds them, because a host
  expands a declared skills path exactly one level. Measured both ways on Claude Code 2.1.226:
  `Skills (0)` → `Skills (3)`.

### Added

- **`plugin-lint --payload`**, for a plugin root a feed publishes rather than one that is its own
  marketplace: a missing `marketplace.json` becomes a counted `unverifiable` note instead of a failure.
  Opt-in and never inferred from an absent file. `.portulan/verify/plugin.sh` declares such roots in a
  separate `PAYLOAD_ROOTS` list and audits both against the tree.


**A pack root can be discovered instead of typed.** `--pack-root auto` reads the same installed-plugin
record the pointer half reads — `<config>/plugins/installed_plugins.json`, `CLAUDE_CONFIG_DIR` honoured,
no network — and resolves a pack against the plugin it was installed from, so an adopter no longer has
to know that the install landed at `<cache>/<marketplace>/<plugin>/<version>/` and repeat that path on
every invocation. It reads **both** shapes a plugin ships in: packs under `packs/` for a plugin that is
a repository checkout, and categories at the install root for a flat one, which is what this project's
own private feed actually ships. On `compile`, `doctor`, `index`, `init` and `vendor`.

Four limits, each a place this could read as more than it is. **Two of them were superseded before this
release was cut — see *Changed* above, and read that entry rather than the next two sentences.** They
are left standing because an `Unreleased` block is a ledger of what landed, and an entry rewritten to
match a later one destroys the record of what the first change actually shipped. **Precedence, never
union — named > discovered > derived:** a root you name is never overridden, and a discovered one
*replaces* the `tree`-derived root rather than being searched beside it, so *"this pack resolved from
the feed"* still cannot be satisfied by a copy lying in the local tree. **`auto` finding nothing yields
the empty set**, not the derived root. _(Both sentences are the state as of 2026-08-09. Since
2026-08-12 asked-for discovery is **unioned** with the derived root and `auto` alone no longer implies
provenance; the **named**-root half of the first sentence is the part that still holds.)_ **Discovery
runs only when asked**, so `--pack-root` is not literally optional —
what stops being necessary is knowing the path; that is narrower than the milestone row's wording and
deliberate, because an unasked-for discovered root would make `.portulan/verify/doctor.sh` read
`~/.claude` on every run and answer differently per machine. _(**Superseded 2026-08-13** — see *"a pack
root is now discovered whether or not you ask"* above. `--pack-root` **is** optional now; the narrowing's
stated reason was answered by **pinning that recipe's root** rather than by keeping the default. This
sentence is amended rather than left standing because it states a **current property**, and it and its
replacement sit under the same unreleased heading: a reader of one release would otherwise be given both
answers with nothing to choose between them.)_ And **`--repo-root` stays named-only**: a
repository checkout is not something a plugin record lists. Closes
[#123](https://github.com/sleepy-panda-srl/portulan/issues/123).

**A repository governed from a feed now boots to its workspace instead of to a note saying where it
is.** A `.portulan/workspace.json` of `kind: pointer` names the workspace that governs the repository;
until now nothing dereferenced that name, so `/portulan` reported *not installed here* about a
workspace that was installed. `cli/discover.mjs` reads the host's installed-plugin record — from disk,
never over the network — and resolves `governed_by` to the directory the workspace was installed to;
`doctor` reports the answer on a pointer, and the boot skill loads the workspace it names and produces
the report an in-repo workspace produces, saying which residence it came from and at what pinned
version. Four answers rather than two, because three of them are not *no*: **resolved**, **not
installed here**, **ambiguous** — two installs answering to one name are refused and both named, never
ranked — and **could not look**, which must never spend as absence. The match is on the governing
manifest's own `name` **and** its `portulan` version block — `workspace.json` is a common filename and a
file that merely shares it is not a workspace — constrained by the pointer's `feed` where it declares one,
and the candidate locations inside a payload are a named pair rather than a walk. It is **reported and never graded**: a
pointer whose governor is not installed is a correct pointer, so no host's install state moves
`doctor`'s verdict. What this does **not** do is default `--pack-root` from the same record — that is
[#123](https://github.com/sleepy-panda-srl/portulan/issues/123), and a discovered pack root that
silently joined the search would end the property that a named root **replaces** the derived one.
Answers the open half of [#134](https://github.com/sleepy-panda-srl/portulan/issues/134) — which the
maintainer closes, not a keyword, after that issue was already closed once by a retracted one.

**Copilot's findings become threads, and a thread blocks.** A suppressed low-confidence note
used to carry no thread, no Resolve control and therefore **no state** — nothing distinguished
*answered* from *ignored*, and `CLEAN` could be true with several unread. Each one is now promoted to a
review comment at its `file:line` by the agent identity, deduplicated on path, line and a checksum of
the text so a re-raised note does not become a second thread, and gated by
`required_conversation_resolution`. That is the maintainer's ruling of 2026-08-07, shape 1 of
[`.portulan/proposals/0021-the-suppressed-channel-needs-a-state.md`](.portulan/proposals/0021-the-suppressed-channel-needs-a-state.md),
taken over an aggregate thread per round with the price stated first: on
[#167](https://github.com/sleepy-panda-srl/portulan/pull/167) it would have been 26 threads on one
pull request. Rule 3 of `a-review-loop-needs-a-bound.md` is amended in the same change, and the
reasoning it replaces is kept rather than tidied away. A note the diff cannot carry falls back to a
file-level comment and then to a batched pull-request comment, which is **surfaced but not gated** — so
promotion is best-effort and the fallbacks are named rather than implied. Where the App credentials are
absent the notes stay in the review body exactly as before. **Losing one silently is the single outcome
refused**; gating every one of them is not claimed.

_Why a relay rather than asking Copilot to post them itself: measured 2026-08-08, the
`copilot_code_review` ruleset rule takes `review_draft_pull_requests` and `review_on_push` and nothing
else, and no Copilot settings endpoint exists at repository or organisation level. Suppression happens
on Copilot's side before anything here sees the review. If that knob ever appears, this machinery is
deleted rather than adapted._

**The boot reports the pack layer, and stops denying two things this project has.** `/portulan` read a
workspace's slots and never its `packs`, so the middle of the cascade — the layer between the engine and
a team's own policy — went unmentioned in every boot, and a reader could not tell a composed ritual from
an invocable one. It is now read and reported with its four limits — **the first has since landed and
the other three are still milestone 7's, owed rather than broken**: the root a pack resolves against was
discovered by nothing (closed by the pack-root entry above), a pack's skills register **only
where the plugin declares the directory that actually holds them** — a host expands a declared skills
root one level and no further, so a root naming a family of packs registers nothing, silently — its
personas reach the workspace's own layer but not the host, and its verify recipes are declared rather
than composed. Two claims in the same file pointed the other way and are retracted: that there is
no scaffolder, written one screen after naming `init` and `new` as built, and that memory has no
generated index, which milestone 5 built on 2026-07-28.

**And a pack's skills now register with the host — the depth defect behind
[#134](https://github.com/sleepy-panda-srl/portulan/issues/134)'s pack measurements, which is one
part of that issue and not the whole of it.** A host expands a declared skills root **one level**, so `./packs/rituals/` — with
skills at `<pack>/skills/<skill>/` — registered none of them while `plugin-lint` counted them all.
Measured on Claude Code 2.1.224 in both directions: `Skills (4)` before, **`Skills (7)`** after the
manifest names `./packs/rituals/checkpoints/skills/`, adding `pre-commit`, `session-open` and
`milestone-close`. `plugin-lint` now **fails** a skill resolved deeper than the host will look, with the
repair in the message — a validator counting more skills than the host loads is a green over skills
nobody can invoke.

_Two limits, because a fresh-context review found the first claim of this entry reaching further than its
evidence. **Registration is a property of `plugin.json`, not of a workspace's `packs` array**: the same
`Skills (7)` is measured from a directory holding no workspace at all, so this does **not** demonstrate
row 7's clause (b), whose subject is a *composed* pack in an *adopting* workspace — that parity is still
owed. And the always-on token cost of the public plugin moves **~590 → ~881** for every installer,
composed or not: the intent predates this change, since the pack directory was already declared, but the
effect arrives with it and no other carrier names it._

**The npm manifest states the version this repository is.** It said `0.1.0` while all three plugin
manifest fields said `0.2.0` — and `0.1.0` had already been released with different contents — so one
release train carried two numbers and `portulan --version` from a checkout printed the odd one out. It
now reads `0.2.0`.

**What that does and does not mean, because the difference is the whole decision.** `0.2.0` is the
newest *release*, not this tree: `## Unreleased` above has accumulated since 2026-07-29, so the manifest
names a shipped version **by design** until the next cut, and a checkout prints it. That is the
maintainer's ruling of 2026-08-07, taken over the two alternatives he declined — `0.3.0`, which would
make the first publish its own release, and `0.0.0` until first publish, declined because `--version`
would then be actively unhelpful from a checkout. Nothing was ever published under any of them: the
package is not on the registry.

**Why it drifted is the part worth keeping.** `plugin-lint` bound the marketplace's plugin entry to
`plugin.json` and **nothing bound either to `package.json`** — nor anything at all to the marketplace's
own top-level `version`, which perturbation found equally unguarded. A test binds both of those edges
now, and the third keeps its existing owner.

**And the ruling itself is railed, not merely recorded.** Three manifests agreeing says nothing about
the number being right — a cut cannot bump all three to a wrong version and stay green, because
`package.json` is now asserted against the newest `## <version>` heading in this file. That is the
chosen reading made checkable: *the manifest states the repository's current version*, so the two move
together at a cut. It deliberately does **not** check for a tag: the documented cut order renames
`## Unreleased` in a change merged *before* the tag exists, so a tag check would red every release at
the moment it is being done correctly.

**A fix is not done at the site it was found.** Core now states the rule the engine had only ever
practised: a rule holds where it is enforced, so a rule enforced in two places can be repaired in one,
and the site left standing is the one the next reader copies. One carrier and the others reach it — by
citing in prose, by calling in code — which is how
[`core/operating/evolution.md`](core/operating/evolution.md)'s *"impossible or caught"* reaches
*impossible* rather than merely preferring it. The checkpoints pack's pre-commit pass gains the step that
asks for it (pack `0.1.0` → `0.2.0`, since an install is cached by that version), and
`cli/collisions.test.mjs` pins the three `collisions()` that cannot be merged into one, so a future
divergence reds rather than drifting. The argument, the measurements and the honest limits — including
that **no rail can catch this class as a class**, because a rule has no token to grep for — are in
[`.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md`](.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md).

**There is a command line.** One entry point over the subcommands
[`docs/vision.md`](docs/vision.md) names. They dispatch, with each module imported **on demand** and each tool's exit code returned
**unchanged**; verified byte-identical to invoking those tools directly. **None is unbuilt any more** — `upgrade`, the last, landed at milestone 7 session 9 — and while any was, it was listed and **exited 2, naming the milestone it arrived at**, because a stub exiting 0
would be a fail-open exactly where a user trusts silence. That machinery is still in place for the next name the constitution carries ahead of the tree. `plugin-lint` and `librarian` are
deliberately *not* behind it: `docs/vision.md` is human-owned, so anything it does not name is the
maintainer's call. _(This paragraph said three dispatch and three exit 2, and then four and two.
Each was true when written and stopped being true in the next session. Corrected here rather than left
for the release cut, on this file's own accumulate-and-correct rule — and the counts now live in the
paragraph below rather than being restated in two places, which is what made them go stale twice.)_

**The list is eight.** [`docs/vision.md`](docs/vision.md) names all eight and is human-owned. It named
six when this entry was first written: `new` and `feedback` reached the CLI licensed by row 7 of
[`docs/plan.md`](docs/plan.md), and the maintainer folded both into the constitution on 2026-08-03 —
along with widening `vendor`'s gloss to cover materialising a workspace **out of** a repository as well
as into one, which is what lets the residence switch have a verb. Of the eight, **all eight dispatch** —
`init`, `doctor`, `compile`, `vendor`, `index`, `upgrade`, `new`, `feedback`. _(Six and two until
milestone 7 session 6, when `feedback` shipped with D3; seven and one until session 9, when `upgrade`
shipped with the migration chain. Corrected here under this file's own accumulate-and-correct rule
rather than left for a reader to trip over — twice now, in the same sentence.)_

**A workspace can move house, and `vendor` is what moves it.** One operation with a direction, which is
what the constitution's widened gloss describes. `portulan vendor <workspace> --into <dir> --host <id>`
writes a self-contained `AGENTS.md` beside a copied `.portulan/`, for a host that cannot install the
plugin: core's kernel inlined verbatim, your workspace's slots and recipes named, and the pack layer
named rather than composed — because a pack resolves from a feed at a pinned version and vendoring
resolves nothing. `--switch` instead changes **residence**, feed-side ↔ in-repo, under the contract
[`.portulan/proposals/0017-one-repository-one-governing-workspace.md`](.portulan/proposals/0017-one-repository-one-governing-workspace.md)
sets: the workspace is materialised at the new residence, a pointer or nothing is left at the old, and
`doctor` is green at **both** ends before the old residence's material is retired.

The residence is **never inferred from a path** — `--residence` is required, which is `init`'s rule for
`init`'s reason: a repository is governed by exactly one workspace, and the wrong guess is the dual
management the proposal refuses. What travels is the workspace byte for byte, except `workspace.json`,
whose `kind` and `tree` are the only two keys a residence actually changes — which is the proposal's
parity claim made executable rather than asserted. What does **not** travel is compiled enforcement:
`compile`'s output is keyed to the residence, so a copy of it would name paths for the residence it
left, and `vendor` retires it with the old one and says so.

**The limit, stated rather than discovered.** Governance is keyed on two manifests in two directories
and no primitive changes both at once, so a switch cannot avoid *some* intermediate state — either two
governing workspaces for a moment, or none. The ordering above chooses two, because `doctor --repo-root`
refuses that state by name while none is silent and, in the proposal's words, "looks identical to a
repository that never adopted Portulan". Every failure `vendor` handles leaves exactly one governor: it
stages and validates the copy somewhere that is a residence nowhere, so a destination that would not
have been green never becomes a second governor at all, and past the point where governance has moved it
goes forward and reports rather than undoing a completed flip. A crash inside the one `rename` leaves
two, and the recovery sentence is printed before that window opens.

**`compile` works in either residence, which it did not before.** `--workspace` now takes a repository
root **or a workspace directory**; it keyed on `.portulan` and so exited 2 — *could not run* — against a
feed-side workspace. Found by running the parity demonstration rather than by reading the compiler:
`doctor`, `index` and the workspace's own verify recipe were identical at both ends and this was not.
A feed-side workspace's compiled artifacts land beside it, because an installed plugin's directory is
the workspace root and they ship together.

**You can scaffold your own layer without editing one of ours.** `portulan new` writes a skill,
persona, pack, workspace, gate policy or repo card from a core template into a layer **you** own, and
refuses to write into `core/` — checked after path resolution rather than by pattern, so a `..` chain
and a symlinked destination are both refused rather than followed. Five of the six core templates did
not exist before this and are new. What it emits is a **draft**: the placeholders are yours, and
`doctor` is what says whether the result is any good.

**`doctor` opens a pack's skills and personas instead of counting them.** A skill's frontmatter, a
persona against the five-part contract in [`core/personas/README.md`](core/personas/README.md) — tools
allow-list, charter, autonomy reach, memory scope, read/write posture — and the tier no role may claim.
Opening those paths is what makes containment `doctor`'s problem, so the resolve-then-compare check
lands in the same change, and a skills root that cannot be read is reported **unread** rather than
counted as empty.

**`init` drafts a workspace for a repository that has none.** It **asks** where the workspace resides —
in the repository, or in a workspace that names it — and writes a full workspace or a pointer
accordingly. **There is no default residence**: a repository is governed by exactly one workspace, so
the answer that decides which cannot be guessed at, and a run without one exits 2 asking the question.
A codebase scan reads what the repository says about itself and writes down what it could **not**
determine rather than inventing a plausible build command. Three refusals stand ahead of the first byte
written: a repository already carrying a workspace or a pointer is never overwritten — moving between
residences is a switch, and `vendor` is the subcommand that performs it; **no existing file is written
over**, because
"is this repository governed?" and "is it safe to write here?" are different questions with different
answers, and a `.portulan/` holding somebody's hand-written notes and no manifest answers no to the
first; and any answer that is empty or malformed — a name, a governor, a pack id — is refused at the
boundary rather than emitted for a validator to choke on. The manifest is written **last**, so a run
that fails part-way leaves something a person can clear rather than a torso that reads as a workspace.

The drafted workspace **binds the checkpoint ritual by default** and can opt out with `--no-cycle`; it
carries a gate policy that compiles on both backends, a handoff series, and a verify recipe that
**exits 2 until the adopting team says what green means for their repository** — a stub exiting 0 would
put a false green under every gate on the day the workspace was created. What it deliberately does not
carry is a working **session-end gate**: the runner that enforces it ships in no artifact an adopter
receives, so the draft names where that arrives instead of implying a wire that is not there. **At a
terminal it interviews**: anything the flags did not answer is asked, with the derived default offered
where one exists, and nothing is written until a confirmation that echoes every answer. Where stdin or
stdout is not a TTY nothing is asked and the refusals are exactly what they were — a prompt loop cannot
be run by CI, by a test or by a headless host, which is why the substrate was built first and why
`--no-interview` exists for a terminal that wants the flags path. _(This paragraph said there was no
interview and that the substrate was all that shipped. True from milestone 7 session 1 until session 7,
and corrected here rather than left standing in the section this file's own header says accumulates as
changes land.)_

**It ships as zero-dependency ESM, and that is now a ruling rather than a "for now".** Settled
2026-07-31 against [`.portulan/identity.md`](.portulan/identity.md)'s older *TypeScript on Node*
line, on the ground that file already gave: a build step would end this repository's ability to be
checked by cloning it. `package.json` declares the `bin` and **no dependencies** — `npm install`
fetches nothing, and every tool still runs as `node cli/<tool>.mjs` from a fresh clone. **And it makes
the packaged artifact checkable:** `npm pack` yields 72 files, **all 72 byte-identical to the tracked
tree**, `package.json` included — so *no build step* is a property an adopter can verify rather than a
claim they have to take.

**One repository, one governing workspace.** A team's workspace can reside in two places — in the
repository, or feed-side in a portfolio workspace that names it — and a customer may switch between them.
What is now refused is **both at once**. The two residences are one artifact differing in reach and
delivery, never in what the workspace contains, so a second copy is one thing written down twice with
nothing holding the copies in agreement. Recorded as
[proposal 0017](.portulan/proposals/0017-one-repository-one-governing-workspace.md), from the maintainer's
ruling of 2026-07-30.

**Workspace Definition 2.7 — the `pointer` kind.** A fourth `kind` that governs nothing: it names the
workspace that governs this repository, through a new `governed_by`, and carries no slots of its own. A
MINOR: `slots` and `verify` move out of the top-level `required` into a `oneOf` branch that re-imposes
them on all three governing kinds, so no manifest that was valid becomes invalid and no migration is owed.
`examples/` stays on 2.4, untouched. One cost, stated: a `kind` in neither form's enum now produces two
errors rather than one, the precise `/kind` error unchanged and still first.

**`doctor` refuses double governance.** A pointer carrying governing slots, and a governing workspace
carrying a `governed_by`, are both RED with the rule's own sentence. With the new repeatable
`--repo-root` — named roots, never discovered, exactly as `--pack-root` — a repository that a workspace
*names* is also checked: a full workspace there, or a pointer aimed at a third workspace, is RED. Without
that flag the check **reports that it did not run** rather than passing quietly. A pointer skips the
governing-workspace checks and says so; a workspace that names its own repository is not two managers.

**Booting a repository whose workspace lives elsewhere.** The `portulan` skill recognises a pointer,
reports which workspace governs and that it is not installed here, and distinguishes that from a
repository with no workspace at all. It does not fetch: resolving a pointer needs a host's plugin cache,
which arrives with the CLI at a later milestone.

**The loop's full lane gains a third obligation: the verdict comes from a context that has not seen the
implementation.** Beside the written plan and the failing test,
[`core/operating/loop.md`](core/operating/loop.md) now says who may supply a verdict — a fresh window, a
different agent, or a human — because one primed by the implementing context measures agreement rather
than correctness. The **triage lane is untouched** and so is the Stop-gate: the lane system is the valve
that keeps this off one-line fixes, and where that lane begins is still the adopting workspace's
threshold. [`core/operating/verification.md`](core/operating/verification.md) carries the companion — the
hierarchy orders the *evidence* and says nothing about who may certify it, and that certifier has a
ceiling of its own. It is a limit on the verifier, **not** a fourth rung: a fresh reviewer of an
unexercised change still has nothing to grade.

**The development cycle Portulan builds itself with is now doctrine an adopter receives.**
[`core/operating/evolution.md`](core/operating/evolution.md)'s *Portulan is customer zero* paragraph was
self-description; it is now a stated principle — work is agent-drafted and fresh-context-graded at three
moments (the plan, the diff, the exit criteria), the unit of work carries hard exit criteria fixed
before it starts, and every session ends by writing the record. Core states the principle and names no
ritual, no pack and no model; a workspace composes its checkpoint ritual, sets the threshold and says
who grades. Nothing here is enforced by machinery, and both proposals say so rather than implying a
rail: no permission rule can observe whether the context reading a checkpoint has already seen the work.
Arguments and limits — including that the evidence is one team's fortnight, n=1 — in
[`0018`](.portulan/proposals/0018-a-verdict-from-the-context-that-did-the-work-is-not-a-verdict.md) and
[`0019`](.portulan/proposals/0019-the-development-cycle-is-doctrine-not-anecdote.md).

**Packs become real: the cascade's middle layer.** `core < pack < workspace` has been the architecture
since the constitution and was implemented in nothing — a workspace's `packs` array was a list of names
that `doctor` counted. Now [`spec/pack.schema.json`](spec/pack.schema.json), the **Pack Definition**,
says what a pack contributes to that cascade: skills, personas, verify recipes, and gate-policy
fragments. A declared pack **resolves** to a manifest, validates against the Definition, and its
contributions reach the tools that consume them — **which is two of the four, and the Definition now
says so kind by kind**: `compile` merges gate fragments, `index` opens personas, and skills and verify
recipes are declared and consumed by nothing. **Milestone 7 now commits a consumer for both**, which
is a change from what this entry said while it was being accumulated: row 7's clause (b) requires a
composed pack's skills to be invocable with parity to a core skill, and the maintainer's ruling of
2026-07-31 added verify-recipe composition — additive-only, namespaced by pack, never the workspace's
`verify.default`. The declare-only state is now a gap with a date on it rather than one nobody had
undertaken to close.

**A pack's gate fragments may only ever add restriction.** A pack contributing to the gate map means an
installed dependency can change what an agent is allowed to do, so the rule is that a pack may raise a
tier or add a prohibition and may **never** demote one. Enforced on two axes and in two layers: `auto` is
absent from the fragment tier enum, so a demotion to unattended is unexpressible in a manifest at all;
and [`cli/compile.mjs`](cli/compile.mjs) refuses — loudly, at build time — both a weakened tier and a
**changed action**. That second axis is the one a tier-only check misses: raising a rule's tier while
replacing what it matches removes the gate and still reads as a tightening.

**The first pack: [`rituals/checkpoints`](packs/rituals/checkpoints/README.md).** The supervised-build
ritual this project runs on itself, now a distributable artifact — session-open, pre-commit and
milestone-close skills, a `supervisor` persona, and the verdict vocabulary. It carries no Sleepy Panda SRL
specifics and does not set the adopter's triage boundary, because a ritual that cannot scale down is one
that gets switched off wholesale.

**A pack now resolves from a private feed, and the feed points rather than copies.** The
`portulan-internal` marketplace publishes the checkpoint ritual pack by sourcing this repository's
`packs/` directory through `git-subdir`, pinned to a commit — so the private feed owns the entry, the
version, the pin and the access gate, while the bytes stay in the public layer that authored them. The
alternative, copying universal content into the private side, would have put a second carrier of one file
where no public check can see it. Measured on Claude Code 2.1.220 before it was relied on, including that
a `sha` pointing at a commit from before the pack existed is **refused**.

**The two feeds point one way only, and `plugin-lint` enforces it.** The private feed sources a pack from
this repository; no entry in this repository's marketplace may be sourced from a private feed. A public
entry pointing into a private one is a dead pointer for every stranger — the fetch 404s on a repository
they cannot see — and publishes the private feed's structure besides. Neither is visible from inside this
tree, so it is a refusal rather than a note. Preventive: no such entry has ever existed.

**`--pack-root` on `compile`, `doctor` and `index`.** A resolution root can now be named on the command
line, and a named root **replaces** the one derived from `tree` rather than being searched ahead of it: when
one is given, the derived root is not searched at all. The resolver has taken roots as an argument since the
Pack Definition landed and nothing set them, so the from-a-feed case existed in the code and had no way in
from a shell. Replacement rather than precedence, on purpose: a demonstration that a pack resolved *from the
feed* must not be satisfiable by a copy sitting in the local tree at all. Two of the three tools replaced and one appended when this first landed — a workspace with the
pack in its own tree compiled green against an empty named root — so the divergence is now pinned by a test
rather than held in line by prose. What is still not built is *discovery* — nothing finds a
host's plugin cache on its own.

**Workspace Definition 2.6: a pack-declared memory scope lands in the adopter's own layer.** Two optional
keys — `slots.personas`, the layer, and `personas.index.path`, a generated index over it. A persona shipped
by a pack declares its memory scope in prose; a composing workspace now lands one **empty** directory per
declared scope in the layer it owns, and the index makes the arrival checkable: every field on a line is
derived from the pack, including a digest over the scope's own text, so a pack that rewords a scope turns
the byte comparison red. The location is **named**, not linked — an empty directory is not something git
carries, so a link would resolve only on the machine that generated it. A sweep reports any location no composed persona declares, and a pack that ships
memory records of its own is refused — storage follows ownership in both directions. Nothing reads these
locations yet: `doctor` validates a persona against its five-part contract at milestone 7, which is the
maintainer's *"row 6 declares, row 7 validates"* split. A MINOR: nothing tightened, no migration owed.

**A pack can ship skills at last.** A declared skills path resolved one level down, so the natural pack
layout failed as *"has no SKILL.md"*. The walk is now bounded at three levels and **reports where it
stopped** rather than going green over what it did not reach.

**Version trains split.** The Pack Definition versions independently of the Workspace Definition, which
stays at 2.5 and is byte-unchanged: one number governing both contracts would make a bump in either mean
a change in the other.

### Development cut as 0.2.0 on 2026-07-29 — prepared, never published

**Two milestones and the reconciliation that followed them** — milestone 4 closed 2026-07-28, milestone
5 closed 2026-07-29. [`docs/plan.md`](docs/plan.md) carries the signed close verdicts and
[`docs/milestones/`](docs/milestones/) the evidence behind each.

_Grouped by what a reader gets, not by the session that shipped it. What this replaces led with
`Milestone 4, session 0 … the milestone is open` — a lead pinned to a session, stale the moment the next
one landed, which is what happened twice and is
[#94](https://github.com/sleepy-panda-srl/portulan/issues/94). **This cut is also that issue's
resolution:** rather than repair the section in place and leave two milestones sitting untagged against
Protocol → Versioning's "changelog per release", the maintainer ruled the release be cut. The accumulate
rule above governs the interval that starts here._

**The enforcement compiler.** [`cli/compile.mjs`](cli/compile.mjs) reads a workspace's gate policy and
generates the host's own enforcement. `.portulan/gates.json` binds actions to tiers in a **host-neutral**
vocabulary — `{"shell": "git push"}`, never a host's matcher syntax — so a second backend translates the
same policy rather than forcing adopters to rewrite theirs. Every rule ends as **compiled** or **refused
with a stated reason**, both printed, both asserted by the suite: a rule that goes in and produces nothing
would leave a policy that reads as enforced and a machine that enforces nothing.

**A Stop-gate that actually blocks.** [`cli/stop-gate.mjs`](cli/stop-gate.mjs) (then at `.portulan/compile/stop.mjs`; it moved at milestone 7 so adopters receive it) runs the
workspace's default verify recipe when an agent tries to end its turn, and blocks on red *or* on exit 2 —
"nothing looked" must never read as "nothing wrong". It also enforces the session-end handoff, which
`core/operating/loop.md` had promised to this milestone. Capped at three **consecutive** refusals **per
reason**, each reason's count clearing only when that reason's own condition clears, with an absolute
ceiling of nine that does not reset — because a host's end-of-turn event is not the doctrine's "task
finished" and a gate that cannot stop is a hang. _(Per-reason rather than per-session because the
session-wide count gave a missing five-line handoff three times the patience of a failing suite; the
asymmetry is the maintainer's own observation, and the generalisation is
[`.portulan/tasks/0007-per-reason-stop-gate-counters.md`](.portulan/tasks/0007-per-reason-stop-gate-counters.md).)_

**Workspace Definition 2.1** — one optional `gates` key, additive. `slots.gates` keeps the prose that
argues the policy; `gates` points at the policy that compiles. Rule ids are cited from the prose and
membership is checked both ways.

**A sixth verify recipe**, `compile`, so a policy edited without recompiling fails CI with no workflow
edit — the fourth payout of the mechanism in proposal 0004. **A seventh**, `workflow-filters`, executes
every `jq` filter a workflow runs against fixtures rather than trusting it to be read correctly by eye —
a rail over the one layer of this repository that CI could not otherwise check, since a workflow's own
logic never runs until the event fires.

**The platform floor, compiled from the same policy.** A second backend emits an importable GitHub
repository ruleset — `pull_request`, `required_status_checks` (**strict**, unconditionally),
`non_fast_forward`, `deletion` — as [`.portulan/compile/github-ruleset.json`](.portulan/compile/github-ruleset.json).
It is positioned as the **floor**: what every host falls back to, and all that a host with no hook system
has. It **generates and never applies** — importing a ruleset is a repository-settings change, which is
outward and Gated. **Most of its rules refuse, and the refusals are the deliverable's honest half** —
each carries a reason scoped to *this export* rather than to GitHub, because the blanket version (*the
platform gates a ref, not a path*) is false. Coarseness is printed in both directions:
`non_fast_forward` is *stricter* than this policy, blocking a `--force-with-lease` spelling that is Auto
here. The live counts are `compile --matrix`'s to print and are deliberately not copied into this file,
which is how a figure goes stale in a second carrier.

**A per-host backend matrix and a degradation report.** `compile --matrix` is derived from the backends
rather than maintained beside them, and `doctor`'s `enforcement` check reports per-backend coverage plus
the **three gates neither backend compiles** — rename-or-transfer, spend money, send something outward.
Both name them, because a policy stating a gate that nothing enforces must never read as configured.

Two limits are shipped stated rather than discovered. A compiled permission rule matches a **spelling**:
the hook peels one shell wrapper and no more, and the platform floor is the only layer indifferent to how
a command was written. And nothing in CI can prove the host *honours* the artifact — CI installs nothing,
so that is measured at the supervised checkpoints and version-stamped.

**For anyone installing the plugin: nothing here enforces on you.** The compiled settings ship in the
payload as an ordinary file and are inert for an installer — measured, with a control. No `hooks/`
directory ships, and that is deliberate: a plugin carrying one has its hooks fire in *your* projects.

**A generated memory index, and a budget that is a rail rather than diligence.**
[`cli/index.mjs`](cli/index.mjs) emits a workspace's memory index from its store — every field on a line
derived from the record it points at, so there is nothing in the file an editor could put out of step
with the store — and judges it against budgets the manifest declares. `index` is the **eighth** verify
recipe, declared in the manifest so CI enforces it with no workflow edit, and it byte-compares the index
as well as checking the budgets: an index that is merely *stale* is as red as one that is over. **Two
axes rather than one**, because an index whose record count never moves cannot see a store doubling in
bytes — `index.budget.lines` rails the count, `store.budget.kilobytes` rails the size an index cannot
see, and `index.budget.columns` closes the hole a line budget leaves. None is defaulted, and a budget
that is not a positive integer is refused rather than read as absent, since `lines: 0` would otherwise
switch off the rail in the very key that exists to switch it on. **The permitted remedy for a breach is consolidation, never a budget raise in
the same change** — and that half is a human-gate rule, not a rail, because refusing a raise needs a check
that reads git history and such a check produces false reds in a shallow CI checkout. Both halves are
written down rather than one being implied by the other's green.

**A consolidation skill** — [`core/skills/consolidate/SKILL.md`](core/skills/consolidate/SKILL.md), the
procedure a breach is answered with. Steps 3 and 4 stay human.

**A scheduled librarian, with an identity of its own.** [`cli/librarian.mjs`](cli/librarian.mjs) reindexes
both series, ages every record from git, nags a sealed stamp's owner to re-validate, chases undecided
proposals and drafts demotions, and mines incidents and pull-request reviews into **candidates a human
files as proposals**. [`.github/workflows/librarian.yml`](.github/workflows/librarian.yml) runs it weekly
and files the result as a pull request. **A pass is a session**, so it ends with a dated handoff and one
Session log entry exactly as a human session does. It files as the `portulan-agent` GitHub App rather than
with `GITHUB_TOKEN`, because a pull request opened with the repository's own token **starts no workflow
runs** — so the two contexts the floor requires would never report and the pull request could never merge.
The pass keeps **no state between runs**: every figure is recomputed from git and the tree, which is why
two runs over an unchanged store produce byte-identical output.

**Proposals are pull requests.** `docs.sh` gained a `proposal` check requiring every proposal to name the
pull request that carried it, resolved through GitHub's own commit→pull-request mapping rather than from
memory.

**An index over the handoff series**, on the same generation terms as the memory index — but deliberately
**no budget**. A handoff series is append-only by construction, so every remedy a budget permits is barred:
retiring a handoff to buy headroom would either red the log↔handoff correspondence check or destroy the
record it exists to keep. A rail designed to be broken is not shipped.

**Workspace Definition 2.2 → 2.5**, every bump additive and nothing defaulted: `floor` (2.2) — and `strict`
is deliberately **not** declarable, so a policy cannot undo proposal `0011` in a diff nobody reads as one;
`memory` (2.3); `librarian` (2.4), carrying staleness intervals but **not** the cadence, because how often
a host runs a job is the host's scheduler and a cron expression in a file nothing reads is configuration
pretending to be policy; `handoffs` (2.5).

**The milestone table stopped being its own archive.** 55,643 characters moved **verbatim** out of the
milestone rows in [`docs/plan.md`](docs/plan.md) into [`docs/milestones/`](docs/milestones/), one file
per milestone — the row keeps the binding criterion and the signed verdict, the file keeps the
legislative history. The only edit permitted in the move was re-basing relative links one directory
deeper, and each re-basing was enumerated in the pull request that made it. `docs.sh` gained a `plan` check that holds the split: a Status cell is
capped at 500 bytes, amendment and session-note markers are refused inside a row, and an unparseable row
is refused outright.

### Known limits, stated rather than discovered

- **The CLI is still not the CLI milestone 7 describes.** `compile`, `doctor`, `index`, `librarian` and
  `plugin-lint` exist; `init`, `vendor`, `upgrade`, `new` and `feedback` do not.
- **No import has ever been attempted.** The ruleset export's acceptance by GitHub's importer is inferred
  from the documented schema plus an observed envelope, not shown. Exported-versus-live drift is compared
  by hand at the supervised checkpoints and by nothing automatic.
- **The cron has never fired.** Every librarian pass so far was dispatched by hand; the first natural run
  is 2026-08-03. Every staleness threshold is unfired on a store days old, so the nags were measured only
  under forced one-day thresholds.
- **Mining reads the smaller channel** — inline review comments carrying a path, never the suppressed
  low-confidence notes, which have in fact produced most of the real findings here.
- **Per-agent memory is still unbuilt.** `core/operating/memory.md` scopes memory per agent or persona;
  nothing implements it, and the doctrine names milestone 6 as where the first instance is *owed*.

### Development cut as 0.1.0 on 2026-07-26 — prepared, never published

The first tagged release. Pre-release in the SemVer sense — the `0.` major says the interfaces below
may still move, and the Workspace Definition has already had one breaking revision (1.0 → 2.0) before
any tag existed.

**The engine** — [`core/`](core/). An always-loaded kernel under a 60-line budget
([`core/engine.md`](core/engine.md)); six operating documents (the loop, autonomy tiers, verification,
memory, evolution, safety); three personas as context firewalls; two universal skills, `clarify` and
`codify`; five templates.

**The Workspace Definition** — [`spec/`](spec/), at spec version **2.0**. A JSON Schema over a named
subset of 2020-12, a per-slot document where every slot cites what it was derived from, and the
1.0 → 2.0 migration. A workspace declaring `kind: repository` must declare its `tree`; that constraint
lives in `doctor` rather than in the schema, because the declared subset has no `dependentRequired`.

**Two validators, neither a superset of the other** — [`cli/`](cli/), zero dependencies, no build step.
`doctor.mjs` validates a workspace against the definition and lints its claims against the tree.
`plugin-lint.mjs` validates this repository's packaging. Both exit `0` valid / `1` not / `2` could not
run, and the third code is never spent on a verdict.

**A demo workspace** — [`examples/`](examples/). A fictional urban-beekeeping co-op with two products,
written to exercise what this repository's own workspace cannot: repeated products, affordance
inheritance, declared packs, a sealed provenance stamp.

**The Claude Code plugin, and the marketplace that ships it** — [`plugin/`](plugin/) and
[`.claude-plugin/`](.claude-plugin/). A `/portulan` boot skill that loads the kernel and reads the
*project's* workspace rather than its own bundle's; the three personas bound as host agents; the
engine's skills shipped as the same files `core/` documents, never copies.

### Known limits, stated rather than discovered

- **The CLI is `doctor` and `plugin-lint` only.** `init`, `compile`, `vendor`, `index` and `upgrade` are
  named in the plan and do not exist. Nothing drafts a workspace for a team that has none.
- **No hooks and no settings ship.** The gate map is honoured by people and by review; the compiler that
  turns it into enforcement is milestone 4. Packaging a hooks file now would ship an enforcement that
  does not exist.
- **Nothing runs the verify recipes for you.** They are executable and CI runs them on every pull
  request; the Stop-gate that blocks a "done" claim on a red recipe is milestone 4.
- **Memory has no generated index.** Recall means reading the directory.
- **The repository was private at this tag.** It was to go public after a clearance tracked outside it. _(2026-07-27: it went public on the maintainer's directive ahead of that clearance — see docs/plan.md, Session log.)_
