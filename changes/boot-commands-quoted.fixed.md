- **The boot's commands work where the plugin or the project sits under a path with a space in it.**
  Every command `/portulan`'s boot skill gives now quotes the plugin's and the project's directories.
  Claude Code writes both into [`SKILL.md`](../plugin/skills/portulan/SKILL.md) as text, so a directory
  such as `My Projects` reached the shell as two words, and the line that closes the boot failed before it
  measured anything. Step 5 in [`steps.md`](../plugin/skills/portulan/steps.md) now says, as step 2
  does, that the working directory stands in for an unset project directory.
