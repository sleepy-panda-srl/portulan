#!/usr/bin/env node
// The review-loop meter — the three figures that bound this repository's review loop, derived
// instead of counted by hand.
//
// Milestone 8, clause (c): *review-loop metering in the telemetry clause — rounds per pull request,
// pushes per round, empty-round rate.* The argument for the clause is in
// `../docs/milestones/m08.md`; what belongs here is what each figure IS, which of them the API can
// answer, and — at more length than is comfortable — which of them it cannot.
//
// ## Why this tool exists at all
//
// `../.portulan/memory/a-review-loop-needs-a-bound.md` bounds the loop on a table of figures — 110
// submissions over 30 pull requests, 29% of them finding nothing — every one of which was counted by
// hand on 2026-07-28. That record says of itself, in its own *Why it holds* section, **"Nothing
// checks it — discipline, not a rail"**, citing
// `../.portulan/memory/a-mandate-nothing-checks-is-already-broken.md`. The 2026-07-28 amendment
// answers it in as many words: *"the telemetry clause is where that checker's home is, and naming the
// home is what this amendment does rather than claiming the checker exists."* This file is that
// checker arriving at the home the amendment named.
//
// A hand-counted figure whose subject keeps growing is this repository's most-repeated defect — it
// has now been repaired in the recipe counts of `../.portulan/repos/portulan.md`, the CLI roster of
// `./README.md`, and the operator total in `../evals/README.md`, each time the same way: **delete the
// tally and name the command that derives it.** The loop's figures are the last hand-maintained set
// of any consequence, and they are the ones a rule leans on.
//
// ## The word "round" moved, and the criterion predates the move
//
// This is the first thing to settle, because two of the criterion's three figures are named in a unit
// that was redefined after the criterion was written, and reading them in today's unit yields a
// different tool.
//
// The criterion was written **2026-07-28**. On **2026-07-30** the maintainer defined a round as *a
// Copilot review the working session answers with a push*
// (`../.portulan/handoffs/2026-07-30-a-round-gets-its-definition.md`), and the rule's table was
// **re-labelled, not re-counted**: its figures had always counted **submissions** — every review
// Copilot submits, one per push under `review_on_push: true`, including on the branch as opened —
// and the table's own units note says so. The rule's `Retire when:` line settles it beyond argument,
// naming its threshold in *"the submission units of the table above, **not fix-rounds**"*.
//
// So the criterion's *"rounds per pull request"* is **submissions per pull request**, and that is
// what this tool computes under that name. It never prints the bare word "rounds" for a figure,
// because the word has meant two things here and a figure whose unit is ambiguous is the exact defect
// #119 was opened to repair.
//
// ## What the API can answer, and the one thing it cannot
//
// **Submissions: exactly.** A review on `/pulls/N/reviews` whose author is the reviewer. Two traps,
// both measured on this repository rather than reasoned about:
//
//   * **One actor, two logins.** `copilot-pull-request-reviewer[bot]` on `/reviews`, plain `Copilot`
//     on `/pulls/N/comments`; a filter on either returns zero from the other, which is how #105's
//     count was first mis-measured as zero. Matching is therefore a case-insensitive prefix over both
//     surfaces, never an equality against one spelling.
//   * **Our own reviews are on that endpoint too.** The agent identity's replies and derived verdicts
//     are submitted as REVIEWS, so an unfiltered count is inflated by our own traffic: **at merge,
//     seven of #105's fifteen review objects are `portulan-agent[bot]`, and ninety of #342's hundred
//     and two.** Both figures are stamped *at merge* on purpose — the pre-commit checkpoint measured
//     them and found this file carrying *six of fifteen* and *seventy-four of eighty-one*, which were
//     the counts **mid-loop** (74/81 was true at 17:58:40Z on #342, which merged at 18:49:40Z). A
//     hand-counted figure about a subject still growing is the exact defect this whole tool exists to
//     retire, reproduced inside the fix for it.
//     That is also why every read here is **paginated** — page 1 of a busy pull request is measurably
//     stale, and on #342 page 1 carries three reviewer entries while the one on head is the twelfth.
//
// **Pushes: as a floor.** Under `review_on_push: true` each push draws one submission, so the
// distinct heads the reviewer judged are the pushes it saw. It is a floor rather than a count,
// because a push that drew no review — the ruleset not requesting one, a review still in flight at
// merge — leaves no trace here, and a force-push destroys the commits it replaced. Printed as a floor
// and never as a total.
//
// **Fix-rounds: NOT AT ALL, and this is the finding rather than a gap to apologise for.** A fix-round
// is a push that *answers* a submission, and whether a push answers one is a fact about its contents.
// Two measured demonstrations, both from the pull request that produced the definition:
//
//   * On #105, `08d7d10` answered review 4's inline finding and **was never a reviewed head** — it
//     rode inside the next push. Enumerating heads cannot see it. The 2026-07-30 ruling states the
//     method that can: *"Count pushes, then look inside each one."*
//   * Also on #105, the push at `cff3e4e0` follows a submission whose body ran to 4,087 bytes and
//     answers none of it — it carried records. A rule keyed on *"a finding-bearing submission
//     preceded this push"* calls that a fix-round; the maintainer's table calls it *no*.
//
// So this tool does not compute fix-rounds, does not estimate them, and does not print a figure that
// could be mistaken for them. The criterion's *"pushes per round"* is reported in the one unit
// available without adjudication — **pushes per finding-bearing submission** — under that name, with
// the difference stated in the output rather than left for a reader to assume away.
//
// ## The empty-round rate is reported as a BOUND, and the reason is a layering rule
//
// The rule's table counts submissions that found **nothing at all**. Finding nothing has two halves:
// no inline comment thread, *and* no suppressed low-confidence note in the review body. The first
// half is structural and this tool computes it exactly. The second is decided by a matcher — the awk
// in `../.github/workflows/copilot-review.yml`, fixtured in
// `../.portulan/verify/workflow-filters.mjs` — that is deliberately reduced to **one** carrier, and
// that carrier is a workspace-layer gate while this file is engine.
//
// Re-implementing it here would put a second spelling of one rule on the other side of the
// engine/workspace boundary, where neither could see the other drift. That is this repository's
// signature defect and `../.portulan/proposals/0027` exists to refuse it. So the tool reports what it
// can compute exactly and names the relation:
//
//     submissions that found nothing  ≤  submissions with no inline comment
//
// The right-hand side is what this prints, under its own name, as an **upper bound**.
//
// **What the layering rule does NOT establish is that the exact rate is out of reach**, and saying so
// is the difference between a limit and an excuse. The tree already holds a lift-and-run consumer of
// these very programs: `../.portulan/verify/workflow-filters.mjs` extracts each single-quoted awk
// program out of the workflow's parsed `run:` scalars and executes it through the real `awk`. `--fetch`
// already spawns, so a body could be piped through the **lifted** program at capture time and stored
// as one integer — no second spelling, and still no bodies in the snapshot. That is the closing move,
// it is a workspace-side consumer rather than a copy, and it is **not built here for budget** (one
// clause, one session) rather than because the boundary forbids it. Tracked as
// https://github.com/sleepy-panda-srl/portulan/issues/355 — filed, and the number is here because
// "filed rather than built" naming no filing is a claim in the past tense about an issue that does
// not exist, which this repository has already shipped once.
//
// ## What this tool is NOT
//
// **It is a meter, not a bound.** Rule 4 of the record above stops a loop at two fix-rounds; nothing
// here stops anything. The record's own honest-limits section already says the judgement it depends
// on is the interested party's about its own work, and a tool that reports after the merge does not
// change that. Nor does it adjudicate rule 4's **sibling** exemption, which is a judgement about
// whether one finding's governing rule was already enforced at another site — so *rounds past the
// bound* is not computable and is not claimed.
//
// **It reports on a snapshot, never on the network.** The computation takes data and the fetch is a
// separate mode, for the reason `./goldens.mjs` takes fixtures: a figure a verify recipe rails must be
// re-derivable from the tree, on a machine with no token and no network, and must not move because
// GitHub was slow. `--fetch` is the only mode that talks to anything.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SNAPSHOT_VERSION = "1";

