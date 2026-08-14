# Handoff — a ruling lands in three reviews, and the brief was wrong twice

**Post-M7 hardening, session 18. Full lane.** No milestone row moves. One ruling, three pull requests,
seven issues touched, and a tally in which the two errors that mattered most were the supervisor's own —
caught by the implementer checking a citation before transcribing it, which is the rule this very ruling
was about.

**The arrangement:** Claude Fable 5 supervised only and held every gate; Claude Opus 5 implemented. Every
outward action passed a gate as a **category**, not as a list — the practice 0029 asks for, applied to the
change that ratifies it.

## The ruling

The maintainer ruled proposal [`0029`](../proposals/0029-a-constraint-names-a-category-not-a-list.md)'s
three questions directly, 2026-08-14:

- **Q1 — the ENGINE.** The rule extends `core/operating/autonomy.md`'s existing paragraph and ships to
  every adopter. *Ground: the first half already ships there, and `0020` is the standing argument against a
  second carrier.*
- **Q2 — AUTHOR AND READER.** The converse binds the agent *reading* a constraint: an act's absence from a
  list is not a finding of permission. *Ground: a brief in flight is reachable only through its reader.*
- **Q3 — YES, it reaches this workspace's own gate spellings.** `commit-without-the-hooks` takes the
  `none`-action form. *Ground: hook-bypass spellings are unbounded shell, and the matcher gave zero
  protection in the measured incident while reading as coverage.*

## Where `main` went

`1693c86` → **`eaf0d0d`** (#262, the record) → **`458f3e6`** (#263, the doctrine) → **`6c540c9`** (#267,
the gates). Three merged, zero open. Suite **1590** throughout — the count never moved, and it was
re-measured on every tree rather than carried, including after the one rebase.

| PR | Rounds | Merged | Truth-read |
|---|---|---|---|
| #262 — the ruling record | 2 fix-rounds, 3rd empty | 12:29:05Z | `MERGED`, `eaf0d0d7`, cherry zero `+` |
| #263 — `autonomy.md` | 0 — its round found nothing, twice | 12:34:46Z | `MERGED`, `458f3e66`, cherry zero `+` |
| #267 — the gates change | 2 fix-rounds, 3rd triaged | 13:04:42Z | `MERGED`, `6c540c92`, cherry zero `+` |

Filed: **#264** (cache-vs-tree shadowing) · **#265** (pack version bump) · **#266** (`settings.json` names
one input of two) · **#268** (four directories in no `covers` roster) · **#269** (`gate.mjs` declares vs
yields) · **#270** (rule-4 triage). Evidence added to **#253**.

## The things worth keeping

### 1. The brief named a file the rule does not live in

The brief said to move `commit-without-the-hooks` from its shell matcher **in `gates.json`**. It is not in
`gates.json` — 23 rules, and not among them. It is a fragment in `packs/rituals/checkpoints/pack.json`, and
`doctor` says so in its own report: *"change them in the pack that contributes them."*

The question that mattered was not *where is it* but *could the workspace take it back*. Measured rather
than preferred: `composeFragments` (`cli/compile.mjs:1703-1789`) refuses a re-declaration that does not
tighten **and** refuses one that changes what a rule matches. **The pack is the only carrier the tree
admits**, which converts a would-be design choice into an implementation fact — and widens the blast radius
to every workspace composing the pack, stated in the PR body rather than left to be found.

**An enumeration named a file where it meant a rule, inside the change ratifying the rule against exactly
that.**

### 2. The brief quoted a sentence that does not exist

It instructed: note the follow-on reviews *"per the proposal's own 'the edit follows a ruling'"*. `grep -i`
over 0029 exits 1. **The phrase is nowhere in the file.** The real sentence, `0029:114`, is *"both are
deliberately not bundled, because each is a mechanism change that deserves its own review"* — same point,
different words, and it is what was quoted.

The supervisor named it as its own compression, quoted as if it were the source. **Checking a citation
before transcribing it is Q2's converse performed on the instruction carrying Q2.**

### 3. An offered precedent, narrowed by measurement

The supervisor offered *"s13's precedent — version not bumped on his ruling, the field is the release
number railed against three others"* for #265. Measured instead of transcribed: `plugin-lint.mjs:429-431`
rails a `plugin.json` version's **SemVer shape** (absence deliberately allowed), `:537-543` rails a
**marketplace entry against `plugin.json`** — and **nothing reads `pack.json`'s `portulan.version` at all.**
The issue cites the two commits that introduced `0.2.1` as *evidence to weigh* rather than asserting a
precedent nobody had traced.

### 4. Two instrument misses of mine, both caught by control before shipping

- **`node --test cli/`** exits 1 having run one pseudo-test. `tests.sh:19`'s own comment predicts it; the
  canonical spelling is `node --test "cli/**/*.test.mjs"`. Caught because the number looked wrong, not
  because I read the comment first.
- **Reading a recipe's exit through a pipe.** `./compile.sh | tail -3; echo $?` reported **0** while the
  recipe printed RED — `$?` was `tail`'s. Re-run unpiped: **exit 1** planted, **exit 0** restored. *A
  pipeline's exit is not its first command's, and a control that reports the wrong number is not a control.*

### 5. The claim about a future tree, measured instead of predicted

#262 had to state the ruling's own price — the uncompiled count moving 4 → 5 — before the change that
moves it existed. Rather than assert it: the `none` form was applied to a working copy, both printers run
**pinned**, **5** observed in each, then reverted — with the patch's sha256 **identical before and after**
as the proof nothing leaked. It also de-risked #267 an hour early.

### 6. A record of a decision reading as a report of a mechanism

