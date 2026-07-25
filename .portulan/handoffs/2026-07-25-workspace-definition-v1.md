# Handoff — the Workspace Definition, derived and instantiated

**State.** Milestone 2, session 1 of 2. **The milestone stays open.** Shipped: the schema
([`../../spec/workspace.schema.json`](../../spec/workspace.schema.json)), its per-slot derivation
([`../../spec/slots.md`](../../spec/slots.md)), the orientation
([`../../spec/README.md`](../../spec/README.md)), this workspace's first manifest
([`../workspace.json`](../workspace.json)), the two slots the schema forced into existence
([`../principles.md`](../principles.md), [`../products/`](../products/)), and a second verify recipe
([`../verify/json.sh`](../verify/json.sh)). Not shipped, and owed by session 2: `doctor`, the demo
workspace in [`../../examples/`](../../examples/), and the claims-against-the-tree lint. Task
[`0002`](../tasks/0002-workspace-definition-v1.md) carries both halves and stays open.

**Decisions + why.**

- **The manifest is an index, not a container** — because a manifest that absorbed the prose would move
  the product's actual value into a file nobody enjoys reading. The consequence is a real split in the
  schema: *path slots* point at whole files, *structured slots* (`verify`, `products`, `packs`) hold data
  because something consumes them. The Stop-gate needs to know which recipe is the default; no paragraph
  gives it that.
- **A slot may not be addressed by `#fragment`** — because this repository's own `links` check cannot
  validate fragments, so a fragment-addressed slot would be unlintable by construction: it would exist,
  and nothing could ever confirm it pointed anywhere real. *This is the decision that did the most work
  in the session*, and it was a constraint rather than a preference — it is what forced `identity.md` to
  split into identity / principles / product, rather than the schema bending to the document.
- **`constitution` is the one slot allowed to point outside the workspace directory** — because customer
  zero's constitution is [`../../docs/vision.md`](../../docs/vision.md), one level up. A containment rule
  would have made `doctor`'s first run against its own author's workspace go red for a schema-design
  reason. Found by designing against the real instance instead of a hypothetical one.
- **`products` is an array although this workspace has exactly one product.** Deliberately resisting the
  only sample available: a faithful one-sample derivation models product as singular, correctly for today
  and wrongly by milestone 6, when the portfolio workspace covers all Sleepy Panda products. The criterion
  says *portfolio-aware* and this is the only line in the schema where that phrase costs anything.
- **Provenance is a record field, not a manifest key.** A rule lives in a Markdown record, so a manifest
  key would have described a workspace's *policy about* provenance while leaving every actual rule
  unchecked. The schema defines the shape (`$defs/provenance`); memory entries and proposals carry
  instances. One definition, two carriers.
- **`json.sh` was written before the JSON it guards**, and it caught its own author first: the initial
  draft mis-indexed `node -e`'s argument vector and reported `.claude-plugin/marketplace.json` — a file
  that has been fine since milestone 0 — as malformed. The argument handling was removed rather than
  repaired; the file list now arrives on stdin. Recorded because the lesson generalises: a **false red**
  is not a milder failure than a false green, it is the one that gets the whole recipe switched off.
- **`docs.sh` stays POSIX; only `json.sh` and `doctor` need `node`.** Splitting the dependency rather
  than letting it seep into the default recipe is what keeps the cost legible, and each recipe now
  declares its own `requires` in the manifest — which is what makes *could not run* (exit 2)
  distinguishable from *ran and failed* (exit 1).
- **The session was split spec-now / validator-next.** Authoring `doctor` before the schema it validates
  is impossible, and authoring the demo before the schema inverts the plan's own "re-expression before
  schema" sequencing. Each session gets its own demonstration: this one derivation, the next red→green
  validation.

**Decisions that were the maintainer's, recorded here because the session turns on them.**

- **Proposal [`0002`](../proposals/0002-sealed-provenance.md) accepted** (Marius, 2026-07-25), and closed
  as applied. Two things it had explicitly deferred were settled in the applying: *resolvable* means
  well-formed and never fetched, and the slot is a record field. **He reserved the matching `docs/vision.md`
  wording change to his own hand** — so until that lands, thesis 4 reads "links to the incident" while
  the spec permits a stamp. That gap is stated in `spec/slots.md` and in the proposal rather than
  smoothed over.