// The reviewer's identity is a PREFIX over a lowercased login, never an equality. Both observed
// spellings — `copilot-pull-request-reviewer[bot]` and `Copilot` — start with it, and a third
// spelling of the same actor would too. The cost of the looser test is that a human login beginning
// "copilot" would be counted; the cost of the tighter one was a whole round read as missing (#154).
export const REVIEWER_PREFIX = "copilot";

// The threshold the record names for its own retirement: *submissions-per-pull-request measures below
// 2.0 for a full milestone*. Carried here as a number so the tool can say which side of it a window
// falls on; the record remains the authority on what crossing it means.
export const RETIRE_THRESHOLD = 2.0;

const isReviewer = (login) =>
    typeof login === "string" && login.toLowerCase().startsWith(REVIEWER_PREFIX);

// ---------------------------------------------------------------------------------------------
// The computation. Everything below takes a snapshot object and returns numbers; nothing here reads
// a file, runs a process, or knows what year it is.
// ---------------------------------------------------------------------------------------------

// A pull request's own figures. `submissions` counts the reviewer's reviews; `pushes` counts the
// distinct heads those reviews judged, which is a floor for the same reason stated in the header.
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

// The aggregate. Ratios are returned as `null` rather than as `0` or `NaN` when their denominator is
// empty: a corpus with no finding-bearing submission has no pushes-per-submission, and printing 0
// would be a claim about a loop nobody ran. `verify-preconditions-fail-closed` in prose.
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
        // **The criterion's own "pushes per round" in submission units, stated rather than inferred.**
        // Under `review_on_push: true` it is 1.00 by construction, which is why the row below it exists
        // at all — but a reader owed the criterion's literal figure should not have to derive it from a
        // paragraph about a coincidence. The pre-commit checkpoint asked for it in as many words.
        pushesPerSubmission: ratio(pushes, submissions),
        pushesPerFindingBearingSubmission: ratio(pushes, findingBearing),
        // **Is the push figure carrying any information the submission figure does not?**
        //
        // Under `review_on_push: true` a push draws a submission, so the two coincide whenever every
        // submission judged its own head — and when they do, `pushesPerFindingBearingSubmission`
        // is not a second measurement at all: it reduces to `1 / (1 - noInlineRate)`, an identity.
        // Measured 2026-08-26 over the thirty most recently merged pull requests: 140 submissions and
        // 140 pushes, exactly equal, and 140/46 = 3.04 = 1/(1 - 0.671).
        //
        // Three figures of which two are algebraically the same figure is a table that reads as more
        // evidence than it holds. So the coincidence is DETECTED and stated rather than left for a
        // reader to notice, which is the same discipline `./goldens.mjs` applies when it prints the
        // per-path census including the zeroes.
        pushesCoincideWithSubmissions: pushes === submissions,
        // Which side of the record's own retirement threshold this window falls on. `null` where the
        // ratio is null — an unmeasured window is not a window measuring below the threshold, and
        // conflating the two is how a rule gets retired on an empty corpus.
        belowRetireThreshold:
            ratio(submissions, pullRequests) === null
                ? null
                : ratio(submissions, pullRequests) < RETIRE_THRESHOLD,
        perPullRequest,
    };
}

