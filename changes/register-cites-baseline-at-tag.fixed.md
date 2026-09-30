- **A release's eval result no longer links a file its package does not carry.** The register each
  release ships in `evals/releases/` cited the A/B baseline as `../../evals/ab/baseline.md`, and the
  package carries no `evals/ab/`, so inside an installed package the link led nowhere
  ([#420](https://github.com/sleepy-panda-srl/portulan/issues/420)). From `0.2.0` a register cites it at
  the release's tag on GitHub, which resolves wherever the register is read once that tag exists, and a
  test checks each link a register renders against what `npm pack` ships.
  [`cli/release-eval.mjs`](../cli/release-eval.mjs) still renders `0.1.3`'s register with the relative
  link, byte for byte as npm froze it into that version's package.
