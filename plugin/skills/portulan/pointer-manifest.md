# Boot Portulan — step 2a: the manifest is a pointer

> **Step 2a of [`SKILL.md`](SKILL.md) in full, read at boot only where the manifest's `kind` is
> `pointer`.** Its step numbers are the skill's, and its reasons are in [`rationale.md`](rationale.md)
> under 2a. It moved here on 2026-09-23, under proposal 0036 as amended that day: none of it was
> deleted, and none is kept in both files.

A manifest whose `kind` is `pointer` is **not** a workspace. It is one thin file saying that this
repository's workspace resides elsewhere, and naming it: `governed_by.workspace` is the governing
workspace's name, and `governed_by.feed`, where present, is the private feed it ships through. A
pointer is the whole answer about residence, not a hint to be supplemented.

**Ask the CLI where that workspace is. Do not go looking yourself.**

```
node ${CLAUDE_PLUGIN_ROOT}/cli/discover.mjs --json ${CLAUDE_PROJECT_DIR}/.portulan
```

**Substitute the project root yourself if `${CLAUDE_PROJECT_DIR}` is not set** — step 2's rule, that
the working directory stands in for it, applies to this command too.

It prints one object and exits **0** resolved · **1** not resolvable here · **2** could not run or
could not look. Read the `state` field — never the prose, which is written for a human and is the half
most likely to be reworded.

| `state` | What you do |
|---|---|
| `resolved` | `root` **is** the workspace directory. Go to step 3 and read its slots exactly as you would an in-repo workspace's, resolving every slot path against **that** directory. |
| `not-installed` | Go to step 4 and give that section's honest position — you have the engine and none of this team's policy. |
| `ambiguous` | Two or more installs answer to one name and the resolver refused to pick. **Do not pick either.** Report every entry in `matches` and ask the user which is meant. |
| `could-not-look` | The record exists and would not parse. This is *could not look*, which is not *not installed* — say which one you are reporting. |
| **no object at all** | Exit 2 with **nothing on stdout** and a diagnostic on stderr: the command could not run — a bad argument, an unreadable manifest, no Node. Read the diagnostic, say the resolution did not happen and why, and take step 4's position **without** claiming the workspace is not installed. Silence is not an answer, and it is never *no*. |

_(`node ${CLAUDE_PLUGIN_ROOT}/cli/doctor.mjs ${CLAUDE_PROJECT_DIR}/.portulan` prints the same answer as a
`residence` note, and is the spelling to use when a human is reading. It grades the **pointer** and never
the workspace it names: run `doctor` against `root` if you want a verdict on the workspace itself.)_

**This is the one licensed exception to step 2's "search the project only", and it is licensed by the
project itself.** It licenses no search of your own — if the CLI cannot run, you have no resolution, and
*no resolution* is reported as itself rather than replaced by a guess.

**A resolved root is outside the project directory, so the same denial that can stop step 1 can stop
step 3 — and it must not be mistaken for absence.** That state is **resolved but unreadable**, and it is
a third thing: the workspace *is* installed, you know precisely where, and you do not have it. Say that,
ask for read access to the cache, and give step 4's position **for the policy you are missing** — never
the *not installed here* sentence, which would send the user to install something they already have.

Four things stay true whatever the answer is:

- **Do not read the pointer's neighbours as policy.** A pointer carries no slots, and a `.portulan/`
  directory beside it holding files anyway is a defect worth reporting, not a workspace to load.
- **Do not treat this as "no workspace".**
- **Say where the workspace came from, in the report at step 5.** Name the residence: *"Resolved from
  the host's plugin cache: `<plugin>@<marketplace>` version `<v>`"*.
- **Resolving the workspace does not resolve its packs.** Step 3a's four limits apply to a resolved
  workspace exactly as they apply to an in-repo one. Where the resolved manifest declares a spec MINOR
  older than this bundle's, say so as well: slots added since are simply absent, which is the contract
  working rather than a fault.

Where it is not installed and the user can install it — from the feed, or from a checkout beside this
repository — that is the thing to ask for.
