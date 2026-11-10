# Core persona routing comparisons

This protocol addresses [#520](https://github.com/sleepy-panda-srl/portulan/issues/520).
The frozen [corpus](corpus.json) has three artifact tasks per core role and one
attempt per arm. The [grader](grader.mjs) checks semantic behavior: bounded
execution and nonmutation for implementer code, executable counterexamples and
a clean control for reviewer findings, and preservation, escalation and human
authority for librarian drafts. These observations do not establish general
quality or a reliability rate.

A is the shipped role: inherited model, undeclared effort, instruction floor
retained and five-minute cache lifetime. B requests medium effort on the same
concrete inherited model through one native foreground persona child. The parent
runs at high effort; host request metadata must establish effective child effort.
The `--agent` main-session override is not this mechanism. Each parent and child
has a fresh context. Case order alternates A/B then B/A; an invalid invocation or
failed semantic control stops acquisition without resampling.

The observed concrete model is Sonnet 5.5 on Claude Code 2.1.321. A medium win on
this model and corpus does not establish medium effort for other inherited
models. The product retains `model: inherit` and undeclared effort; no global
lower-effort default is earned here.

## Acquisition and accounting

Private originals retain the journal, CLI output, parent/child transcripts and
frozen source snapshots. Publication whitelists generic artifact answers,
numeric request metadata, normalized command arguments, timestamps and digests.
Answer presentation replaces only known acquisition and plugin-root prefixes
with `<acquisition>` and `<plugin>`; the record lists the affected answer and
retains both original and presented answer digests. Artifact contents and scores
are unchanged. Original answer wording otherwise remains.
Request identities and context identities are deterministically hashed; original
local paths, session identities and unrelated conversation content do not ship.
Public digests permit integrity checks; fidelity to private originals additionally
requires the independent acquisition review.

Acquisition fidelity **PASS**, signed `/root/checkpoint_520_open`, independent
read-only reviewer, 2026-11-10, for capture
`ff3688658bc20af6b78e834a5149ea6bd52bc88027b0340ec98cb52430c6d641`.
The reviewer independently checked all 80 requests (39 parent, 41 child), native
invocations, frozen sources, original answers, repair history and cost arithmetic.
The one disclosed citation normalization matches the deterministic transformation
and changes no JSON artifact or score. The checker and four capture/package tests
passed. This establishes retained-event fidelity; the sample, decoder repair,
reconstructed first-probe command and absence of billing evidence remain limits.

Two mechanism probes precede the eighteen quality children. The first used the
host's then-default Fable 5.2 and exceeded the configured one-dollar host-estimate
ceiling after a child ran. Its failed parent and child requests remain overhead;
it earns no quality result. Its command was reconstructed after execution from
the retained source, which was also snapshotted after execution. It is not a
contemporaneously recorded command. The second probe selected Sonnet 5.5 before
any quality outcome and demonstrated the native medium-effort mechanism. Quality
inference is limited to that model.

Every observed parent, child and probe request is counted once. The frozen price
vector is an index in uncached-input-token equivalents, not a price quotation or
subscription bill: uncached input 1, five-minute writes 1.25, one-hour writes 2,
unclassified writes 1.25, reads 0.1 and output 5. Registers separate observed
cost from a cold-normalized index. Normalization reprices all input in the first
request of each fresh parent and child context at 1.25, retaining subsequent
requests' observed classes and all output. Probe overhead is reported separately
from role comparisons. CLI USD values are host lifecycle estimates; they are not
added to these indexes.

## Disclosed decoder repair

After the first quality outcome, acquisition stopped because the original
decoder rejected a correct function inside one JSON fence followed by prose.
The task requested a JSON artifact without forbidding surrounding prose; the
original decoder already allowed a whole-answer fence. The retained answer
passed the unchanged semantic execution checks.

The [original grader](repairs/grader-before-decode-repair.mjs.txt) and
[first answer](repairs/first-control-answer.txt) remain. A bounded decoder repair
accepts exactly one JSON fence with prose and rejects competing artifacts or
ambiguous fences. Semantic predicates, cases and pricing code stayed byte for
byte identical. The original false score is preserved alongside the repaired
true score. An independent checkpoint approved the exact decoder and continuation
instrument hashes before the remaining seventeen untouched calls. The first
child is never rerun. This is a post-outcome instrument repair, not an unchanged
preregistration.

## Offline verification and delivery

The offline checker is `node cli/persona-routing.mjs --repo-root .`; it never
starts a host. It checks the immutable acquisition digest, all three role records,
semantic scores, generated registers, complete case/arm coverage, source and
binding bytes, effective effort, unique contexts/requests, frozen task bytes,
protocol snapshots, repair history and usage accounting. Exit 1 is a finding;
exit 2 is unavailable data or a failed read. The existing A/B recipe runs it.

The records and costs remain observations of source `01ca4887`; later bundle
changes are not new measurements. Current core charters must remain byte-identical
to that capture. A current plugin binding may change only its one nonempty,
single-line description scalar: every other byte, including tools, body and
context declarations, must match the historical binding. Malformed, duplicate,
missing or multiline descriptions refuse comparison. This permits the later
librarian description compression while preserving the acquired routing contract;
it establishes neither current whole-bundle costs nor equivalent automatic
delegation after description changes.

The npm payload carries the records, frozen protocol evidence, grader and offline
checker. Live acquisition and private normalization commands remain workshop
tools. A plugin update delivers the baked `agents/` files. The CLI's persona form
migration refreshes existing eligible bindings through the compiler planner:
core sources only in the installed engine's own tree, composed pack sources
through normal pack resolution. It creates no absent binding, installs no
foreign core adapter and changes no gate settings. The historical v0.2.0 suite
demonstrates actual check/write/check, idempotence, refusal and rollback.
