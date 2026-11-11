# Restore the merged comment budget

**Criterion.** [#643](https://github.com/sleepy-panda-srl/portulan/issues/643),
M13 closure's budget finding and definition-of-done condition 1.

**Acceptance criteria.**

- When the unchanged comments recipe runs, counted bytes shall be at most 261520
  and history comments shall remain zero.
- When the repair is compared with main 71486b3, all non-comment source lines shall
  remain identical and both existing rationales shall remain accurate.
- When the finished tree is verified, all yielded recipes shall pass without
  raising a rail, changing a scanner or rewriting historical capture evidence.

**Plan and opening.** Independent `m13_budget_open` returned APPROVE. Shorten two
existing whole-line compiler comments by 115 bytes, retaining portable provenance,
absolute-root exclusion, quoted node paths and shell-composition risk. Work in an
isolated branch; preserve the closure review's checkout and milestone status.
Astra independently reproduced 261590 bytes against 261520 on 71486b3; the repair is
bounded to that finding. Advisory validity and policy-free emission are separate
user-authorized items with separate PRs.
