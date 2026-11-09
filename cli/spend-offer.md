# Init's spend offer

`init` offers `spend.multipliers` and `spend.horizon.requests` independently. Each is
declared only after accepting its interview answer or providing `--multipliers
'<JSON>'` / `--horizon <positive integer>`. The answers file takes the same keys as
strings; flags win. A declined offer leaves the key absent. A pointer has no spend
policy and refuses these options. Either declaration requires spec 2.12.

For Claude Code, the helper reads model IDs, timestamps, repository paths and usage
presence from local assistant records. It selects the latest main-context record
for this repository, ignoring synthetic records, sidechains, separate subagents
and foreign paths. Conflicting latest models, missing models or unreadable records
give a general offer with a reason. Malformed lines are counted and disclosed.
Conversation content is not inspected. A configured model does not replace a
recorded one. The last recorded model need not be the next session's model.

The offer tries these sources in order:

1. A matching `modelPricing.overrides` row in the system managed settings file:
   `/Library/Application Support/ClaudeCode/managed-settings.json` on macOS,
   `/etc/claude-code/managed-settings.json` on Linux, or
   `C:\Program Files\ClaudeCode\managed-settings.json` on Windows. Exact model IDs
   precede supported canonical IDs with an eight-digit snapshot suffix removed.
   All four rates must be finite numbers in 0–10000. `input` and `cacheRead` must
   also be positive, the read/input ratio at most one, and write/input at least
   one, for `spend` to represent them. One `cacheWrite` rate supplies both
   lifetimes; a global multiplier cancels in ratios. Unusable rows fall through
   with a reason. User/project/local `modelPricing` settings are ignored, as the
   host ignores them. See the [host contract](https://code.claude.com/docs/en/settings-reference#modelpricing).
2. The table embedded in `spend-offer.mjs`, checked **2026-11-09** against the
   [vendor's price page](https://platform.claude.com/docs/en/about-claude/pricing).
   The explicit Claude API model IDs use cache reads at 0.025 for Fable/Mythos
   5.1/5.2, 0.05 for Opus/Sonnet 5.5, and 0.1 for the other listed IDs; writes are
   1.25 at five minutes and 2 at one hour. This is a dated offer, updated with the
   product, without a runtime fetch. Unknown IDs and provider-specific aliases
   are not guessed. Only known canonical IDs and their eight-digit snapshots
   normalize; custom gateway overrides require an exact match.
3. General figures: read 0.1, writes 1.25/2. The horizon offered is 20 requests
   still to go, which the task or workspace should replace with its own estimate.

The file is **not an effective-settings resolver**. A nonempty JSON drop-in set
at `managed-settings.d` makes the file source unavailable rather than pretending
to merge it. Remote managed settings, MDM/plist/registry, policy helpers and
embedding-host sources are not inspected; they can supersede the file. The offer
names that condition. Native Windows discovery is not demonstrated here. See
[managed source precedence](https://code.claude.com/docs/en/managed-settings).
Other hosts and unsupported models get the general offer. A declaration is the
workspace's value, not a verified billing rate.

`spend-offer.test.mjs` uses injected local transcript and managed-file paths. All
verification is offline; no recipe reads the operator's usage records or managed
pricing. Accepted drafts are validated by `doctor`, and `compile` carries their
figures onto advisory commands.
