- **`upgrade --write` counts each step it applied once.** A step the run applies again in a later pass,
  as `0007` compiles a card before and after `0008` adds its section, was counted each time, so two
  steps were reported as three. Its help also says exit 1 covers a step owed by hand only under
  `--check` or `--write`; a bare run lists such a step and exits 0.
