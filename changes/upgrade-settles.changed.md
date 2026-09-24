- **`upgrade --write` finishes in one run where a later step makes an earlier one owed.** After a pass
  that applied a step, it asks the whole chain again until a pass applies nothing, so a card a later form
  step edits is compiled in the same run rather than on the next; a chain still applying after as many
  passes as it has steps is refused and rolled back, leaving the workspace as it was.