#262 round 2, from a suppressed note the 0021 gate promoted. The Q3 answer said the rule **takes** the
`none` form; in the tree it still had its `shell` matcher. **Swept, not patched at the site** — the tense
was wrong in three places and the note named one, and the PR body carried it in a fourth.

The same defect turned up again on #267, one file over and **already in the tree**: the gate map said
*"Settled 2026-08-13: `doctor` now reads the policy this workspace yields"* and then described the ended
behaviour in the present tense, inside the paragraph whose subject is that the divergence is *"the record
of what it cost, not as current behaviour."* Now past tense **with the rule stated in the text**, so the
next editor meets the reason and not only its result.

### 7. A reason restated at half its length

The pre-commit check asked whether the rule's *what-to-do-instead* survived the matcher's removal. It did —
in the pack's `reason`, which `spec/pack.schema.json:138` **requires** beside `action`.

The instruction was to fold it into the `none` value if it had been dropped. Measuring reach refused the
fold: `gate.mjs:140` interpolates `rule.reason`, never `action.none`, and neither printer prints either, so
for a composing workspace's reader **the two fields are reachable by one route each — adjacent lines of the
same file.** A fold would have added a duplicate, not reach.

What the check did surface: **this workspace's gate map restated only the first half of the pack's reason**
— zero occurrences of the evolution-gate clause. Half-copy, predating the change, now whole and confessed
in place.

### 8. The third noun of declares-vs-yields

Measuring §7 found that **`gate.mjs:100` reads the policy the workspace DECLARES** while `compile` enforces
the one it **yields**. A pack-contributed gate falls in the gap: a composed `gated` rule prompts without its
reason, and a composed `prohibited` rule with a real matcher would be denied by the compiled artifact and
**not** by the hook. The same split was repaired on `dod.md` condition 1, then on `doctor` in session 16,
whose own log entry states the transferable rule: **when a rule has been fixed on one noun, look for the
other nouns.** `gate.mjs` was one and was not swept. Filed as **#269**.

### 9. #253, captured live, and which reviews migrate

#263's rebase force-push produced the case #253 was filed on, and separated the two kinds:

| review | author | `commit_id` after | submitted | |
|---|---|---|---|---|
| `4936984899` | Copilot | `554a127b` | 12:10:51Z | **PINNED** |
| `4936988389` | `portulan-agent` derived verdict | **`c46e9cb0`** | **12:11:25Z**, 19 min *before* the push | **MIGRATED** |
| `4937121217` | Copilot | `c46e9cb0` | 12:32:13Z | fresh |

Copilot's reviews pin — the falsifier has not fired. **The derived-verdict review this repository posts is
exactly the kind that migrates**, and its own body still names `554a127b` while its `commit_id` says
otherwise: the field and the text disagree inside one artifact, and only the text is right. **Nothing was
merged on it** — #267's merge stood on the fresh round, which is why the measurement is taken immediately
before the act rather than read from a check.

### 10. An enumeration that undercounted itself, in the file about enumerations

The gate map's `action none` row read *"Spending money and sending something outward are **the two** here"*
while the policy already declared **three** — it never counted `rename-or-transfer-a-repository`. Corrected
in the change that adds the fifth, with the confession in the cell: an enumeration undercounting its own
category is the defect the change is about.

### 11. Three terminations, three reasons, none self-granted

**#263** never needed a round — Copilot found nothing, twice, including on the rebased head. **#262**
terminated on **emptiness at the bound's edge**: two fix-rounds, two real findings, third round clean.
**#267** terminated on the **bound**: a correct third finding (a verb ellipsis) triaged to **#270** rather
than bought with a third push, because the sibling exemption's operational test does not reach it — this
change's subject is enumerations, and an ellipsis is not an instance. Precedent #211→#213, #251→#252.

### 12. A finding right in its conclusion and false in its ground

#267 round 1: the `none` value garden-paths on *"form an incident"* — correct, and fixing it exposed that
**my own two carriers of that list disagreed** (the gate map already read *"form that"*). But the note's
stated reason was that the text *"will be shown as the refusal explanation"*, which is false and measurable:
`gate.mjs` never interpolates `action.none`, and cannot reach this rule at all. Accepting the reason would
have put a false mechanism claim in the record — the defect #262 round 2 was about. Refused on the thread
with the measurement, and the gap filed as #269.

### 13. An approved outward act that sat unposted

#267's round-1 reply was drafted, approved and **not sent** while the commit and push went ahead. Caught on
my own sweep and posted before the next round was answered, so no thread was unanswered at any measured
point. **This is the 529-recovery state from session 17 reached without a 529** — the gap between *approved*
and *performed* is a state, and nothing but a sweep distinguishes it from *done*.

## What Copilot did on its own clock

Every round arrived, and fast: **136s** on #262's first synchronize, ~4 min on the second, ~2 min on #263's
rebase force-push, ~3 min on each of #267's. **No instance of the #248 silence class tonight**, across five
synchronizes and two force-pushes on user-authored pull requests. Not evidence the class is closed — it is
absence, on a night nothing else was contended.

## Where this leaves the tree

**`main` = `6c540c9`. Suite 1590, eleven recipes green, zero open pull requests.** Verified on the merged
tree rather than on a branch: `compile --matrix` and `doctor` both report **5 gates no backend compiles**,
`doctor` GREEN.

The ruling is now in three places, each doing one job: the proposal records **what was decided**,
`autonomy.md` carries **the rule**, and the gate map plus the pack carry **the instance**. No fourth carrier
was created, which was the whole argument for extending a paragraph rather than writing a new record.