// ---------------------------------------------------------------------------------------------
// The snapshot's own shape is checked before it is metered. A malformed snapshot must be exit 2 —
// "could not judge" — and never exit 1, which would report a review loop that nobody measured.
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
    // The `window` is printed in the register as a claim about what was sampled, so a window that
    // disagrees with the corpus beneath it is a false heading over true figures. Measured at the
    // pre-commit checkpoint: `{merged: 300}` over thirty pull requests rendered *"300 most recently
    // merged"* above *"| Pull requests | count | 30 |"*, rail green.
    if (!Number.isInteger(snapshot.window?.merged) || snapshot.window.merged < 1) {
        problems.push(
            `window.merged is ${JSON.stringify(snapshot.window?.merged)}; the register prints it as the size of the sample`,
        );
    } else if (snapshot.window.merged !== snapshot.pullRequests.length) {
        problems.push(
            `window.merged says ${snapshot.window.merged} and the snapshot carries ${snapshot.pullRequests.length} pull request(s)`,
        );
    }
    const seen = new Set();
    // **The window is BY MERGE DATE, and the snapshot must prove it.** `gh pr list` orders by pull
    // request NUMBER, and the two disagree: the first capture taken here carried three merge-order
    // inversions and sampled a corpus that was not the one its own register named — found at the
    // pre-commit checkpoint, from evidence inside the committed snapshot. A rail that only checked
    // the arithmetic would have re-published the same wrong window every time it was regenerated.
    let previous = null;
    for (const pr of snapshot.pullRequests) {
        if (!Number.isInteger(pr?.number)) {
            problems.push(`a pull request entry has no integer number: ${JSON.stringify(pr?.number)}`);
            continue;
        }
        if (seen.has(pr.number)) problems.push(`pull request ${pr.number} appears twice`);
        seen.add(pr.number);
        if (typeof pr.mergedAt !== "string" || pr.mergedAt.length === 0) {
            problems.push(`pull request ${pr.number} has no mergedAt — the window cannot be shown to be by merge date`);
        } else {
            if (previous !== null && pr.mergedAt > previous) {
                problems.push(
                    `pull request ${pr.number} merged at ${pr.mergedAt}, after the entry before it (${previous}) — ` +
                        "the window is not in descending merge order, so it is not the most recently merged N",
                );
            }
            previous = pr.mergedAt;
        }
        if (!Array.isArray(pr.submissions)) {
            problems.push(`pull request ${pr.number} has no submissions array`);
            continue;
        }
        for (const s of pr.submissions) {
            if (!isReviewer(s?.login)) {
                // A snapshot carrying a non-reviewer review means the fetch filter drifted, and the
                // figures would be inflated by our own traffic exactly as the header describes. That
                // is a snapshot this tool cannot judge, not a loop with a high count.
                problems.push(
                    `pull request ${pr.number} carries a submission by ${JSON.stringify(s?.login)}, which is not the reviewer`,
                );
            }
            if (!Number.isInteger(s?.inline) || s.inline < 0) {
                problems.push(
                    `pull request ${pr.number} has a submission with no inline count: ${JSON.stringify(s?.inline)}`,
                );
            }
            // **`head` is contracted exactly as `inline` is, and for the same sentence.** It was not,
            // and the gap was measured at the pre-commit checkpoint: strip every `head` and the tool
            // exits 0 printing `pushes  0` and regenerates a register carrying that zero — which is
            // what `meter()`'s own comment forbids one field over, *"printing 0 would be a claim about
            // a loop nobody ran"*. Two of the criterion's three metrics rest on this field.
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
// The register: the figures as a committed document, regenerated and byte-compared.
//
// The point of writing them down at all is that a snapshot is JSON nobody reads, and the figures are
// quoted by a rule. The point of byte-comparing them is that a published figure which can drift from
// its own data is the hand-maintained tally in a new costume — `./index.mjs` holds the memory index
// this way for the same reason.
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

// **The window is the most recently MERGED N, and `gh pr list` cannot answer that on its own.** It
// orders by pull request NUMBER, and number order is not merge order: the first capture taken here
// carried three inversions — #346 before #345, #343 before #342, #312 before #310 — so the sampled
// corpus contained #303 and excluded #301, while the register above it claimed *"the 30 most recently
// merged"*. Every published figure was therefore against a corpus its own heading did not name.
// Found at the pre-commit checkpoint, from evidence inside the committed snapshot: `mergedAt` was
// already being captured and nothing was sorting on it.
//
// So a POOL is listed and the window is taken from it by merge date. Sorted descending, ties broken by
// number descending so the order is total and a re-capture of the same data is byte-stable.
export function selectWindow(listed, limit) {
    return [...listed]
        .sort((a, b) => (a.mergedAt === b.mergedAt ? b.number - a.number : a.mergedAt < b.mergedAt ? 1 : -1))
        .slice(0, limit);
}

// An inline comment belongs to the review that carried it, and `pull_request_review_id` is what ties
// the two surfaces together across the login split. Pure, so the grouping and the login filter are
// testable without a network: they are where two of the measured traps live.
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
            // An inline COMMENT's `commit_id` drifts onto a later head, so the sha a round judged is
            // read from the REVIEW and never from a comment. That a review's own `commit_id` holds
            // still is an assumption with an open issue on it — #253, and the falsifier is stated at
            // length in this file's header rather than only here.
            head: r.commit_id,
            at: r.submitted_at,
            inline: inlineByReview.get(r.id) ?? 0,
        }));
}