- **JSON is the format product-wide, not just for the manifest** (Marius, 2026-07-25) — which is why
  [`../../docs/plan.md`](../../docs/plan.md)'s milestone-4 row now reads `gates.json`. The reasoning that
  makes it coherent: the doctrine already puts the *why* in Markdown and the *must* in machinery, so a
  compiler's input never needs comments, and comments were YAML's only real advantage here. Raised
  because a "no YAML parser" rationale that ignored the YAML file the plan named one milestone later
  would have been a rationale with a hole in it.
- **Proposal [`0003`](../proposals/0003-demote-three-workspaces-entry.md) drafted, not applied.** The
  `kind` slot satisfies the retirement condition
  [`three-workspaces-not-one.md`](../memory/three-workspaces-not-one.md) wrote for itself — but only for
  the *general* half. Which of this repository's directories is which kind stays workspace-local, because
  a spec naming customer zero's directories would absorb the specifics thesis 6 keeps with their owner.
  Drafted and left for the gate; the entry is untouched.

**Verification, run rather than asserted.**

`json.sh`, red then green, before the JSON *this milestone adds* existed — one guarded file,
`.claude-plugin/marketplace.json`, has been in git since milestone 0, which is why the green run below
reports one file rather than none:

```
$ printf '{ "name": "broken", }\n' > .portulan/verify/.red-fixture.json && ./.portulan/verify/json.sh
FAIL  parse — 1 malformed JSON file(s)
        .portulan/verify/.red-fixture.json -> Expected double-quoted property name in JSON at position 20 (line 1 column 21)
RED — verify recipe failed; "done" is blocked.          exit: 1

$ rm .portulan/verify/.red-fixture.json && ./.portulan/verify/json.sh
ok    parse — 1 JSON file(s) parse
GREEN — verify recipe passed.                            exit: 0
```

Stated honestly: that red came from a **synthetic fixture**, not from a defect found in the wild. The
genuine defect this session produced was the false red described above — caught by running the check, not
by the check itself. The manifest's path resolution was also exercised by hand (every `slots.*` entry,
both product paths, both recipe docs, and `verify.default` naming a real recipe — all resolved, including
the out-of-directory `constitution`), but **that script was not kept**: it is `doctor`'s job, and a
throwaway that duplicates a validator's logic is how two implementations of one rule start drifting.

**Open questions.**

1. **`docs/vision.md` thesis 4 wording — Marius's, reserved by him.** Worth doing before the milestone-3
   public flip: the first outside reader should not find the constitution and the schema disagreeing.
2. **The schema has been validated against zero instances.** `json.sh` checks that JSON parses, which is
   not conformance. Every "this workspace conforms" claim standing today is an assertion, and session 2
   is what converts it.
3. **A schema meets its real test on its second instance.** The demo workspace is that test and it does
   not exist yet. Expect `spec/` to change when it lands — that is the milestone working, not slipping.
4. **`requires` is unchecked and unenforceable today.** A recipe that quietly needs a tool it did not
   declare passes `doctor`. The honest fix is executing recipes, which belongs to the Stop-gate runner in
   milestone 4.
5. **Live duplication between [`three-workspaces-not-one.md`](../memory/three-workspaces-not-one.md) and
   `spec/README.md`** until proposal 0003 is ruled on — small, visible, and the right thing to accept
   rather than pre-empt.
6. **`CODEOWNERS` is still absent** — carried forward from
   [the platform-floor handoff](2026-07-25-platform-floor-applied.md), unchanged. Nothing requires a
   path-specific human on any file, including the constitution.

**Next action.** Milestone 2, session 2: author `doctor` (schema conformance + path resolution + the
claims-against-the-tree lint + provenance forms + sealed proportion), author the demo workspace in
`examples/` **with more than one product** so portfolio-awareness is exercised by an instance rather than
merely permitted by the schema, and drive it with a **known-bad manifest fixture first** — a validator
that goes green on first contact with a manifest written to satisfy it has demonstrated nothing. Then the
milestone-close checkpoint.

**Recoverability.** Documentation, one schema, and one added verify recipe; nothing outward was taken and
no repository setting changed. Both recipes are green, so the tree can be committed or discarded whole.
The one change with reach beyond this repository's files is the second step added to
[`../../.github/workflows/verify.yml`](../../.github/workflows/verify.yml): it runs inside the existing
`docs-integrity` job rather than a new one, deliberately, because that job id is the status-check context
`main`'s branch protection pins and a new job would have left the rule requiring a check that no longer
reports.
