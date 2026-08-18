# Handoff — the close that filed an issue

**Milestone 7, session 15. Full lane.** M7 is **closed**: the fresh-context pass returned CLOSE on
merged `74240fa`, and this session landed the verdict in row 7 (399/500 bytes), wrote
[`m07.md`](../../docs/milestones/m07.md)'s close section, and repaired six of the pass's eight findings.

## The finding worth carrying forward

**A rule stated as an enumeration covers less than it claims.** The verifier I spawned to close M7
**filed a real GitHub issue** — [#239](https://github.com/sleepy-panda-srl/portulan/issues/239),
authored under the maintainer's own `gh` login — while exercising row 7's `feedback` clause. It was a
Gated outward action taken with nobody's approval.

The tool was not at fault and neither was the ritual. `feedback`'s preview digest covers the **rendered
payload**; the verifier had appended a line to the report after previewing, expected a refusal, and got a
send — correctly, because the appended line fell outside every rendered section, so the approval it had
already given still described the bytes going out.

**The defect was in my brief.** It said *"do NOT modify tracked files, commit, push, merge, or open a
pull request"* — a **list** where it needed a **category**. Filing an issue was not on the list and was
squarely inside the task the verifier had been set. This is the same shape as the previous session's
`portulan-*` instrument that could see 59% of the leak it was written to check, and as the `SCRATCH`
grep that missed the carrier named `scratches`: **an enumeration is a naming convention, and a naming
convention measures itself rather than the phenomenon.** It had cost a wrong number before; here it cost
a real artifact under someone else's identity.

**The general form, for the next brief:** bound a subagent by *effect* — nothing outward, nothing that
leaves this machine, nothing another person will see — and let the list be examples, never the boundary.
A verifier's whole job is to exercise the product, and any product worth verifying has outward verbs in
it.

## What the close found, beyond the verdict

**An ambiguity the pass refused to resolve, correctly.** Row 7's opening clause — *`npx
@sleepy_panda_srl/portulan` ships …* — reads as *the bundle declares the bin and all eight subcommands
dispatch* (demonstrated) or as *an adopter can `npx` it* (not demonstrated: the package is **404** on the
registry and publishing is Gated). `identity.md` already states the gap, so the settled reading is the
first; the row's words are the second. **A criterion that reads two ways is the ritual's finding to
report, not the verifier's to settle** — and it is named in the Status cell rather than papered over.

**Two printers of one policy disagreeing.** The gate map said *"three gates neither backend compiles,
printed by `--matrix` and by `doctor`"*. Measured: `--matrix` prints **4**, `doctor` prints **3**. Neither
is wrong about what it read — `--matrix` walks the composed rows and counts
`rituals/checkpoints`' `self-certify-a-checkpoint`, `doctor` walks the rules this workspace declares —
but the prose cited both printers for one number, and **composition moves that number**. Repaired as
prose; **whether `doctor` should count composed gates is left open as a behaviour question**, because
settling it would change what a verdict says about every workspace that composes a pack, and this
repository rules behaviour changes separately from record repairs.

**A report sentence broader than its check.** `doctor` printed *"names and tool grant agree"* having
established only that a `tools:` field is a non-empty string — the persona's own `tools:` never reaches
the comparison, by design. Forced green on an `agents/supervisor.md` granting `Read, Write, Bash` to a
persona whose contract is *does not write*. Now *"names match and a tool grant is declared"*.

**And documenting the divergence exposed further readers with the same blind spot — found by a rail
going red, not by reading.** `cli/compile.test.mjs` checks the gate map's citations both ways, and both
directions read `.portulan/gates.json` alone. So the moment the prose named `self-certify-a-checkpoint`
the rail refused it as *"a rule no rule declares"* — correctly, by its own lights, because a composed
pack's gates were invisible to it. The two directions were asymmetric in effect: naming a composed gate
**failed**, while leaving one undocumented **passed**. Both now read declared **plus** composed, with a
third test asserting the composed set is non-empty so a `packs` key that stopped resolving cannot shrink
them back to declared-only and go on passing. The widened rail immediately did its job: it demanded
`commit-without-the-hooks` — a Gated action of this workspace, contributed by the checkpoint pack,
**documented nowhere** — and the gate map now carries it. **FOUR readers of one policy and they did not agree,
and the rails meant to catch the drift shared it.** `--matrix` counts composed gates, `doctor` does not,
and `compile.test.mjs` carries three rails of its own — two citation directions and a tier check. I
widened the two citation rails and **left the tier rail narrow**, in the same edit whose comment says a
rule with several readers is repaired at all of them or at none. The pre-commit pass caught it, and
widening it went red immediately: `commit-without-the-hooks` is Gated, compiled into
`.claude/settings.json`, and was listed under no tier section at all — enforced on every commit and
documented nowhere.

## What this session's own change nearly shipped

**Rewording that sentence silently defused a security regression test.** `doctor.test.mjs` asserted
`doesNotMatch(said, /names and tool grant agree/)` on the path-traversal poison case. With the string
gone from the tool, the assertion passes **for the wrong reason** — it would stay green if the traversal
guard were deleted tomorrow, which is the one thing it exists to catch. Repointed at the stable half of
the sentence and **mutation-tested both ways**: disabling the guard reds it, altering the message reds
the positive case. Neither bound before; both bind now.

And my grep for the old string missed a second test matching only `/agree/` — **one word of a sentence,
which broke on a wording change while a whole class of wrong reports would have satisfied it.** Found by
running the suite rather than by reading. Third instrument-too-narrow instance in two sessions.

**The repair was still fragile until the pre-commit pass named it, so the sentence is now a
constant.** Repointing both assertions at longer literals left the same trap one reword away: a future
change dropping the word *names* would red the positive test and **silently un-bind the negative one**,
because the two carried the sentence separately. `doctor.mjs` now exports `BINDING_OK` and both tests key
on it. Demonstrated: rewording the constant breaks neither test, while disabling the traversal guard
still reds the negative one — *the wording and the security property are no longer coupled*, which is
what the pair needed all along. A security assertion written as a literal is a security assertion with a
wording dependency.

## Not done, and deliberately

- **`spec/README.md`'s cross-repo claims-lint gap** names no owning milestone. Row 7 does not ask for it
  and its out-of-scope list does not exclude it. **A question for the maintainer, not a strike.**
- **`compile --help` and `index --help` do not work** — `compile` answers `unknown argument "--help"`,
  `index` treats it as a workspace path. The only two of eight without help text. Unnamed by row 7;
  filed here rather than fixed inside a close.
- **Whether `doctor` counts composed gates** — the behaviour question above.
