- **A `gates` value `compile` will not read stops it even where a `gates.json` sits at the conventional
  path.** A top-level `gates` key in `workspace.json` that is not a relative path to a file inside the
  workspace (a number, an empty string, a path out of it) sent [`compile`](../cli/compile.mjs) to the
  conventional `gates.json` whenever one was there, so the settings it wrote enforced a policy the manifest
  does not name, and `compile --check` stayed green. It now exits 2 and writes nothing, and the fixture
  grader [`goldens`](../cli/goldens.mjs) exits 2 in the same case. The gate hook still reads the
  conventional file, since it runs on every tool call.
