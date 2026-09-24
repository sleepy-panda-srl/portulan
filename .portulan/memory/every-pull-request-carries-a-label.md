**type:** rule
**dated:** 2026-09-24
**scope:** workspace — every pull request opened here
**provenance:** `form=link` `href=8a33f9b:.portulan/handoffs/2026-07-27-nothing-merges-behind-main.md`
— the maintainer, 2026-07-27: *"each PR should have a label and be labeled accordingly"*, ruled when 45
pull requests had one label between them, Dependabot's.

Every pull request carries a label from [labels.json](../labels.json), extras allowed,
set in `gh pr create --label …`. Labelling later works: the check re-runs on `labeled`, which makes it a
gate, not a trap.

**Why it holds:** a diff of prose says where a change is, never what kind it was. The set stays small
and `covers` guides rather than matches: a path matcher goes falsely red on an incidental touch of
`core/`, and a false red gets a check switched off. A machine checks that a declared label exists; a
person judges that it fits.

**The rail**, [`pr-labels.yml`](../../.github/workflows/pr-labels.yml), is required since 2026-07-27.
Contexts go whole, each with its `app_id`: the array is replaced, and a context without one passes for
any App reporting its name.

```
gh api -X PATCH repos/sleepy-panda-srl/portulan/branches/main/protection/required_status_checks \
  --input - <<'JSON'
{"strict":true,"checks":[{"context":"workspace-verify","app_id":15368},{"context":"pr-labeled","app_id":15368}]}
JSON
```

**Adding a label to `labels.json` does not create it on GitHub**, and nobody can apply it until it
exists. From the root, idempotent, skipping Dependabot's two:

```
node -e 'for (const l of require("./.portulan/labels.json").labels) if (l.appliedBy !== "dependabot") console.log([l.name, l.color, l.description].join("\t"))' \
  | while IFS=$'\t' read -r name color desc; do gh label create "$name" --color "$color" --description "$desc" --force; done
```

**Retire when:** nothing reads the labels (the librarian, release notes, a query anyone runs): delete
the rule and its gate together. Related: [merge sync](a-branch-syncs-with-main-before-it-merges.md).
