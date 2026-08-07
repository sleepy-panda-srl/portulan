# Handoff — one release train carried two numbers, and two of four fields had no check at all

Fifth handoff of 2026-08-07, and the second of three from one working thread — the maintainer asked for
the top three `Now` items one by one, one pull request each, and ruled that each carries its own handoff
and Session log entry. This one is [#177](https://github.com/sleepy-panda-works/portulan/pull/177), for
[#148](https://github.com/sleepy-panda-works/portulan/issues/148).

**State.** `package.json` reads `0.2.0`. Two version edges that nothing checked now have a test. Nine
recipes green, suite 1056.

## The value was his to choose, and the choice is recorded with what it declined

`package.json` said `0.1.0` while all three plugin-manifest fields said `0.2.0`, and `0.1.0` had
already been released with different contents. Offered the issue's three candidates, the maintainer
chose **`0.2.0`** on 2026-08-07, over `0.3.0` (make the first publish its own release) and `0.0.0` until
first publish (declined because `--version` would then be unhelpful from a checkout). Both declined
options are written into the `CHANGELOG.md` entry, per this repository's own standard for recording a
ruling — the alternatives are what make a decision legible later.

**The overclaim to refuse, and it is the issue's own title.** *"The package version names an
already-released number"* is **not** repaired by this change: `0.2.0` shipped 2026-07-29 and
`## Unreleased` has accumulated since, so a checkout still prints a release this tree is not. The ruling
adopts a semantics — *the manifest states the repository's current version* — rather than fixing the
stated defect. A pre-commit checkpoint caught the CHANGELOG entry claiming otherwise, under the headline
*"`portulan --version` names this tree"*, which was false in the file whose subject is a false version.

## The rail is the part worth having, and the first version of it was wrong

Nothing bound `package.json` to anything, which is why it drifted alone through a whole milestone. The
first attempt said so and added that this was *the one edge nothing checked*, on the reasoning that
`plugin-lint` binds the marketplace entry to `plugin.json` so the chain closed.

**The pre-commit checkpoint refuted it by perturbation.** There are **four** version fields, not three:
`.claude-plugin/marketplace.json` carries a top-level `version` as well as `plugins[0].version`, and the
top-level one is bound by nothing — not for agreement, not even for shape. Measured, each field set to
`9.9.9` against the tree as it then stood:

    package.json ................... every recipe green ....................... UNGUARDED
    marketplace top-level version .. every recipe green ....................... UNGUARDED
    marketplace plugins[0].version . `plugin` exit 1, `tests` exit 1 .......... guarded

The claim had been **reasoned from reading the checker** and was wrong;
[`../memory/a-checkers-coverage-is-measured-not-named.md`](../memory/a-checkers-coverage-is-measured-not-named.md)
is the rule, and it was broken in a comment that cited it. Both unguarded edges are bound now, and the
guarded one keeps its owner — the guarded row is one checker seen through two runners, not two checks.

## What the loop found

Two rounds, inside the bound, clean taper.

- **Round 1, inline:** the test was named *"every version field on the release train names the same
  version"* and deliberately does not check `plugins[0].version` — a name broader than what it does,
  which is the shape [`../gate-map.md`](../gate-map.md) names as this repository's recurring defect,
  arriving in the change that rails it. Renamed.
- **Round 2, suppressed:** a wrapped path in a code comment broke at a hyphen belonging to the filename,
  so a grep for the real name found nothing. Correct, and **declined at the time** under rule 3 —
  suppressed notes are never a reason to push again — then fixed here when the maintainer ruled that all
  the session's findings land in these pull requests rather than becoming issues.

`bug.yml`'s version placeholder, two tags stale, rides the same ruling.

## The gap that was named as undemonstrated, then closed

The first version of this handoff ended by naming what the rail did not do: it bound the fields'
*agreement* and said nothing about the number being **right**, so a cut bumping all four consistently to
a wrong number stayed green. That is now closed. `package.json` is asserted against the newest
`## <version>` heading in `CHANGELOG.md`, which is the one artifact that defines the maintainer's chosen
reading — *the manifest states the repository's current version*. Forced red in both directions: the
manifest moved ahead of the changelog, and the changelog moved without the manifest.

**A ruling nobody checks is a convention one release from being wrong**, and that is exactly how this
defect came to exist — `0.1.0` sat in the manifest through a whole milestone with nothing to notice.

**What it deliberately does not check, because it would be the wrong rail:** a tag. This repository's
documented cut order renames `## Unreleased` to the version in a change merged **before** the tag is
created, so a `git describe` comparison would red every release cut at exactly the moment it is being
done correctly. The heading is the authority here; the tag follows it.
