# Repo — app

**What it is.** A fixture repo card. Everything below is written to be *checkable*, and one line is
written to be wrong: the layout names a directory this tree does not contain, which is what a repo
card looks like a few months after somebody moved the code and did not come back to the card.

**Build / test / run.**
- build: none — a fixture has nothing to build
- test: `./verify.sh` — exists here, so this claim passes
- run: none

**Layout.** `repos/` the cards · `src/does-not-exist/` the application code

**Provenance.** Written for `doctor`'s test suite in milestone 2. Drift is the failure the claims
lint was minted against, and neither real workspace can demonstrate it: customer zero passes the lint
and the demo declares no tree to lint against.
