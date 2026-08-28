#!/usr/bin/env node
// The OTel emitter — milestone 8's *OTel opt-in config*, and the first thing in this repository that
// can send anything anywhere on purpose.
//
// The argument for the clause is in `../docs/milestones/m08.md`; what belongs here is what the
// opt-in IS, why it is not the standard environment surface, and — at more length than is
// comfortable — what a silent run means, because for an emitter whose correct default state is
// silence, *did nothing* and *is broken* look identical from outside.
//
// ## The reading was ruled, not derived
//
// *"OTel opt-in config"* reads at least three ways, and `../.portulan/gate-map.md`'s
// *"Session-open runs `clarify` against the milestone row itself"* exists because milestone 4 guessed
// at exactly this shape of ambiguity and cost a session-blocking question. Put to the maintainer on
// 2026-08-28 as three readings: **(i)** a validated config surface emitting nothing; **(ii)** that
// surface plus a real emitter — hand-written OTLP-over-HTTP JSON, no OpenTelemetry SDK — off by
// default and never callable from a verify recipe; **(iii)** an OTLP-shaped local file sink with no
// network path at all. **He ruled (ii).**
//
// Reading (i) is what this file would be if the emitter were deferred, and it fails
// `../.portulan/dod.md` condition 4 in a way the *names the milestone where it arrives* escape does
// not cover: under the row's `1 per clause` budget the clause would be spent with the emitter owned
// by no session — the *rule with no owner* shape the 2026-08-24 amendment exists to end, one
// altitude up from a rule with no checker.
//
// ## Why the opt-in is a committed file and NOT `OTEL_SDK_DISABLED`
//
// This is the one place this tool deliberately departs from the OpenTelemetry environment contract,
// and it is stated out loud rather than left for a reader to discover from the code.
//
// **`OTEL_SDK_DISABLED` defaults to `false`.** Honouring the standard env surface as the gate would
// mean an adopter who already exports `OTEL_EXPORTER_OTLP_ENDPOINT` in CI — for some other
// service — starts emitting from Portulan without having decided to. That is an opt-**out**, and the
// criterion's word is *opt-in*. It would also put a team decision in ambient per-machine state,
// which is the inverse of the cascade's `core < pack < workspace`: the workspace is where a team's
// policy lives.
//
// So: **the committed config file is the only gate**, and the environment supplies transport only —
// `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS`, read exactly as the OTel
// specification defines them, so an adopter's existing collector configuration works unchanged. A
// secret never enters the committed file; that is `../.portulan/dod.md` condition 5 holding by
// construction rather than by a reviewer noticing.
//
// _An earlier draft of this clause put the config in the Workspace Definition as a `telemetry` slot
// at spec 2.9. The session-open checkpoint cut it: every slot in that train arrived through a **ruled
// proposal** (`../spec/README.md`'s 2.8 argument cites proposal `0025`; `governed_by` cites `0017`;
// `provenance` cites `0002`), and `../.portulan/gate-map.md` makes an idea that adds a surface a
// proposal rather than an implementation pull request. `../spec/slots.md`'s own `evals` deferral says
// a schema change plus a spec bump plus a migration **"is not a thing to do in passing"** and defers
// to *when milestone 8 closes* — and the slot would have shipped with zero filled instances, since
// this workspace declares telemetry off and `../examples/` stays at 2.4. The slot is filed to ride
// with `evals` at the close, which makes it one bump instead of two._
//
// ## Consent — ruled 2026-08-28, and it is a reading of a tier rather than a new one
//
// `../.portulan/gates.json` makes *sending anything outward on the team's behalf* Gated, and
// `../core/operating/autonomy.md` says Gated is **per action**. Proposal `0014` reserves telemetry as
// *"a separate mechanism with separate consent"* — named there, never ruled, until now.
//
// **The maintainer's ruling: the opt-in config IS the standing consent.** A committed config with
// `enabled: true` is the team's decision, and each subsequent export rides on it without a fresh
// per-send approval — the way a compiled gate carries a tier without asking again. What stays his
// alone is **enabling it in this workspace**, which is why the committed config here says `false` and
// why no endpoint is committed anywhere in this tree.
//
// What makes that safe rather than merely decided is the payload, and the payload is closed by
// construction: it is assembled from an explicit allow-list of aggregate figures, and there is no
// path from a snapshot's free-text or path-shaped fields into a request body. See `PRODUCERS` below,
// where the allow-list is the code rather than a promise about it.
//
// ## What a silent run means — the trap this file is most likely to ship
//
// `./review-meter.mjs` shipped a broken entry guard and `--fetch` **printed nothing, exited 0, and
// wrote no snapshot** — the fourth time this repository has met that shape. For every other tool
// here that is a bad day. For an emitter it is worse: **the correct behaviour of an opted-out
// emitter is also to send nothing**, so a tool that never started and a tool working exactly as
// designed produce the same observable. There is no way to tell them apart from outside.
//
// Two consequences, both load-bearing:
//
//   * The entry guard is the ONE form `./rule-carriers.mjs` designates, copied rather than
//     re-derived, and the suite pins it under a path containing a space.
//   * **Every refusal prints a sentence and returns non-zero.** Silence is never this tool's answer
//     to anything. A caller may read exit 0 as *the payload went where it was asked to go* and
//     nothing else.
//
// And the two non-export states are kept apart, because collapsing them is its own seam defect: a
// config file with a typo that its author meant to be `true` must not report *opted out*.
//
//   0  the thing asked for happened
//   1  a verdict: the golden has drifted, or `--export` was asked of a workspace that is opted out
//   2  could not run: the config or the snapshot is missing, unreadable, or malformed
//
// _`../.portulan/memory/verify-preconditions-fail-closed.md` is deliberately NOT cited for the
// opted-out arm. That record is scoped to verify recipes and its subject is an enumeration that came
// back empty; `--export` against a workspace legitimately off is not a failed precondition — the tool
// looked, and the answer was no. The checkpoint caught this file citing it and it is a
// misapplication, so it is named here as one._
//
// ## Deliberately not a ninth `portulan` subcommand
//
// `../docs/vision.md` names eight and is human-owned; `../.portulan/identity.md` says a ninth is the
// maintainer's call. The precedent is `./eval-bundle.mjs`, `./drills.mjs`, `./review-meter.mjs` and
// `./skill-goldens.mjs`, each of which carries this same sentence. Run it as
// `node cli/telemetry.mjs …`.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { meter, validateSnapshot } from "./review-meter.mjs";
import { VERSION } from "./manifest.mjs";
import { recipeSet, resolverFor } from "./recipe-set.mjs";
import { isInside } from "./inside.mjs";

