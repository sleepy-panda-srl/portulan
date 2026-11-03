- **This repository composes [`tools/local-llm`](../packs/tools/local-llm/README.md), and its
  [`delegate-local`](../packs/tools/local-llm/skills/delegate-local/SKILL.md) skill registers.** Both
  plugin manifests declare the pack's `skills/` root, the pack moves to `0.2.0`, and
  `tools/local-llm:runner-rails` joins the runnable set with a forced-red drill. The skill's description
  names its precondition, a workspace composing the pack and a server on loopback, and room for it in the
  descriptions rail came from narrowing `clarify` and `consolidate`, not from raising the rail. The
  telemetry audit grades a recipe whose run line is a `node` invocation on that line, and rails every
  runner invocation but `--verify-offline` alone on its command as one that reaches the network.
