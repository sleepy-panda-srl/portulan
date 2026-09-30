#!/usr/bin/env node
// The review-loop meter: the figures that bound this repository's review loop, derived from its reviews.
//
// Fix-rounds are not derivable from the API: whether a push answers a submission is a fact about its contents.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SNAPSHOT_VERSION = "1";

// A prefix, not an equality: the reviewer is `copilot-pull-request-reviewer[bot]` on reviews and `Copilot` on comments.
export const REVIEWER_PREFIX = "copilot";

// The review-loop rule retires once submissions per pull request stay below this for a full milestone.
export const RETIRE_THRESHOLD = 2.0;

const isReviewer = (login) =>
    typeof login === "string" && login.toLowerCase().startsWith(REVIEWER_PREFIX);

// ---------------------------------------------------------------------------------------------
// The computation: pure, a snapshot in and numbers out
// ---------------------------------------------------------------------------------------------

// `pushes` is a floor: a push no review judged leaves no trace here.
export function meterPullRequest(pr) {
    const submissions = pr.submissions ?? [];
    const heads = new Set();
    let noInline = 0;
    for (const s of submissions) {
        if (typeof s.head === "string" && s.head.length > 0) heads.add(s.head);
        if ((s.inline ?? 0) === 0) noInline += 1;
    }
    return {
        number: pr.number,
        submissions: submissions.length,
        noInline,
        findingBearing: submissions.length - noInline,
        pushes: heads.size,
    };
}

// A ratio over an empty denominator is null, never 0: an unmeasured loop is not a measured zero.
export function meter(snapshot) {
    const perPullRequest = (snapshot.pullRequests ?? []).map(meterPullRequest);
    const total = (key) => perPullRequest.reduce((sum, p) => sum + p[key], 0);

    const pullRequests = perPullRequest.length;
    const submissions = total("submissions");
    const noInline = total("noInline");
    const findingBearing = total("findingBearing");
    const pushes = total("pushes");
    const ratio = (num, den) => (den === 0 ? null : num / den);

    return {
        repository: snapshot.repository ?? null,
        captured: snapshot.captured ?? null,
        window: snapshot.window ?? null,
        pullRequests,
        submissions,
        noInline,
        findingBearing,
        pushes,
        submissionsPerPullRequest: ratio(submissions, pullRequests),
        noInlineRate: ratio(noInline, submissions),
        pushesPerPullRequest: ratio(pushes, pullRequests),
        pushesPerSubmission: ratio(pushes, submissions),
        pushesPerFindingBearingSubmission: ratio(pushes, findingBearing),
        pushesCoincideWithSubmissions: pushes === submissions,
        belowRetireThreshold:
            ratio(submissions, pullRequests) === null
                ? null
                : ratio(submissions, pullRequests) < RETIRE_THRESHOLD,
        perPullRequest,
    };
}

// ---------------------------------------------------------------------------------------------
// The snapshot's shape, checked before metering: malformed is exit 2, never 1
// ---------------------------------------------------------------------------------------------