// ---------------------------------------------------------------------------------------------
// The offline audit — no verify recipe may reach the network, and now something checks
// ---------------------------------------------------------------------------------------------

/**
 * The network-capable modes in `cli/`, and the flag that turns each one on.
 *
 * **The subject is the MODE, not the module.** `../.portulan/verify/review-loop.sh` legitimately runs
 * `./review-meter.mjs` — in its snapshot-reading mode, which touches nothing. What a recipe may never
 * do is reach the mode that opens a socket. A rail that banned the module would forbid an existing
 * green recipe; a rail that bans the flag forbids the thing actually prohibited.
 *
 * **It rails the CLASS rather than this session's own module**, which is the whole reason it is a
 * table. Adding `./telemetry.mjs` and railing only it would have left `--fetch` unrailed — one rule
 * enforced at the newer of its two sites, which is the defect
 * `../.portulan/proposals/0020-a-fix-is-not-done-at-the-site-it-was-found.md` names and the one this
 * repository repeats most. A new network mode adds a row here or it is uncovered, and nothing can
 * audit that a row was added — the arrears are named rather than pretended away, as
 * `../.portulan/rule-carriers.json` does for its own registry.
 */
export const NETWORK_MODES = Object.freeze([
    { module: "cli/review-meter.mjs", flag: "--fetch", what: "fetches review data from GitHub" },
    { module: "cli/telemetry.mjs", flag: "--export", what: "posts an OTLP payload to a collector" },
]);

/**
 * Strip shell comments so a recipe may **explain** a network mode without being accused of running
 * one. `../.portulan/verify/review-loop.sh` says *"Refreshing is `node cli/review-meter.mjs --fetch`,
 * run by a person"* in a comment, and a matcher that could not tell prose from a command would red on
 * the sentence documenting the very rule it enforces — the failure shape
 * `./version-carriers.mjs` records for its own record-layer exclusion.
 *
 * Whole-line comments only. A trailing `#` cannot be stripped without knowing whether it is inside a
 * quote, and a half-right stripper fails OPEN — it would delete a real command that happened to carry
 * a `#`. Named as a limit rather than approximated.
 */
