# `doctor` fixtures

Material for [`../doctor.test.mjs`](../doctor.test.mjs). The task that produced `doctor` calls the
known-bad manifest **not optional**, and says why: *a validator that goes green on first contact with
a manifest written to satisfy it has demonstrated nothing.* So the first thing here is a family of
manifests that must fail, each isolating one violation, plus one that must pass — because a suite in
which everything fails is not a check either.

## Two shapes these files must hold, and neither is a style choice

The fixtures live inside a repository whose own verify recipes scan every tracked file, so a careless
fixture does not merely test badly — it turns CI red for reasons unrelated to any change under test.

1. **A known-bad manifest is well-formed JSON that violates the schema.**
   [`../../.portulan/verify/json.sh`](../../.portulan/verify/json.sh) parses every tracked `.json`
   file, so a fixture that does not *parse* would make the `parse` check permanently red. Bad against
   the schema, never bad against the parser. The one case that genuinely needs unparseable JSON is
   written to a temp directory at run time instead.
2. **Fixture Markdown carries no relative links.**
   [`../../.portulan/verify/docs.sh`](../../.portulan/verify/docs.sh) resolves every relative link in
   every tracked `.md`, and a fixture describing a repository that does not exist would fail it. Paths
   inside fixture Markdown are written as code spans — which is convenient as well as necessary, since
   an unchecked code span is exactly what the claims lint exists to check.

## What is here

| Path | What it is for |
|---|---|
| [`manifests/`](manifests/) | One manifest per schema violation, plus `valid.json`. Every file parses; every file but `valid.json` must produce at least one error naming the constraint and its location. |
| [`drifted-workspace/`](drifted-workspace/) | A whole workspace whose repo card claims a path its tree does not contain — the red path of the claims lint, which neither real workspace exercises, since customer zero passes it and the demo declares no `tree`. |

Cases that need a broken filesystem rather than a broken document — a slot pointing nowhere, a
directory slot pointing at a file, a workspace escaping its own directory — are built in temp
directories inside the test. They are not committed because a fixture is only worth committing when
its *content* is the interesting part.
