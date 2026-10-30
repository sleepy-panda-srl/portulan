---
name: delegate-local
description: Offload a bounded code transformation, verify-gated red-to-green edit loop, file/symbol summarization, or handoff compression to a local LLM (LM Studio / Ollama) via runner/local-llm.mjs. Use when a task is repetitive, single-file, or read-heavy so the parent frontier session avoids quadratic context re-read spend.
---

# Skill — Delegate Local

> Every turn in a frontier session re-reads the entire context (`m_r × (F·T + g·T²/2)`). This skill
> moves bounded, high-turn or read-heavy sub-tasks off the frontier context window and onto a local
> loopback model (`127.0.0.1:1234`) guarded by Portulan's verify recipes.

## When to use it

- **Verify-gated file transforms:** cleaning history comments, mechanical refactors,
  or adding unit tests where a verify recipe (`node --test ...`) can prove the edit green or roll it back.
- **Research digests (Context Firewall):** reading and summarizing a long file or log so only a 20-line
  digest enters the parent session's context window.
- **Librarian & handoff drafts:** compressing a session handoff under its byte cap or drafting a
  `codify` / `consolidate` candidate before human review.

Do not use for multi-file architectural planning, ambiguous requirements (`clarify`), or final pre-merge
review verdicts (`reviewer`).

## The pass

1. **Scope the input before calling the local model.** Never pass a whole file of 300 lines or more when a
   symbol span suffices: run `node <plugin root>/cli/symbols.mjs <file>` first and pass `--lines <start>-<end>`.
   Local KV-cache prefill scales linearly with prompt bytes; keeping the prompt under `32 KB` keeps
   time-to-first-token near one second.
2. **Choose the model by task shape (or verify with `eval`).**
   - Code transforms, test generation, and strict syntax: `qwen/qwen3.8-27b` (`--role code`).
   - Prose compression, librarian `codify` drafts, and research digests: `google/gemma-4-31b` (`--role prose`).
   - When onboarding a new local model, run `node <plugin root>/packs/tools/local-llm/runner/local-llm.mjs eval --model <id>` to grade it against Portulan's `code`, `codify`, and `handoff` predicates first.
3. **Attach a verify command whenever editing a file.** Run `transform --file <path> --verify "<cmd>"`.
   The runner applies the edit, runs `<cmd>`, retries with the compacted failure on exit `1`, and
   restores the original bytes if `<cmd>` never exits `0`.
4. **Read only the compacted receipt into the parent context.** On exit `0`, accept the single-line receipt
   and do not re-read the edited file unless a subsequent edit depends on its new line numbers.
   On exit `1` or `2`, escalate to the frontier implementer rather than looping locally again.