export const stripShellComments = (source) =>
    source
        .split("\n")
        .filter((line) => !/^\s*#/.test(line))
        .join("\n");

/**
 * Does this recipe's script reach a network mode?
 *
 * Deliberately whole-body rather than same-line: a recipe invokes a tool across several continued
 * lines (`review-loop.sh` spreads one command over four), so a same-line rule would miss exactly the
 * spelling a real invocation uses.
 */
/**
 * Split a shell body into the tokens a command is actually made of, stripping the quoting and
 * bracketing a path picks up in a script.
 */
const shellTokens = (body) => body.split(/\s+/).map((t) => t.replace(/^[("'`]+/, "").replace(/[)"'`;]+$/, "")).filter(Boolean);

/**
 * Does this token name that module, however it is spelled?
 *
 * **A matcher that knew one spelling was a bypass, not a rail.** The first version compared the body
 * against the literal `cli/telemetry.mjs`, so `node ./cli/telemetry.mjs --export` — the same file, the
 * same effect, one prefix different — walked straight past an enforcement check. That is precisely the
 * class milestone 8's clauses (a) and (b) exist for: a matcher's coverage is measured, never described,
 * and seven of the eight bypasses that produced those clauses were path and grammar spellings.
 * Copilot round 3 on #362, and https://github.com/sleepy-panda-srl/portulan/issues/337 already names
 * `./` as a spelling that matches nothing at runtime.
 *
 * So the test is a **suffix** on a path-separator boundary: `cli/telemetry.mjs`, `./cli/telemetry.mjs`
 * and `/abs/where/ever/cli/telemetry.mjs` all name it. The cost is stated rather than hidden — some
 * *other* tree's `vendor/cli/telemetry.mjs` would match too, which is a **false red**, the safe
 * direction, and a recipe reaching into another tree is worth a human looking either way.
 */
const tokenNamesModule = (token, module) => token === module || token.endsWith(`/${module}`);

/** A flag token, in the two spellings a shell writes it: bare, or `--flag=value`. */
const tokenIsFlag = (token, flag) => token === flag || token.startsWith(`${flag}=`);

export function auditRecipeSource(source) {
    const tokens = shellTokens(stripShellComments(source));
    return NETWORK_MODES.filter((m) => tokens.some((t) => tokenNamesModule(t, m.module)) && tokens.some((t) => tokenIsFlag(t, m.flag)));
}

/**
 * Sweep the recipe set the workspace **yields**, at a pinned root.
 *
 * Three properties, each from a defect this repository has already paid for:
 *
 *   * **It reads the yielded set, not the directory.** `../.portulan/dod.md` condition 1 is about what
 *     the manifest yields, which since milestone 7's composition amendment includes a composed pack's
 *     recipes — `tools/github:actions-pinned` lives under `packs/`. A directory sweep of
 *     `.portulan/verify/` would exempt precisely the recipes hardest to see.
 *   * **An empty or unobtainable set is could-not-run, never green.** *No recipe reaches the network*
 *     is satisfied vacuously by no recipes, and a rail whose green can be produced by an enumeration
 *     coming back empty is the fail-open
 *     `../.portulan/memory/verify-preconditions-fail-closed.md` was written about — and the vacuity
 *     `./skill-goldens.mjs` refuses one clause over.
 *   * **The root is pinned**, so the answer is about this tree rather than about the machine.
 */
export function auditRecipes({ workspaceDir, repoRoot, packRoots = [] }) {
    // **The workspace directory is pinned by `--repo-root` like every other path here.** It was
    // resolved against the CURRENT WORKING DIRECTORY, so a run from outside the tree that named
    // `--repo-root` correctly would still look for the manifest beside wherever the caller happened to
    // stand — the same root/cwd split https://github.com/sleepy-panda-srl/portulan/issues/347 names for
    // `--pack-root`, arriving in a new tool. `path.resolve` leaves an absolute `--workspace` alone, so
    // naming one explicitly still wins. Copilot round 1 on #362.
    const workspace = path.resolve(repoRoot, workspaceDir);
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(workspace, "workspace.json"), "utf8"));
    } catch (cause) {
        return { ok: false, why: `the workspace manifest at ${workspace} could not be read — ${cause.message}` };
    }
    let set;
    try {
        set = recipeSet(manifest, { resolve: resolverFor({ workspaceDir: workspace, manifest, repoRoot, named: packRoots, discovery: null, forced: false }) });
    } catch (cause) {
        return { ok: false, why: cause.message };
    }
    if (!set.ok) return { ok: false, why: set.reason };
    const recipes = set.recipes ?? [];
    if (recipes.length === 0) {
        return { ok: false, why: "the workspace yielded NO recipes — an empty set makes this audit vacuously green, which is the one answer it may never give" };
    }

    const findings = [];
    const read = [];
    for (const r of recipes) {
        // The script is the `.sh` token in the run line — `./.portulan/verify/docs.sh` for a
        // workspace recipe, `bash packs/.../actions-pinned.sh` for a composed one.
        const script = String(r.run ?? "")
            .split(/\s+/)
            .find((t) => t.endsWith(".sh"));
        if (!script) {
            return { ok: false, why: `recipe ${JSON.stringify(r.id)} has no readable script in its run line (${JSON.stringify(r.run ?? null)}); this audit cannot grade what it cannot read` };
        }
        const file = path.resolve(repoRoot, script);
        // **A script outside the tree is could-not-run, never a pass.** `path.resolve` happily follows
        // `bash ../../somewhere/outside.sh` or an absolute path out of the repository, and this audit
        // would then read and grade a file the pinned root does not cover — ending the property the
        // pinned root exists to buy, and offering a bypass to anyone who wanted one. `isInside` was
        // already imported into this module for the consent check and this call site did not use it.
        // Copilot round 3 on #362.
        if (!isInside(path.resolve(repoRoot), file)) {
            return { ok: false, why: `recipe ${JSON.stringify(r.id)} names ${script}, which resolves outside the repository at ${repoRoot}; this audit grades the tree and will not read past it` };
        }
        let source;
        try {
            source = fs.readFileSync(file, "utf8");
        } catch (cause) {
            return { ok: false, why: `recipe ${JSON.stringify(r.id)} names ${script}, which could not be read — ${cause.message}` };
        }
        read.push(r.id);
        for (const hit of auditRecipeSource(source)) findings.push({ recipe: r.id, script, ...hit });
    }
    return { ok: true, examined: read, findings };
}

// ---------------------------------------------------------------------------------------------
// The config — read, validated, and never guessed at
// ---------------------------------------------------------------------------------------------

/** The config document's own version, so a future shape change is a refusal rather than a misread. */
export const CONFIG_SPEC = "1";

/**
 * Validate an opt-in config. Returns an array of problems; empty means usable.
 *
 * **Every problem is a refusal, never a default.** A config that half-parses is the state in which
 * an author believes they opted in and did not — so there is no "assume off and carry on" arm here.
 * Off is a value this file requires somebody to have written down.
 */
export function validateConfig(config) {
    const problems = [];
    if (config === null || typeof config !== "object" || Array.isArray(config)) {
        return ["the config is not a JSON object"];
    }
    const spec = config.portulan?.telemetry;
    if (spec !== CONFIG_SPEC) {
        problems.push(`portulan.telemetry must be ${JSON.stringify(CONFIG_SPEC)}, not ${JSON.stringify(spec ?? null)}`);
    }
    // Absent is refused rather than read as false. An opt-in whose off state can be produced by
    // FORGETTING a key is an opt-in that can be turned on by forgetting a different one.
    if (typeof config.enabled !== "boolean") {
        problems.push(`enabled must be a boolean — absent is not false, because a gate you can reach by omission is not a gate (got ${JSON.stringify(config.enabled ?? null)})`);
    }
    if (typeof config.service?.name !== "string" || config.service.name.length === 0) {
        problems.push("service.name must be a non-empty string — it becomes the `service.name` resource attribute");
    }
    if (config.service?.namespace !== undefined && typeof config.service.namespace !== "string") {
        problems.push("service.namespace, where present, must be a string");
    }
    if (!Array.isArray(config.signals) || config.signals.length === 0) {
        problems.push("signals must be a non-empty array — an emitter with no signal is a tool that exits 0 having done nothing");
    } else {
        for (const s of config.signals) {
            if (!Object.prototype.hasOwnProperty.call(PRODUCERS, s)) {
                problems.push(`signals names ${JSON.stringify(s)}, which no producer answers to — known: ${Object.keys(PRODUCERS).join(", ")}`);
            }
        }
    }
    // The seam, as a refusal rather than as a review note. A committed file may name where a secret
    // is read from; it may never carry one. `../.portulan/dod.md` condition 5.
    for (const banned of ["headers", "endpoint", "token", "apiKey", "api_key"]) {
        if (config[banned] !== undefined || config.exporter?.[banned] !== undefined) {
            problems.push(
                `${banned} may not be set in a committed config — transport and secrets come from the ` +
                    "OTEL_EXPORTER_OTLP_* environment, so a token never enters this repository",
            );
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------------------------
// The producer registry — the closed payload, as code
// ---------------------------------------------------------------------------------------------

/**
 * What each signal contributes, and nothing else reaches a request body.
 *
 * **This registry IS the allow-list.** A producer returns metric rows built from named scalars; no
 * producer is handed a whole snapshot to spread into a payload, so there is no path from a
 * free-text or path-shaped field to the network. That is the seam holding by construction rather
 * than by a reviewer noticing — `../.portulan/dod.md` condition 5.
 *
 * **Ruled 2026-08-28: the review-loop figures only.** `../.portulan/verify/review-loop.sh` says the
 * OTel clause *"owes an emission path for these figures"*, and that debt is this one signal. The
 * shape below is the seam a second rail joins through — a producer is one entry returning rows —
 * rather than a promise that one day it might be.
 *
 * Each row: `{name, unit, description, value}`. `value` is a finite number or `null`; a null row is
 * DROPPED rather than emitted as zero, because an unmeasured window is not a window measuring zero
 * and `./review-meter.mjs` is careful about exactly that distinction.
 */
export const PRODUCERS = {
    "review-loop": {
        /** Where this producer's input is read from, relative to the repository root. */
        input: "evals/review-loop/snapshot.json",
        scope: "portulan/review-loop",
        /**
         * The instant these figures are ABOUT, which is not the instant they are sent.
         *
         * OTLP defines `timeUnixNano` as the time the measurement is associated with, so a snapshot's
         * own `captured` stamp is the correct value and not a workaround for determinism — though it
         * is also what makes the committed golden byte-stable, since a clock read would make every
         * render differ from the last.
         */
        capturedAt: (snapshot) => snapshot.captured ?? null,
        /**
         * **The input is validated before it is metered, and this was missing.**
         *
         * `meter()` treats a non-array `pullRequests` as `[]` and this producer defaults `repository`
         * and `window.merged`, so a malformed snapshot rendered a payload carrying *wrong* window and
         * repository metadata rather than refusing — a fail-open in the one direction that matters,
         * since the payload is the thing that leaves the machine. `./review-meter.mjs` already exports
         * the validator its own recipe uses; reusing it keeps one carrier of what a snapshot must be,
         * rather than a second opinion here that could drift from the producer's. Copilot round 1 on
         * #362, through the suppressed channel and promoted to a gating thread by this repository's own
         * step.
         */
        validate: (snapshot) => validateSnapshot(snapshot),
        rows(snapshot) {
            const m = meter(snapshot);
            return [
                { name: "portulan.review.pull_requests", unit: "{pull_request}", description: "Merged pull requests in the metered window.", value: m.pullRequests },
                { name: "portulan.review.submissions", unit: "{submission}", description: "Reviews the reviewer submitted across the window. Submission units, never fix-rounds.", value: m.submissions },
                { name: "portulan.review.submissions_per_pull_request", unit: "1", description: "The figure a-review-loop-needs-a-bound.md bounds the loop on.", value: m.submissionsPerPullRequest },
                { name: "portulan.review.submissions_no_inline", unit: "{submission}", description: "Submissions raising no inline comment.", value: m.noInline },
                { name: "portulan.review.no_inline_rate", unit: "1", description: "An UPPER BOUND on the found-nothing rate; a submission carrying only suppressed notes counts in it.", value: m.noInlineRate },
                { name: "portulan.review.pushes", unit: "{push}", description: "Distinct heads the reviewer saw — a floor on pushes, not a count of them.", value: m.pushes },
                { name: "portulan.review.pushes_per_submission", unit: "1", description: "The criterion's literal pushes-per-round figure, in submission units.", value: m.pushesPerSubmission },
            ];
        },
        /**
         * Attributes every row of this signal carries.
         *
         * `window.captured` is here because of a defect one rail over: the review-loop snapshot **does
         * not refresh itself** (https://github.com/sleepy-panda-srl/portulan/issues/356), so a stale
         * capture and a current one are the same green. Stamping the capture date onto the exported
         * data means a stale export is LABELLED stale at the far end rather than arriving as though it
         * were fresh — which is the most this emitter can do about a silence it does not own.
         */
        attributes: (snapshot) => ({
            "portulan.window.merged": snapshot.window?.merged ?? 0,
            "portulan.window.captured": snapshot.captured ?? "",
            "portulan.units": "submission",
        }),
        /**
         * The one identifier the payload carries, and it is the maintainer's widening rather than an
         * implementer's.
         *
         * The ruled payload vocabulary was *figures, rule ids, recipe ids* — no identity at all. The
         * supervisor's objection was that an export with no resource identity is indistinguishable at
         * any real collector, so somebody adds one later, and a closed list widened by an implementer
         * is the failure the list exists to prevent. Put to him 2026-08-28; **he widened it to one
         * named resource attribute**, which is this.
         *
         * A **resource** attribute rather than a data-point one, because it identifies the source and
         * not the measurement — and it rides once per payload instead of once per point.
         *
         * `login` stays excluded and is the field this deliberately is not. This snapshot's only login
         * is a bot's, but an adopter's would carry human reviewer names, and an identifier about a
         * PERSON is outside anything ruled here.
         */
        resource: (snapshot) => ({ "portulan.repository": snapshot.repository ?? "" }),
    },
};

/**
 * Every attribute key an emission **may** carry, pinned so the closed payload is a rail and not a
 * reminder.
 *
 * **An unfamiliar key in a rendered payload is a red.** Without this the "closed list" is a promise
 * about the code rather than a property of it — and a producer added later could widen the vocabulary
 * silently, which is precisely the widening the maintainer reserved to himself.
 *
 * **This is an ALLOW-LIST, and `REQUIRED_ATTRIBUTE_KEYS` below is the floor — one list was doing both
 * jobs and they are not the same job.** `service.namespace` is optional in the config *and* optional
 * in OpenTelemetry's own semantic conventions, so a workspace that declares none emits a payload
 * without it — legitimately. A single list checked "in both directions" made that legal config look
 * like a broken invariant, and the only reason nothing failed is that THIS workspace happens to
 * declare a namespace: the pin was green by coincidence of one instance. Requiring the key instead
 * would have been this repository inventing a constraint the specification does not have. Copilot
 * round 2 on #362.
 */
export const EMITTED_ATTRIBUTE_KEYS = Object.freeze([
    "service.name",
    "service.namespace",
    "telemetry.sdk.name",
    "telemetry.sdk.language",
    "telemetry.sdk.version",
    "portulan.repository",
    "portulan.window.merged",
    "portulan.window.captured",
    "portulan.units",
]);

/**
 * The keys every emission **must** carry, whatever the config says.
 *
 * The floor rather than the ceiling: a payload missing one of these is not identifiable at a
 * collector, which is the thing the maintainer's one widening of the vocabulary was for. Everything in
 * `EMITTED_ATTRIBUTE_KEYS` and not here is legitimately conditional — today that is `service.namespace`
 * alone, and it is conditional on the config declaring one.
 */
export const REQUIRED_ATTRIBUTE_KEYS = Object.freeze(EMITTED_ATTRIBUTE_KEYS.filter((k) => k !== "service.namespace"));

// ---------------------------------------------------------------------------------------------
// OTLP/HTTP JSON — the wire shape, written by hand
// ---------------------------------------------------------------------------------------------

/**
 * One OTLP `AnyValue`. Exported so the suite asserts against THIS map rather than re-spelling it —
 * a second copy of a wire encoding is a second thing to get wrong, and `./inside.mjs`'s docblock is
 * this repository's standing argument about that.
 */
export function anyValue(v) {
    if (typeof v === "string") return { stringValue: v };
    if (typeof v === "boolean") return { boolValue: v };
    if (Number.isInteger(v)) return { intValue: String(v) };
    if (typeof v === "number" && Number.isFinite(v)) return { doubleValue: v };
    throw new Error(`no OTLP encoding for ${JSON.stringify(v)}`);
}

const kv = (attrs) => Object.entries(attrs).map(([key, value]) => ({ key, value: anyValue(value) }));

/**
 * Render the OTLP/HTTP JSON metrics payload.
 *
 * **Gauge, and the point type is a decision rather than a default.** These are snapshot statistics
 * over a window of merged pull requests — not monotonic counters. A `Sum` would owe an
 * `aggregationTemporality` and a `startTimeUnixNano`, and the snapshot records no window START (only
 * its size and the per-pull-request merge stamps), so any start instant would be derived — which is
 * where double counting comes from. A Gauge needs neither and says what these figures are.
 */
export function renderPayload({ config, signals, version = VERSION }) {
    const resource = { "service.name": config.service.name, "telemetry.sdk.name": "portulan", "telemetry.sdk.language": "nodejs", "telemetry.sdk.version": version };
    if (config.service.namespace !== undefined) resource["service.namespace"] = config.service.namespace;
    // The maintainer's one widening of the closed vocabulary, contributed by the signal rather than
    // invented here. Signals agreeing on a key is fine; a signal inventing one the pin does not know
    // is what `EMITTED_ATTRIBUTE_KEYS` and the suite exist to catch.
    for (const s of signals) Object.assign(resource, s.resource ?? {});

    const scopeMetrics = [];
    for (const s of signals) {
        const timeUnixNano = String(BigInt(Date.parse(s.capturedAt)) * 1000000n);
        const attributes = kv(s.attributes);
        const metrics = s.rows
            // A null figure is DROPPED, never sent as zero. `./review-meter.mjs` returns null for an
            // unmeasured ratio precisely so nobody reads an empty corpus as a measured zero, and
            // encoding it as 0 here would undo that one layer down.
            .filter((r) => r.value !== null && Number.isFinite(r.value))
            .map((r) => ({
                name: r.name,
                unit: r.unit,
                description: r.description,
                gauge: { dataPoints: [{ timeUnixNano, attributes, ...(Number.isInteger(r.value) ? { asInt: String(r.value) } : { asDouble: r.value }) }] },
            }));
        scopeMetrics.push({ scope: { name: s.scope, version }, metrics });
    }
    return { resourceMetrics: [{ resource: { attributes: kv(resource) }, scopeMetrics }] };
}

/** The bytes on the wire and in the golden are the same bytes, produced here and nowhere else. */
export const serialize = (payload) => `${JSON.stringify(payload, null, 2)}\n`;

// ---------------------------------------------------------------------------------------------
// Transport — the ONE mode that reaches the network
// ---------------------------------------------------------------------------------------------

/**
 * Read transport from the OpenTelemetry standard environment. Nothing here is committed anywhere.
 *
 * `OTEL_EXPORTER_OTLP_HEADERS` is the specification's `key=value,key=value` list; it is parsed but
 * **never printed**, because a header list is where a bearer token lives.
 */
export function transportFromEnv(env) {
    const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (typeof endpoint !== "string" || endpoint.length === 0) return { ok: false, why: "OTEL_EXPORTER_OTLP_ENDPOINT is not set" };
    let url;
    try {
        url = new URL(endpoint.endsWith("/") ? `${endpoint}v1/metrics` : `${endpoint}/v1/metrics`);
    } catch {
        return { ok: false, why: `OTEL_EXPORTER_OTLP_ENDPOINT is not a URL (${JSON.stringify(endpoint)})` };
    }
    const headers = { "content-type": "application/json" };
    for (const pair of (env.OTEL_EXPORTER_OTLP_HEADERS ?? "").split(",")) {
        const at = pair.indexOf("=");
        if (at > 0) headers[pair.slice(0, at).trim().toLowerCase()] = pair.slice(at + 1).trim();
    }
    return { ok: true, url: url.href, headers };
}

/**
 * The real send. **Injected everywhere it is exercised**, and that is a rule rather than a
 * convenience: `../.portulan/verify/tests.sh` runs the suite, so a test opening a real socket would
 * be a network call inside a verify recipe — which `../spec/slots.md` and
 * `../.portulan/verify/README.md` both prohibit outright. The suite tests this module against an
 * injected transport; the real socket is exercised in the session's recorded demonstration, outside
 * the recipe set.
 */
export async function postJson(url, headers, body) {
    const res = await fetch(url, { method: "POST", headers, body });
    return { status: res.status, ok: res.ok, text: await res.text().catch(() => "") };
}

/**
 * Is the consent COMMITTED, or merely present in somebody's working copy?
 *
 * **The ruling is that the committed config is the standing consent — so an uncommitted config is not
 * consent at all.** Without this check an agent could write `enabled: true` into a working copy and
 * export on nobody's decision, and the maintainer's Gated act would have been performed by the thing
 * it gates. That is a mandate nothing checks, which this repository holds to be another way of
 * spelling broken (`../.portulan/memory/a-mandate-nothing-checks-is-already-broken.md`), arriving
 * inside the change that states the mandate.
 *
 * The discipline is `./drills.mjs`'s, one file wide: it **reports on a commit and says which one**.
 * Tracked, and byte-identical to `HEAD`, or `--export` refuses.
 *
 * **This is the ONLY path in this module that spawns anything**, and it is on the `--export` arm
 * alone — `--render` and `--check` are what a verify recipe may run, and they touch neither a
 * subprocess nor a socket.
 */
export function consentIsCommitted(configPath, repoRoot, spawn = spawnSync) {
    // **`isInside` rather than a fresh `startsWith("..")`, and the first draft of this line was the
    // fresh one.** `./inside.mjs` exists because that spelling is wrong: a name beginning with `..` is
    // an ordinary filename, so `..telemetry.json` inside the repository reads as outside it. Here it
    // failed CLOSED — refusing a valid config rather than accepting an invalid one — which is the safe
    // direction and still the wrong answer, and it is the EIGHTH site of a rule that module reduced to
    // one carrier (https://github.com/sleepy-panda-srl/portulan/issues/331 counts seven it never
    // reached). Copilot round 1 on #362, and the module's own docblock had already argued it.
    const parent = path.resolve(repoRoot);
    const child = path.resolve(configPath);
    if (!isInside(parent, child)) {
        return { ok: false, why: `${configPath} is outside the repository at ${repoRoot}, so nothing can establish that it is committed` };
    }
    const rel = path.relative(parent, child);
    const git = (args) => spawn("git", ["-C", path.resolve(repoRoot), ...args], { encoding: "utf8" });

    // **`git` failing is not the same answer as *the file is untracked*, and this function collapsed
    // them.** Both refuse, so no export ever escaped — but a run against a directory that is not a
    // repository reported *"is not tracked by git, so it is one working copy's opinion"*, which sends a
    // reader to look at the wrong thing entirely. That is could-not-run wearing a verdict's words, in
    // the module whose own docblock spends a paragraph keeping those two apart, and beside a config
    // gate that gets it right. Git says which is which: **128** is *not a repository / bad revision*,
    // and 1 is the honest negative. Copilot round 4 on #362, through the suppressed channel.
    const gitFailed = (r, what) =>
        r.error
            ? `git could not be run to ${what} — ${r.error.message}`
            : r.status === 128
              ? `git could not ${what}: ${(r.stderr || "").trim() || `it exited 128, which is how it reports that ${path.resolve(repoRoot)} is not a repository, or has no HEAD`}`
              : null;

    const tracked = git(["ls-files", "--error-unmatch", "--", rel]);
    const trackedFailed = gitFailed(tracked, "establish whether the consent is committed");
    if (trackedFailed) return { ok: false, why: trackedFailed };
    if (tracked.status !== 0) {
        return { ok: false, why: `${rel} is not tracked by git, so it is one working copy's opinion rather than the team's committed consent` };
    }
    const head = git(["show", `HEAD:${rel}`]);
    const headFailed = gitFailed(head, `read ${rel} at HEAD`);
    if (headFailed) return { ok: false, why: headFailed };
    if (head.status !== 0) return { ok: false, why: `${rel} does not exist at HEAD, so the consent it states has never been committed` };

    let onDisk;
    try {
        onDisk = fs.readFileSync(path.resolve(configPath), "utf8");
    } catch (cause) {
        return { ok: false, why: `${rel} could not be re-read to compare against HEAD — ${cause.message}` };
    }
    if (onDisk !== head.stdout) {
        return { ok: false, why: `${rel} differs from HEAD — an edited consent is not a committed one. Commit it, or run --render to see what WOULD be sent` };
    }
    return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// The command line
// ---------------------------------------------------------------------------------------------

const USAGE = [
    "usage: node cli/telemetry.mjs --config <file> [--repo-root <dir>] [--render | --check <file> | --write <file> | --export]",
    "",
    "  --config <file>   the committed opt-in config; the ONLY gate on emission",
    "  --render          print the OTLP/HTTP JSON payload and open no socket (the default)",
    "  --check <file>    byte-compare the payload against a committed golden",
    "  --write <file>    rewrite that golden",
    "  --export          the ONE mode that reaches the network; refuses unless the config opts in",
    "                    AND is committed, and reads OTEL_EXPORTER_OTLP_ENDPOINT / _HEADERS",
    "  --audit-recipes   assert that no recipe the workspace YIELDS can reach a network mode;",
    "                    takes --workspace and --pack-root, and needs no --config",
    "",
    "exit 0 the thing asked for happened · 1 a verdict (golden drift, or export while opted out)",
    "       · 2 could not run (config or snapshot missing, unreadable, or malformed)",
].join("\n");

function parseArgs(argv) {
    const opts = { config: null, repoRoot: ".", render: false, check: null, write: null, export: false, audit: false, workspace: ".portulan", packRoots: [], help: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        const next = () => {
            const v = argv[i + 1];
            if (v === undefined) throw new Error(`${a} needs a value`);
            i += 1;
            return v;
        };
        if (a === "--config") opts.config = next();
        else if (a === "--repo-root") opts.repoRoot = next();
        else if (a === "--render") opts.render = true;
        else if (a === "--check") opts.check = next();
        else if (a === "--write") opts.write = next();
        else if (a === "--export") opts.export = true;
        else if (a === "--audit-recipes") opts.audit = true;
        else if (a === "--workspace") opts.workspace = next();
        else if (a === "--pack-root") opts.packRoots.push(next());
        else if (a === "--help" || a === "-h") opts.help = true;
        else throw new Error(`unrecognised argument ${JSON.stringify(a)}`);
    }
    return opts;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

export async function run(argv = process.argv.slice(2), io = console, { env = process.env, post = postJson } = {}) {
    let opts;
    try {
        opts = parseArgs(argv);
    } catch (e) {
        io.error(`telemetry: ${e.message}`);
        io.error(USAGE);
        return 2;
    }
    if (opts.help) {
        io.log(USAGE);
        return 0;
    }
    // The audit is about the RECIPES, not about a payload, so it runs before the config is read and
    // needs no --config. A workspace that has not opted in still owes the property that none of its
    // recipes can reach the network.
    if (opts.audit) {
        const res = auditRecipes({ workspaceDir: opts.workspace, repoRoot: opts.repoRoot, packRoots: opts.packRoots });
        if (!res.ok) {
            io.error(`telemetry: the offline audit could not run — ${res.why}`);
            return 2;
        }
        if (res.findings.length > 0) {
            io.error(`telemetry: ${res.findings.length} verify recipe(s) can reach the network:`);
            for (const f of res.findings) io.error(`  - ${f.recipe} (${f.script}) invokes ${f.module} ${f.flag}, which ${f.what}`);
            io.error("A verify recipe may not make a network call: spec/slots.md and .portulan/verify/README.md");
            io.error("both prohibit it, because a rail that moves with the network goes red about the world");
            io.error("rather than about the tree.");
            return 1;
        }
        io.log(`telemetry: ${res.examined.length} yielded recipe(s) examined; none reaches a network mode`);
        io.log(`  Modes railed: ${NETWORK_MODES.map((m) => `${m.module} ${m.flag}`).join(", ")}.`);
        io.log("  A network mode with no row here is UNRAILED, and nothing can audit that a row was added.");
        return 0;
    }

    if (!opts.config) {
        io.error("telemetry: --config <file> is required — the committed config is the only gate on emission,");
        io.error("and a run that inferred one would be an emitter deciding its own consent.");
        return 2;
    }
    const modes = [opts.render, opts.check !== null, opts.write !== null, opts.export].filter(Boolean).length;
    if (modes > 1) {
        io.error("telemetry: --render, --check, --write and --export ask for different things; pick one");
        return 2;
    }

    // ---- the config. Unreadable and opted-out are DIFFERENT ANSWERS and get different codes.
    let config;
    try {
        config = readJson(opts.config);
    } catch (e) {
        io.error(`telemetry: cannot read ${opts.config} — ${e.message}`);
        io.error("This is could-not-run, NOT opted out: a config that will not parse may well say `enabled: true`.");
        return 2;
    }
    const problems = validateConfig(config);
    if (problems.length > 0) {
        io.error(`telemetry: ${opts.config} is not a usable opt-in config:`);
        for (const p of problems) io.error(`  - ${p}`);
        io.error("This is could-not-run, NOT opted out — a malformed config states no decision either way.");
        return 2;
    }

    // ---- the signals
    const signals = [];
    for (const name of config.signals) {
        const producer = PRODUCERS[name];
        const input = path.resolve(opts.repoRoot, producer.input);
        let snapshot;
        try {
            snapshot = readJson(input);
        } catch (e) {
            io.error(`telemetry: signal ${JSON.stringify(name)} cannot read its input ${input} — ${e.message}`);
            return 2;
        }
        const problems = producer.validate?.(snapshot) ?? [];
        if (problems.length > 0) {
            io.error(`telemetry: signal ${JSON.stringify(name)} cannot be metered from ${input}:`);
            for (const p of problems) io.error(`  - ${p}`);
            io.error("A malformed input would render a payload with defaulted metadata rather than none,");
            io.error("and the payload is the thing that leaves the machine.");
            return 2;
        }
        const capturedAt = producer.capturedAt(snapshot);
        if (typeof capturedAt !== "string" || Number.isNaN(Date.parse(capturedAt))) {
            io.error(`telemetry: signal ${JSON.stringify(name)} has no parsable capture stamp (${JSON.stringify(capturedAt)});`);
            io.error("OTLP needs the instant the measurement is ABOUT, and a clock read here would be a different figure.");
            return 2;
        }
        signals.push({ name, scope: producer.scope, capturedAt, rows: producer.rows(snapshot), attributes: producer.attributes(snapshot), resource: producer.resource?.(snapshot) ?? {} });
    }

    let body;
    try {
        body = serialize(renderPayload({ config, signals }));
    } catch (e) {
        io.error(`telemetry: the payload could not be encoded — ${e.message}`);
        return 2;
    }

    const emitted = signals.reduce((n, s) => n + s.rows.filter((r) => r.value !== null && Number.isFinite(r.value)).length, 0);

    // ---- --write
    if (opts.write !== null) {
        fs.mkdirSync(path.dirname(path.resolve(opts.write)), { recursive: true });
        fs.writeFileSync(opts.write, body);
        io.log(`telemetry: wrote ${opts.write} — ${emitted} metric(s) over ${signals.length} signal(s)`);
        return 0;
    }

    // ---- --check
    if (opts.check !== null) {
        let onDisk;
        try {
            onDisk = fs.readFileSync(opts.check, "utf8");
        } catch (e) {
            io.error(`telemetry: cannot read ${opts.check} — ${e.message}`);
            io.error("The golden is generated; run with --write to create it.");
            return 2;
        }
        if (onDisk !== body) {
            io.error(`telemetry: ${opts.check} is out of date against the payload this config renders`);
            io.error("It is generated and byte-compared. Regenerate it with --write; do not edit it by hand.");
            return 1;
        }
        io.log(`telemetry: ${opts.check} is byte-identical to the rendered payload (${emitted} metric(s))`);
        return 0;
    }

    // ---- --export, the one mode that reaches the network
    if (opts.export) {
        // The gate, spelled ONCE and here. Non-zero and a sentence: for this tool silence is never an
        // answer, because an opted-out emitter and a broken one are both silent.
        if (config.enabled !== true) {
            io.error(`telemetry: ${opts.config} says enabled: false, so nothing was sent.`);
            io.error("This is a verdict, not a failure: the config was read and it opts out. Emission is");
            io.error("the maintainer's Gated act — the committed config is the standing consent, and this");
            io.error("workspace has not given it. Use --render to see exactly what WOULD be sent.");
            return 1;
        }
        // The consent must be COMMITTED, not merely written. See `consentIsCommitted`.
        const committed = consentIsCommitted(opts.config, opts.repoRoot);
        if (!committed.ok) {
            io.error(`telemetry: --export cannot run — ${committed.why}.`);
            io.error("The ruling of 2026-08-28 is that the COMMITTED config is the standing consent, so a");
            io.error("config that is not committed states nobody's decision. This is could-not-run, not a refusal.");
            return 2;
        }
        const t = transportFromEnv(env);
        if (!t.ok) {
            io.error(`telemetry: --export cannot run — ${t.why}.`);
            io.error("Transport comes from the OpenTelemetry standard environment; nothing is committed here.");
            return 2;
        }
        let res;
        try {
            res = await post(t.url, t.headers, body);
        } catch (e) {
            io.error(`telemetry: the export failed — ${e.message}`);
            io.error("Nothing is queued and nothing is retried: a queue that flushes itself later is a send");
            io.error("nobody attended, which is what the Gated tier exists to prevent.");
            return 2;
        }
        if (!res.ok) {
            io.error(`telemetry: the collector answered ${res.status}${res.text ? ` — ${res.text.slice(0, 200)}` : ""}`);
            return 1;
        }
        // The endpoint is printed, the headers never are: a header list is where a bearer token lives.
        io.log(`telemetry: exported ${emitted} metric(s) to ${t.url} — ${res.status}`);
        return 0;
    }

    // ---- --render, the default. No socket is opened on this path.
    io.log(body);
    io.log(`telemetry: rendered ${emitted} metric(s) over ${signals.length} signal(s); nothing was sent.`);
    io.log(`  This workspace's config says enabled: ${config.enabled}. --export is the only mode that`);
    io.log("  reaches the network, and it refuses unless the committed config opts in.");
    io.log("  Every figure is a Gauge stamped with the instant it is ABOUT, not the instant it was sent;");
    io.log("  a stale snapshot therefore exports a stale timestamp, labelled as such rather than hidden.");
    return 0;
}

// The entry guard, in the ONE form `./rule-carriers.mjs` designates — copied rather than re-derived,
// as `./drills.mjs` and `./fuzz-shell.mjs` both are. `file://${argv[1]}` is NOT that form:
// `import.meta.url` percent-encodes and a working copy under a path with spaces then never matches,
// so the tool exits 0 having never started. Four files here have shipped that defect.
//
// **It matters more in this file than in any of them.** An emitter that never starts sends nothing,
// and an emitter that is correctly opted out also sends nothing. The two are indistinguishable from
// outside, so the guard is the difference between a working gate and a tool that has silently stopped.
function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    if (import.meta.url === pathToFileURL(invoked).href) return true;
    try {
        return import.meta.url === pathToFileURL(fs.realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

// `process.exitCode` rather than `process.exit`, which `./control-chars.mjs` settled here: exiting
// outright can truncate a pipe that has not drained, and a truncated line IS exit 0 with no output.
if (isMain()) {
    run(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}

