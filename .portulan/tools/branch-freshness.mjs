#!/usr/bin/env node
// Refresh exact-head freshness checks for every open pull request into main.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { parse } from "../../cli/compile.mjs";

export const MAX_BEHIND = 10;
export const CHECK = "branch-freshness";
const sha = (s) => typeof s === "string" && /^[a-f0-9]{40}$/i.test(s);

export function judge(comparison, base) {
    if (comparison?.base_commit?.sha !== base || !Number.isSafeInteger(comparison.behind_by) || comparison.behind_by < 0) {
        throw new Error("Comparison did not identify the requested base and a nonnegative integer behind_by");
    }
    return comparison.behind_by <= MAX_BEHIND ? "success" : "failure";
}

export async function openPulls(api, repository) {
    const pulls = [];
    for (let page = 1; ; page += 1) {
        const batch = await api("GET", `/repos/${repository}/pulls?state=open&base=main&per_page=100&page=${page}`);
        if (!Array.isArray(batch)) throw new Error("The open-PR response is not an array");
        pulls.push(...batch);
        if (batch.length < 100) return pulls;
    }
}

function validPull(p, repository) {
    if (!Number.isSafeInteger(p?.number) || p.number < 1 || p.state !== "open" || p.base?.ref !== "main" || p.base.repo?.full_name !== repository || !sha(p.base.sha) || !sha(p.head?.sha)) {
        throw new Error("The PR response does not identify an open main-targeted PR and exact SHAs");
    }
    return p;
}

async function refreshPull({ api, repository, candidate, detailsUrl }) {
    const root = `/repos/${repository}`;
    let current = validPull(candidate, repository);
    let active = null;
    let observed = "unavailable";
    const summary = (message) => `Base: ${current.base.sha}\nHead: ${current.head.sha}\nCommits behind: ${observed}\nAllowed: 0–${MAX_BEHIND}\n\n${message}`;
    const pending = async () => {
        active = null;
        active = await api("POST", `${root}/check-runs`, {
            name: CHECK,
            head_sha: current.head.sha,
            status: "in_progress",
            ...(detailsUrl ? { details_url: detailsUrl } : {}),
            output: { title: `Comparing PR #${current.number} with main`, summary: summary("Waiting for a stable comparison.") },
        });
        if (!Number.isSafeInteger(active?.id) || active.id < 1) throw new Error("Check creation returned no check id");
    };
    const finish = async (conclusion, title, message) => api("PATCH", `${root}/check-runs/${active.id}`, {
        status: "completed", conclusion, output: { title, summary: summary(message) },
    });
    try {
        await pending();
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const fresh = validPull(await api("GET", `${root}/pulls/${current.number}`), repository);
            if (fresh.head.sha !== current.head.sha || fresh.base.sha !== current.base.sha) {
                await finish("failure", "PR moved; comparison superseded", "A fresh head/base check follows.");
                current = fresh;
                observed = "unavailable";
                await pending();
            }
            const compared = await api("GET", `${root}/compare/${current.base.sha}...${current.head.sha}`);
            const conclusion = judge(compared, current.base.sha);
            observed = compared.behind_by;
            const confirmed = validPull(await api("GET", `${root}/pulls/${current.number}`), repository);
            if (confirmed.head.sha === current.head.sha && confirmed.base.sha === current.base.sha) {
                await finish(conclusion, `${observed} commit(s) behind main; up to ${MAX_BEHIND} allowed`, conclusion === "success" ? "Within the freshness allowance." : "Sync with main and let the checks rerun.");
                return;
            }
            await finish("failure", "PR moved; comparison superseded", "The comparison no longer describes this PR.");
            current = confirmed;
            observed = "unavailable";
            await pending();
        }
        throw new Error("The head or base kept moving through three comparisons; rerun the scan");
    } catch (error) {
        if (active?.id) await finish("failure", "Freshness could not be judged", error.message);
        throw error;
    }
}

export async function refreshAll({ api, repository, detailsUrl, say = console.log }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("GITHUB_REPOSITORY must identify owner/repository");
    const pulls = await openPulls(api, repository);
    let errors = 0;
    for (const candidate of pulls) {
        try {
            await refreshPull({ api, repository, candidate, detailsUrl });
            say(`Refreshed PR #${candidate.number}`);
        } catch (error) {
            errors += 1;
            say(`Could not refresh PR #${candidate?.number}: ${error.message}`);
        }
    }
    return { examined: pulls.length, errors };
}

export function activationPayload(policy) {
    const floor = parse(policy).floor;
    if (!floor || floor.strict !== false || !floor.checks.some((c) => c.context === CHECK && c.integration_id === 15368)) throw new Error("The policy does not declare the prepared freshness check");
    return { strict: floor.strict, checks: floor.checks.map(({ context, integration_id }) => ({ context, ...(integration_id === undefined ? {} : { app_id: integration_id }) })) };
}

export async function run(argv = process.argv.slice(2), env = process.env) {
    try {
        if (argv.length === 1 && argv[0] === "--activation-payload") {
            console.log(JSON.stringify(activationPayload(JSON.parse(fs.readFileSync(new URL("../gates.json", import.meta.url), "utf8"))), null, 2));
            return 0;
        }
        if (argv.length) throw new Error("Usage: branch-freshness.mjs [--activation-payload]");
        if (!env.GH_TOKEN) throw new Error("GH_TOKEN is required");
        const api = async (method, route, body) => {
            const response = await fetch(`https://api.github.com${route}`, {
                method, redirect: "error", signal: AbortSignal.timeout(30000),
                headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            if (!response.ok) throw new Error(`GitHub ${method} ${route} returned HTTP ${response.status}`);
            return response.json();
        };
        const detailsUrl = env.GITHUB_RUN_ID ? `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : undefined;
        const result = await refreshAll({ api, repository: env.GITHUB_REPOSITORY, detailsUrl });
        console.log(`${result.examined} PR(s) examined, ${result.errors} could not be judged`);
        return result.errors ? 2 : 0;
    } catch (error) {
        console.error(`branch-freshness: ${error.message}`);
        return 2;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) process.exitCode = await run();
