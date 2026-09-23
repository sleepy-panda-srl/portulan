# Changelog fragments

One file per entry for the next release, so two open changes never edit the same lines. Name each
`<slug>.<section>.md`, the section one of added, changed, deprecated, removed, fixed or security, and
write one top-level bullet, with any link relative to this directory.
`node cli/index.mjs --changes changes` prints them grouped, with their links moved up one directory, as
the cut pastes them under the new version in [`../CHANGELOG.md`](../CHANGELOG.md). The cut then deletes
them and keeps this file, so the directory stays tracked for the evaluation bundle, which ships it.
`.portulan/verify/docs.sh` refuses a fragment the cut could not assemble.
