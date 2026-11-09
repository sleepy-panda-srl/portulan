# Task — offer the spend declaration at init

**Status.** Approved with the record correction below; finish and CI precede merge.

**Criterion.** [#514](https://github.com/sleepy-panda-srl/portulan/issues/514),
plan row 13 and proposal 0038 ruling 2: `init` offers the multipliers and horizon,
with exposed host pricing, a dated host/model table, then general figures.

**Acceptance criteria.**

- When drafting an in-repo workspace interactively, `init` shall offer each key
  independently and write only accepted answers.
- When drafting noninteractively, `init` shall offer without declaring; explicit
  flags and string answers shall declare either key at spec 2.12, with flags winning.
- When spend options are supplied for a pointer, or a spend declaration is invalid,
  `init` shall refuse before writing.
- When selecting pricing, `init` shall use the latest recorded main-context model,
  ignore synthetic/sidechain/foreign records and disclose unavailable or ambiguous evidence.
- When selecting an offer, a representable file override shall precede the dated
  table and the general fallback, with a test demonstrating each distinct branch.

**Plan.** Shared offline offer helper, init interview/flags/draft/report, regression
and integration controls, stale spec correction, CLI documentation and fragment.
Run all yielded recipes, independent pre-commit, seam scan and finish one labeled
PR. Row 13 remains open. No new job or live provider request.

**Session-open.** Independent `/root/checkpoint_514_open` returned
APPROVE-WITH-ADJUSTMENTS: use the recorded model rather than configuration;
bound file-based pricing and detect drop-ins; validate all host rates and exact
precedence; demonstrate all three sources; inject both host paths for hermetic
verification; preserve independent acceptance, EOF and refusal behavior. All six
are folded into the plan and implementation.

**Limits.** The local managed file can be superseded by uninspected remote,
MDM/registry, helper or embedding-host sources. Drop-ins are detected, not merged.
Provider aliases outside the supported exact IDs are not inferred. The offer is
conditional on the last recorded model and source, not a bill or a future model.
Native Windows discovery remains undemonstrated.

**Pre-commit.** Independent `/root/checkpoint_514_precommit` returned
APPROVE-WITH-ADJUSTMENTS on tree `448b6c92`: replace the acceptance paragraph with
EARS bullets and grade this record fold. All 32 actual yielded recipes were run;
30 were green and two failed solely on that task format. The full suite was
3,590/3,593 with the three failures naming that same defect. Guarded init/offer
tests passed 152/152 without attempts to access operator records or system pricing.
Seven deliberate source/precedence/acceptance/model mutations forced red; the
restored offer suite passed 12/12. No product-code defect was found. The limits
above remain. The corrected record, all recipes and refreshed CI precede merge.
