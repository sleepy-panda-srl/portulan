- **A `workspace.json` that does not parse stops `compile` before it writes or removes anything.** Run from
  the repository root, as the `compile` recipe runs it, [`compile`](../cli/compile.mjs) read a manifest it
  could not parse, or one that is not a JSON object, as one declaring nothing: a write removed every rule
  and skill it had compiled from the workspace's guidance, and the marker that records them, and compiled a
  `gates.json` found by convention in the manifest's place. It now exits 2 in write mode and under
  `--check`, naming the file and the parse error, and the fixture grader [`goldens`](../cli/goldens.mjs)
  exits 2 on the same manifest. A workspace with no manifest at all is unchanged.