export function validateSnapshot(snapshot) {
    const problems = [];
    if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        return ["the snapshot is not a JSON object"];
    }
    const version = snapshot.portulan?.reviewSnapshot;
    if (version !== SNAPSHOT_VERSION) {
        problems.push(
            `portulan.reviewSnapshot is ${JSON.stringify(version)}; this tool reads ${JSON.stringify(SNAPSHOT_VERSION)}`,
        );
    }
    if (typeof snapshot.repository !== "string" || snapshot.repository.length === 0) {
        problems.push("repository is missing");
    }
    if (typeof snapshot.captured !== "string" || snapshot.captured.length === 0) {
        problems.push("captured is missing — a snapshot with no date cannot be read as evidence");
    }
    if (!Array.isArray(snapshot.pullRequests)) {
        problems.push("pullRequests is not an array");
        return problems;
    }
    if (!Number.isInteger(snapshot.window?.merged) || snapshot.window.merged < 0) {
        problems.push(
            `window.merged is ${JSON.stringify(snapshot.window?.merged)}; the register prints it as the size of the sample`,
        );
    } else if (snapshot.window.merged !== snapshot.pullRequests.length) {
        problems.push(
            `window.merged says ${snapshot.window.merged} and the snapshot carries ${snapshot.pullRequests.length} pull request(s)`,
        );
    }
    const seen = new Set();
    let previous = null;
    for (const pr of snapshot.pullRequests) {
        if (!Number.isInteger(pr?.number)) {
            problems.push(`a pull request entry has no integer number: ${JSON.stringify(pr?.number)}`);
            continue;
        }
        if (seen.has(pr.number)) problems.push(`pull request ${pr.number} appears twice`);
        seen.add(pr.number);
        const merged = typeof pr.mergedAt === "string" ? Date.parse(pr.mergedAt) : Number.NaN;
        if (Number.isNaN(merged)) {
            problems.push(
                `pull request ${pr.number} has no parsable mergedAt (${JSON.stringify(pr.mergedAt)}) — ` +
                    "the window cannot be shown to be by merge date",
            );
        } else {
            if (previous !== null && merged > previous) {
                problems.push(
                    `pull request ${pr.number} merged at ${pr.mergedAt}, after the entry before it — ` +
                        "the window is not in descending merge order, so it is not the most recently merged N",
                );
            }
            previous = merged;
        }
        if (!Array.isArray(pr.submissions)) {
            problems.push(`pull request ${pr.number} has no submissions array`);
            continue;
        }
        for (const s of pr.submissions) {
            if (!isReviewer(s?.login)) {
                problems.push(
                    `pull request ${pr.number} carries a submission by ${JSON.stringify(s?.login)}, which is not the reviewer`,
                );
            }
            if (!Number.isInteger(s?.inline) || s.inline < 0) {
                problems.push(
                    `pull request ${pr.number} has a submission with no inline count: ${JSON.stringify(s?.inline)}`,
                );
            }
            if (typeof s?.head !== "string" || s.head.length === 0) {
                problems.push(
                    `pull request ${pr.number} has a submission with no head sha: ${JSON.stringify(s?.head)} — pushes are counted from it`,
                );
            }
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------------------------
// The register: the figures as a committed document, regenerated and byte-compared
// ---------------------------------------------------------------------------------------------

const round2 = (n) => (n === null ? "—" : (Math.round(n * 100) / 100).toFixed(2));
const pct = (n) => (n === null ? "—" : `${(Math.round(n * 1000) / 10).toFixed(1)}%`);

export function renderRegister(m) {
    const lines = [];
    lines.push("# Review-loop register — portulan");
    lines.push("");
    lines.push("> Generated from `snapshot.json` by `node cli/review-meter.mjs`. Do not edit by hand:");
    lines.push("> it is regenerated and byte-compared, so a hand-edit survives exactly until the next run.");
    lines.push(">");
    lines.push("> **Every figure here is in SUBMISSION units** — every review the reviewer submits, one");
    lines.push("> per push, including on the branch as opened. It is not the fix-round unit that");
    lines.push("> `../../.portulan/memory/a-review-loop-needs-a-bound.md` rule 4 bounds, and no figure");
    lines.push("> here may be read as one. See `../../cli/review-meter.mjs` for why fix-rounds are not");
    lines.push("> derivable from the API at all.");
    lines.push("");
    lines.push(`- **Repository:** \`${m.repository}\``);
    lines.push(`- **Captured:** ${m.captured}`);
    lines.push(`- **Window:** ${m.window?.merged ?? "—"} most recently merged pull request(s)`);
    lines.push("");
    lines.push("## The figures");
    lines.push("");
    lines.push("| Measure | Unit | Value |");
    lines.push("|---|---|---|");
    lines.push(`| Pull requests | count | ${m.pullRequests} |`);
    lines.push(`| Submissions | count | ${m.submissions} |`);
    lines.push(`| Submissions per pull request | ratio | ${round2(m.submissionsPerPullRequest)} |`);
    lines.push(`| Submissions with no inline comment | count | ${m.noInline} |`);
    lines.push(`| — as a rate, an **upper bound** on the found-nothing rate | rate | ${pct(m.noInlineRate)} |`);
    lines.push(`| Pushes the reviewer saw | floor | ${m.pushes} |`);
    lines.push(`| Pushes per pull request | ratio | ${round2(m.pushesPerPullRequest)} |`);
    lines.push(`| Pushes per **submission** — the criterion's literal figure | ratio | ${round2(m.pushesPerSubmission)} |`);
    lines.push(`| Pushes per finding-bearing submission | ratio | ${round2(m.pushesPerFindingBearingSubmission)} |`);
    lines.push("");
    if (m.pushesCoincideWithSubmissions) {
        lines.push(
            "**Two of those rows are one row.** Every submission in this window judged its own head, " +
                "so pushes and submissions coincide exactly and the last ratio is not an independent " +
                "measurement: it is `1 / (1 - the no-inline rate)`. That is what `review_on_push: true` " +
                "does to this pair, and it is stated here rather than left to be discovered by a reader " +
                "dividing the columns.",
        );
        lines.push("");
    }
    lines.push("## Against the record's own retirement threshold");
    lines.push("");
    lines.push(
        `\`a-review-loop-needs-a-bound.md\` retires when submissions per pull request measures below ` +
            `**${RETIRE_THRESHOLD.toFixed(1)}** for a full milestone. This window measures ` +
            `**${round2(m.submissionsPerPullRequest)}**, which is ` +
            `${m.belowRetireThreshold === null ? "unmeasured" : m.belowRetireThreshold ? "**below**" : "**at or above**"} it.`,
    );
    lines.push("");
    lines.push(
        "**A window is not a milestone.** Which pull requests belong to which milestone row is not a " +
            "field the API carries, so this tool measures a window of merged pull requests and the " +
            "record's *for a full milestone* clause is not evaluated here. Reading this row as the " +
            "retirement condition met would be reading a different measure than the one the record " +
            "states.",
    );
    lines.push("");
    lines.push("## Per pull request");
    lines.push("");
    lines.push("| PR | Submissions | No inline | Finding-bearing | Pushes (floor) |");
    lines.push("|---|---|---|---|---|");
    for (const p of m.perPullRequest) {
        lines.push(`| #${p.number} | ${p.submissions} | ${p.noInline} | ${p.findingBearing} | ${p.pushes} |`);
    }
    lines.push("");
    return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------------------------
// The fetch. The ONE mode that talks to anything.
// ---------------------------------------------------------------------------------------------

const gh = (args) => {
    const out = spawnSync("gh", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
    if (out.error) throw new Error(`gh ${args[0]} ${args[1] ?? ""}: ${out.error.message}`);
    if (out.status !== 0) throw new Error(`gh exited ${out.status}: ${(out.stderr || "").trim()}`);
    return out.stdout;
};

// By merge date, which `gh pr list`'s number order is not; ties by number, so a re-capture is byte-stable.
export function selectWindow(listed, limit) {
    // An unparsable stamp sorts last rather than throwing: the validator reports it, and the other rows still land.
    const at = (x) => {
        const t = Date.parse(x?.mergedAt);
        return Number.isNaN(t) ? -Infinity : t;
    };
    return [...listed]
        .sort((a, b) => (at(a) === at(b) ? b.number - a.number : at(b) - at(a)))
        .slice(0, limit);
}

// `pull_request_review_id` ties an inline comment to its review across the two logins.
export function shapeSubmissions(reviews, comments) {
    const inlineByReview = new Map();
    for (const c of comments) {
        if (!isReviewer(c?.user?.login)) continue;
        const id = c.pull_request_review_id;
        inlineByReview.set(id, (inlineByReview.get(id) ?? 0) + 1);
    }
    return reviews
        .filter((r) => isReviewer(r?.user?.login))
        .map((r) => ({
            id: r.id,
            login: r.user.login,
            state: r.state,
            // From the review, never a comment: a comment's `commit_id` drifts onto later heads.
            head: r.commit_id,
            at: r.submitted_at,
            inline: inlineByReview.get(r.id) ?? 0,
        }));
}

// `--paginate` on both surfaces: page 1 of a busy pull request misses its latest reviews.
export function fetchSnapshot({ repository, limit, pool, now }) {
    const listed = JSON.parse(
        gh(["pr", "list", "--repo", repository, "--state", "merged", "--limit", String(pool), "--json", "number,mergedAt"]),
    );
    const saturated = listed.length >= pool;
    const window = selectWindow(listed, limit);
    const pullRequests = [];
    for (const { number, mergedAt } of window) {
        const reviews = JSON.parse(gh(["api", "--paginate", `repos/${repository}/pulls/${number}/reviews`]));
        const comments = JSON.parse(gh(["api", "--paginate", `repos/${repository}/pulls/${number}/comments`]));
        // No bodies: review prose has no place in a committed snapshot.
        pullRequests.push({ number, mergedAt, submissions: shapeSubmissions(reviews, comments) });
    }
    return {
        portulan: { reviewSnapshot: SNAPSHOT_VERSION },
        repository,
        captured: now,
        window: { merged: pullRequests.length, pool, poolSaturated: saturated },
        pullRequests,
    };
}

// ---------------------------------------------------------------------------------------------
// The command line.
// ---------------------------------------------------------------------------------------------

const USAGE = [
    "usage: node cli/review-meter.mjs --snapshot <file> [--register <file>] [--check | --write]",
    "       node cli/review-meter.mjs --fetch --repo <owner/name> [--limit N] [--pool N] --out <file>",
    "",
    "  --snapshot <file>   the captured review data to meter (never the network)",
    "  --register <file>   also render the register; --check byte-compares it, --write rewrites it",
    "  --fetch             the one mode that talks to GitHub; needs `gh` on the path",
    "  --pool N            how many merged pull requests to LIST before taking the newest --limit by",
    "                      merge date; `gh pr list` orders by number, which is not merge order",
    "",
    "exit 0 green · 1 red · 2 could not run",
].join("\n");

function parseArgs(argv) {
    const opts = { snapshot: null, register: null, check: false, write: false, fetch: false, repo: null, limit: 30, pool: 200, out: null, help: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        const next = () => {
            const v = argv[i + 1];
            if (v === undefined) throw new Error(`${a} needs a value`);
            i += 1;
            return v;
        };
        if (a === "--snapshot") opts.snapshot = next();
        else if (a === "--register") opts.register = next();
        else if (a === "--check") opts.check = true;
        else if (a === "--write") opts.write = true;
        else if (a === "--fetch") opts.fetch = true;
        else if (a === "--repo") opts.repo = next();
        else if (a === "--limit") opts.limit = Number.parseInt(next(), 10);
        else if (a === "--pool") opts.pool = Number.parseInt(next(), 10);
        else if (a === "--out") opts.out = next();
        else if (a === "--help" || a === "-h") opts.help = true;
        else throw new Error(`unrecognised argument ${JSON.stringify(a)}`);
    }
    return opts;
}

export function run(argv = process.argv.slice(2), io = console) {
    let opts;
    try {
        opts = parseArgs(argv);
    } catch (e) {
        io.error(`review-meter: ${e.message}`);
        io.error(USAGE);
        return 2;
    }
    if (opts.help) {
        io.log(USAGE);
        return 0;
    }
    if (opts.check && opts.write) {
        io.error("review-meter: --check and --write ask for opposite things; pick one");
        return 2;
    }
    if ((opts.check || opts.write) && !opts.register) {
        io.error(`review-meter: ${opts.check ? "--check" : "--write"} needs --register <file> — it is the register that is written and compared`);
        io.error("Without it this flag would do nothing and still exit 0.");
        return 2;
    }

    if (opts.fetch) {
        if (!opts.repo || !opts.out) {
            io.error("review-meter: --fetch needs --repo <owner/name> and --out <file>");
            return 2;
        }
        if (!Number.isInteger(opts.limit) || opts.limit < 1) {
            io.error(`review-meter: --limit must be a positive integer, not ${JSON.stringify(opts.limit)}`);
            return 2;
        }
        if (!Number.isInteger(opts.pool) || opts.pool <= opts.limit) {
            io.error(`review-meter: --pool must be an integer greater than --limit (${opts.limit}), not ${JSON.stringify(opts.pool)}`);
            io.error("The pool is listed by pull request NUMBER and the window is taken from it by merge date,");
            io.error("so a pool the size of the window is just number order wearing the window's name.");
            return 2;
        }
        let snapshot;
        try {
            snapshot = fetchSnapshot({ repository: opts.repo, limit: opts.limit, pool: opts.pool, now: new Date().toISOString() });
        } catch (e) {
            io.error(`review-meter: the fetch failed — ${e.message}`);
            io.error("A fetch that could not read is never a loop with nothing in it.");
            return 2;
        }
        fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
        fs.writeFileSync(opts.out, `${JSON.stringify(snapshot, null, 2)}\n`);
        io.log(`review-meter: wrote ${opts.out} — ${snapshot.pullRequests.length} pull request(s), newest merged first`);
        if (snapshot.window.poolSaturated) {
            io.log(`review-meter: the pool of ${opts.pool} came back full, so an older-numbered pull request`);
            io.log("  merged recently could sit outside it. Raise --pool to make the window provable.");
        }
        return 0;
    }

    if (!opts.snapshot) {
        io.error("review-meter: --snapshot <file> is required");
        io.error(USAGE);
        return 2;
    }
    let raw;
    try {
        raw = fs.readFileSync(opts.snapshot, "utf8");
    } catch (e) {
        io.error(`review-meter: cannot read ${opts.snapshot} — ${e.message}`);
        return 2;
    }
    let snapshot;
    try {
        snapshot = JSON.parse(raw);
    } catch (e) {
        io.error(`review-meter: ${opts.snapshot} is not JSON — ${e.message}`);
        return 2;
    }
    const problems = validateSnapshot(snapshot);
    if (problems.length > 0) {
        io.error(`review-meter: ${opts.snapshot} cannot be metered:`);
        for (const p of problems) io.error(`  - ${p}`);
        return 2;
    }

    const m = meter(snapshot);
    io.log(`review-meter: ${m.repository} — ${m.pullRequests} pull request(s) merged, captured ${m.captured}`);
    io.log(`  submissions                            ${m.submissions}`);
    io.log(`  submissions per pull request           ${round2(m.submissionsPerPullRequest)}`);
    io.log(`  submissions with no inline comment     ${m.noInline}  (${pct(m.noInlineRate)})`);
    io.log(`  pushes the reviewer saw (a floor)      ${m.pushes}`);
    io.log(`  pushes per pull request                ${round2(m.pushesPerPullRequest)}`);
    io.log(`  pushes per submission                  ${round2(m.pushesPerSubmission)}   <- the criterion's literal figure`);
    io.log(`  pushes per finding-bearing submission  ${round2(m.pushesPerFindingBearingSubmission)}`);
    io.log(
        `  retire threshold (${RETIRE_THRESHOLD.toFixed(1)} submissions/PR)  ` +
            `${m.belowRetireThreshold === null ? "unmeasured" : m.belowRetireThreshold ? "BELOW" : "at or above"}`,
    );
    if (m.pushesCoincideWithSubmissions) {
        io.log("");
        io.log("  Pushes and submissions COINCIDE in this window, so the last ratio is not an");
        io.log("  independent measurement — it is 1 / (1 - the no-inline rate). Two rows, one figure.");
    }

    io.log("");
    io.log("  Every figure above is in SUBMISSION units and none of them is a fix-round count.");
    io.log("  Fix-rounds are not derivable here: a fix can ride inside another push, and a records");
    io.log("  push after a finding-bearing submission answers nothing. See cli/review-meter.mjs.");
    io.log("  The no-inline rate is an UPPER BOUND on the found-nothing rate — a submission carrying");
    io.log("  only suppressed low-confidence notes is counted in it, and separating those needs the");
    io.log("  workspace-layer matcher rather than a second copy of it here.");
    io.log("  This is a meter. It reports; it does not bound, and it adjudicates no exemption.");

    if (!opts.register) return 0;

    const rendered = renderRegister(m);
    if (opts.write) {
        fs.mkdirSync(path.dirname(path.resolve(opts.register)), { recursive: true });
        fs.writeFileSync(opts.register, rendered);
        io.log(`review-meter: wrote ${opts.register}`);
        return 0;
    }
    if (!opts.check) {
        io.log(rendered);
        return 0;
    }
    let onDisk;
    try {
        onDisk = fs.readFileSync(opts.register, "utf8");
    } catch (e) {
        io.error(`review-meter: cannot read ${opts.register} — ${e.message}`);
        io.error("The register is generated; run with --write to create it.");
        return 2;
    }
    if (onDisk !== rendered) {
        io.error(`review-meter: ${opts.register} is out of date against the snapshot`);
        io.error("It is generated and byte-compared. Regenerate it with --write; do not edit it by hand.");
        return 1;
    }
    io.log(`review-meter: ${opts.register} is byte-identical to the snapshot's figures`);
    return 0;
}

// As file URLs, since `import.meta.url` percent-encodes a space; through realpath too, for an npm `bin` symlink.
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

// `process.exitCode` rather than `process.exit`, so a pipe that has not drained is not cut short.
if (isMain()) process.exitCode = run(process.argv.slice(2));
