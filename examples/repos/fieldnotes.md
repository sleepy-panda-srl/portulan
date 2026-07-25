# Repo — fieldnotes

**What it is.** The public documentation and compliance-guidance site: Astro over Markdown, built and
deployed to Netlify on merge to `main`. Blast radius is what volunteers believe their obligations are.
_(Fictional. See [`../README.md`](../README.md).)_

**Build / test / run.**
- build: `npm run build`
- test: `npm run check` — the build, plus a link check across the content
- run: `npm run dev`

**Gates.** Inherits [`../gate-map.md`](../gate-map.md), with one thing that surprises people: **merging
is deploying** here. There is no staging and no deploy gate, so the Propose tier on public copy is the
only thing between a draft and a volunteer reading it.

**Layout.** `src/content/` the Markdown, one directory per season · `src/pages/` routes ·
`src/components/` · `astro.config.mjs`.

**Quirks.**
- Historical rules are kept per season under `src/content/`, and which season a page belongs to is
  encoded in the directory name and nowhere else. Nothing checks that a page is filed correctly.
- `npm run check` validates links and the build. It does not read the prose, and the prose is the part
  that can be wrong in a way that matters.
- The search index is built at deploy time; a page that fails to index fails silently.

**Provenance.** Written when Rooftop adopted Portulan, at the same time as the Combcount card. Rewrite
it if the site ever gains a preview environment that is not per-pull-request.
