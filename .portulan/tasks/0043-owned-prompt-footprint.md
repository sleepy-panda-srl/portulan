# Rail the remaining owned prompt families

**Lane:** full · **Opened:** 2026-11-10 · **Status:** verified

**Goal.** Repair [#617](https://github.com/sleepy-panda-srl/portulan/issues/617), the missing owned
footprint checks from M12's independent closure review. Base `0d6b1e8572581d318dc461bfefdef7164d8472a1`
is PR #614's reviewed Stop diagnostics implementation. This item is stacked on that PR until it merges;
the child diff and eventual main-target checks must be revalidated after retargeting.

**Acceptance criteria.**

- When the context recipe runs, it shall preserve existing rails and judge fixed UTF-8 byte rails for
  registered skill bodies, persona charters/bindings, rendered native hook messages and vendored output.
- When enumerating bodies, it shall include manual-only skills before description filtering, both
  shipped plugin manifests, reachable depth-zero/one roots and composed persona sources, deduplicated
  physically with provenance. Missing, invalid, nonregular or escaping coverage shall return 2.
- When rendering hook profiles, it shall use the production native formatters and deterministic
  injected Stop executor outcomes, assert channels and silence, cover the registered runners, and
  distinguish operator stderr from agent fields. It shall read no real usage records or call providers.
- When rendering vendor profiles, it shall include bare and boot/tier output with the actual kernel,
  degraded output, all named schema slots and fixed adopter inputs. Actual CLI output shall match both
  successful profiles; a new slot without coverage shall refuse judgement.
- When each original closure growth probe is applied independently, its named fixed rail shall become
  red; restoration shall return green without raising a cap or refreshing a mutated golden.

**Plan and session-open.** Fresh Astra Extra High: APPROVE-WITH-ADJUSTMENTS, 2026-11-10. Folded the
six groups: repo-internal helper and existing recipe; pre-filter physical inventory including both
manifests and real/composed personas; actual native hook channels and bounded Stop branch; successful
vendor CLI byte identity and slot guard; all four mutation controls and honest finite-profile limits;
stack only on #614 and revalidate after its merge. Row 12 stays in progress. No schema or runtime cap
is introduced. Missing supervisor/local-worker bindings remain a separate compiler finding.

**Initial evidence.** The new test failed first because the helper did not exist. The six new checks
then passed, including all four original mutations through the same fixed-rail entrypoint used by the
recipe. The focused gate, Stop and advisory suites passed 152 tests. Both successful vendor profiles
were produced by the real CLI, not a replacement renderer. Baselines and aggregation are documented
in the verify README; complete verification and fresh pre-commit are recorded before commitment.

**Pre-commit revision.** Independent Astra Extra High: REQUEST-CHANGES, 2026-11-10, staged tree
`7d3b6bf3b7cd805a9583740cecc0228e4d885ff2`, patch SHA-256
`ba674bbc3141b6b165a70510c8031a488f61a90a5785a47a9367367948398032`.
All 32 recipes and both strict plugin validations passed, but independent attacks found invalid
metadata accepted, an intended silent Stop able to emit a native block, hard-link double counting,
contained documentation links mistaken for directories and external renderers accepted as owned.
Red-first regression controls reproduce those failures against the reviewed helper. The revision
requires named-object manifests and a documented fail-closed metadata subset, complete native Stop
channels, device/inode identity with alias provenance, contained-file skipping and regular in-tree
selected renderers. Twelve checks pass, including supported lists/blocks/nested maps and bare
charters. Caps and all four clean baselines are unchanged. The second independent grade follows.

**Second revision.** Independent Astra Extra High: REQUEST-CHANGES, 2026-11-10, staged tree
`2442b42d64ec6df95573086d402c32c3b428751f`, patch SHA-256
`8259323f058a4be26c675b871cca94933bcec4e2a933ba19b864a61947e470a1`.
All 32 recipes passed, but an external ordinary helper could skip the owned measurements entirely;
its self-check could not protect the caller. `context.sh` now independently checks the selected
helper before execution. Other red-first probes found embedded flow indicators, illegal block
dedents and malformed `contributes` discarding a charter. The metadata subset now refuses these
and their plain-scalar/empty-line/control-character siblings; a present contribution parent must
be a mapping. Selected modules are checked before any repository-local import, so an external
compiler's marker side effect never runs. Required tests retain the complete-recipe external helper
and import-order controls. All four original caps and clean figures remain unchanged.

**Third revision.** Independent Astra Extra High: REQUEST-CHANGES, 2026-11-10, staged tree
`d4633b3786ca4e7d12bc625f82d6e93bf2640bdb`, patch SHA-256
`0c5c26c6546a4eca176fa9659fb00b5486240a2727b48586ff92d76a4cb46bc5`.
All 32 recipes passed. Three additional invalid metadata forms passed judgement: a terminal colon,
a comment consuming a flow-array close and a dedent opening a nonexistent map level. Retained controls
now require refusal; plain colons and unquoted flow comments are outside the documented subset,
and dedents must land on an enclosing level. The complete consumer now preflights all eight selected
sources before any older context/init command can import them. Its external compiler marker remains
absent, and restoration returns green. Positive nested/sibling maps, quoted colons and normal lists
remain supported. The original rails and baselines have not moved.

**Final pre-commit.** Independent Astra Extra High: APPROVE-WITH-ADJUSTMENTS, 2026-11-10,
staged tree `442dcebfec6264c59fc3280b613dd521828fffb4`, patch SHA-256
`6cda953afcb724cfb5aa73cb5ca55a79ae784b44d92c36aac2812fbf40553daa`.
The reviewer verified the exact whitespace guard and retained cases in a disposable tree; adjustment
patch SHA-256 `2c17c3358c9280685323cfeb431a11b30d025600f32be858bff5574b15385857` was applied unchanged.
Space-only metadata, CRLF handling and the conservative subset are documented. The checkpoint
explicitly covers those folds and factual bookkeeping without a fifth broad grade. All 32 recipes,
3,663 tests, both strict plugin validations, original four growth/restoration controls, native output
identity, raw vendor identity and the full private seam scan passed independently. The adjusted
fourteen tests passed on Node 20.0.0 and 26.13.0. Five unsupported whitespace probes returned 2,
valid nested/quoted metadata and restoration returned 0, and caps/baselines stayed fixed.
General YAML, arbitrary transitive code confinement, variable runtime payloads, whole-host context,
live provider counts, missing compiler bindings and other M12 criteria remain outside this change.
Retargeting/rebasing after #614 and main-target checks remain required before merge.

The final reviewer-adjusted candidate passed all 32 yielded recipes on Node 22.23.4. The private seam
scan covers full staged files, their paths, the patch, branch and final commit/PR text. Finish reruns
the complete recipe set on its commit before pushing.