// `--paginate` on both surfaces, never a bare read. Page 1 of a busy pull request is measurably stale
// here: on #342 ninety of a hundred and two review objects at merge were our own, so an unpaginated
// read returns three reviewer entries and the one on head is the twelfth.
export function fetchSnapshot({ repository, limit, pool, now }) {
    const listed = JSON.parse(
        gh(["pr", "list", "--repo", repository, "--state", "merged", "--limit", String(pool), "--json", "number,mergedAt"]),
    );
    // **A saturated pool cannot prove the window.** Where the listing came back short of the pool it
    // is every merged pull request there is, and the window is provably the newest N; where it came
    // back full, an older-numbered pull request merged recently could sit outside it. Recorded rather
    // than assumed away, so a reader can tell which of the two they are holding.
    const saturated = listed.length >= pool;
    const window = selectWindow(listed, limit);
    const pullRequests = [];
    for (const { number, mergedAt } of window) {
        const reviews = JSON.parse(gh(["api", "--paginate", `repos/${repository}/pulls/${number}/reviews`]));
        const comments = JSON.parse(gh(["api", "--paginate", `repos/${repository}/pulls/${number}/comments`]));
        // No bodies. The metrics need none, and a snapshot carrying review prose would put quoted
        // content into a committed file for no measurement's sake.
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

    if (opts.fetch) {
        if (!opts.repo || !opts.out) {
            io.error("review-meter: --fetch needs --repo <owner/name> and --out <file>");
            return 2;
        }
        if (!Number.isInteger(opts.limit) || opts.limit < 1) {
            io.error(`review-meter: --limit must be a positive integer, not ${JSON.stringify(opts.limit)}`);
            return 2;
        }
        if (!Number.isInteger(opts.pool) || opts.pool < opts.limit) {
            io.error(`review-meter: --pool must be an integer no smaller than --limit (${opts.limit}), not ${JSON.stringify(opts.pool)}`);
            io.error("The pool is listed by pull request NUMBER and the window is taken from it by merge date;");
            io.error("a pool the size of the window would just be number order wearing the window's name.");
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

    // The limits are printed on every run rather than left in a README, for the reason
    // `./goldens.mjs` prints its presence-versus-adequacy limit on every green: an exit code that
    // implies more than it means is how a figure gets quoted as something it is not.
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

// The entry guard, in the ONE form `./rule-carriers.mjs` designates. `file://${argv[1]}` is NOT that
// form, and this file shipped that spelling for exactly one measurement: `--fetch` against the live
// repository printed nothing, exited 0, and wrote no snapshot, because `import.meta.url`
// percent-encodes and this working copy lives under a path with spaces. **A green that is the tool
// never starting** — the fourth time this repository has met it, and the reason the form is copied
// rather than re-derived.
//
// The realpath fallback covers the symlink an npm `bin` produces, in a `try` because a missing path
// must answer no rather than throw.
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
// outright can truncate a pipe that has not drained, and a truncated line IS exit 0 with no output —
// the precise shape of the false green the guard above was fixed for.
if (isMain()) process.exitCode = run(process.argv.slice(2));
