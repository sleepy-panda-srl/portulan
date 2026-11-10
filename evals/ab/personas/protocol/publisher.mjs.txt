#!/usr/bin/env node
// Publish whitelisted numeric metadata and generic answers from the completed private persona acquisition.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parentPrompt } from "./acquire-personas.mjs";
import { CORPUS } from "../evals/ab/personas/grader.mjs";
import { ROLES, ROUTING, summarize, register, verifyData } from "./persona-routing.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const digest = file => sha(fs.readFileSync(file));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const counters = ["uncached", "written5m", "written1h", "writtenUnknown", "read", "output"];
const usage = requests => requests.map(request => Object.fromEntries([
    ["id", "request-" + sha(request.id)], ...["model", "effort", "at", ...counters].map(key => [key, request[key]]),
]));

function normalizedArgs(args, directory, sessionId) {
    return args.map(value => value.replaceAll(path.join(directory, "tree"), "<plugin>").replaceAll(directory, "<acquisition>")
        .replaceAll(sessionId ?? "NO_SESSION_ID_WAS_RECORDED", "<parent-context>"));
}

function normalize(call, directory, firstProbe = false) {
    const partial = firstProbe ? call.partial : null;
    const child = firstProbe ? partial.children.flatMap(child => child.usage) : call.collected.usage.child;
    const parent = firstProbe ? partial.parent : call.collected.usage.parent;
    const raw = firstProbe ? { parent: partial.parentSha256, child: partial.children[0].sha256, result: digest(path.join(directory, call.stdout)) } : call.collected.raw;
    const args = firstProbe ? ["-p", parentPrompt(call.role, path.join(directory, "tasks/mechanism.json"), call.effort), "--output-format", "json", "--effort", "high", "--plugin-dir", path.join(directory, "tree"),
        "--tools", "Agent,Read", "--allowedTools", `Agent(portulan:${call.role}),Read`, "--add-dir", path.join(directory, "tasks"), "--max-budget-usd", "1"] : call.argv;
    const result = {
        key: call.key, task: call.task, role: call.role, effort: call.effort, requestedModel: call.model,
        model: firstProbe ? parent[0].model : call.collected.model, parentEffort: "high", fresh: true,
        context: "context-" + sha(call.sessionId ?? raw.parent), childContext: "child-" + sha(raw.child),
        state: call.state, exit: call.exit, timedOut: call.timedOut, started: call.started, ended: call.ended,
        argv: normalizedArgs(args, directory, call.sessionId), argvProvenance: firstProbe ? "reconstructed-after-execution" : "recorded-before-execution",
        instrumentSha256: firstProbe ? partial.postProbeSourceSha256 : call.instrumentSha256,
        usage: { parent: usage(parent), child: usage(child) }, raw,
        hostEstimateUsd: read(path.join(directory, call.stdout)).total_cost_usd,
    };
    if (firstProbe) Object.assign(result, { reason: "error_max_budget_usd", markerSeen: partial.children[0].markerSeen === true,
        sourceSnapshotTiming: "after-execution", freshContextEvidence: "one parent transcript and one child transcript; no resume option" });
    else {
        const answer = normalizedArgs([call.collected.answer], directory)[0];
        Object.assign(result, { invocation: { ...call.collected.invocation, model: null, background: false }, answer,
            answerRawSha256: sha(call.collected.answer), answerPresentationSha256: sha(answer), answerNormalized: answer !== call.collected.answer,
            transcriptDuplicates: call.collected.transcriptDuplicates });
    }
    if (call.grade) result.grade = call.grade;
    if (call.regraded) result.regraded = call.regraded;
    if (call.task === "mechanism" && !firstProbe) result.markerSeen = call.collected.answer === "MECHANISM_OK";
    else if (call.task !== "mechanism") result.arm = call.key.endsWith("-a") ? "a" : "b";
    return result;
}

export function publish(root, firstDirectory, directory) {
    root = path.resolve(root); firstDirectory = path.resolve(firstDirectory); directory = path.resolve(directory);
    const first = read(path.join(firstDirectory, "journal.json")), journal = read(path.join(directory, "journal.json"));
    if (journal.phase !== "complete" || journal.calls.length !== 19 || first.calls.length !== 1) throw Error("only the complete, unrepeated acquisition may be published");
    const target = path.join(root, "evals/ab/personas");
    const sourceHashes = Object.fromEntries(["evals/ab/personas/corpus.json", "evals/ab/personas/grader.mjs"].map(file => [file, journal.qualityFrozen.semantic[file]]));
    for (const role of ROLES) {
        const file = `core/personas/${role}.md`, expected = journal.qualityFrozen.roles[role].persona;
        if (digest(path.join(directory, "tree", file)) !== expected) throw Error("the acquired charter differs from its frozen hash");
        sourceHashes[file] = expected;
    }
    for (const [file, expected] of Object.entries(sourceHashes)) if (digest(path.join(root, file)) !== expected) throw Error("current source differs from its acquired frozen hash: " + file);
    const records = {}, turns = journal.calls.slice(1).map(call => normalize(call, directory));
    for (const role of ROLES) {
        const record = { version: 1, role, host: journal.host, model: journal.model, turns: turns.filter(turn => turn.role === role) };
        record.summary = summarize(record); records[role] = record;
    }
    const old = fs.readFileSync(path.join(directory, "frozen-quality/grader.mjs"), "utf8");
    const current = fs.readFileSync(path.join(root, "evals/ab/personas/grader.mjs"), "utf8");
    const approval = read(path.join(directory, "decode-repair-approval.json"));
    const preflights = [normalize(first.calls[0], firstDirectory, true), normalize(journal.calls[0], directory)];
    const capture = {
        version: 1, phase: journal.phase, sourceCommit: journal.source, host: journal.host, model: journal.model,
        seed: CORPUS.seed, prices: CORPUS.prices, routing: ROUTING,
        publication: { answerTransformation: "replace only known plugin-root and acquisition-root prefixes with <plugin> and <acquisition>",
            normalizedAnswers: turns.filter(turn => turn.answerNormalized).map(turn => turn.key),
            note: "Original wording otherwise retained; original answers stay private with raw-answer digests. This presentation normalization changes no semantic artifact or score." },
        qualityFrozenAt: journal.priorQualityFrozen.at, continuationFrozenAt: journal.qualityFrozen.at,
        order: journal.qualityFrozen.order, taskSha256: journal.qualityFrozen.tasks,
        preflights, decodeRepair: { ...journal.decodeRepair, approval: approval.verdict, reruns: 0,
            semanticSuffixSha256: sha(current.slice(current.indexOf("function codeCases"))),
            explanation: "After one outcome, the original decoder rejected one JSON fence followed by prose. The same retained answer passes the revised decoder; all semantic predicates, cases and price code are byte-identical. The original false score remains. Independent approval covered exact decoder and continuation instrument hashes before the remaining seventeen calls." },
        accounting: { calls: 20, parentContexts: 20, qualityChildren: 18,
            requests: [...preflights, ...turns].flatMap(call => [...call.usage.parent, ...call.usage.child]).length,
            note: "Both probes, every parent and every child are included. Host USD values are lifecycle estimates, not subscription bills, and are not added to the declared-vector indexes." },
        sources: sourceHashes,
        bindings: Object.fromEntries(ROLES.map(role => [role, journal.qualityFrozen.roles[role].binding])),
        instruments: { firstProbe: { sha256: first.calls[0].partial.postProbeSourceSha256, timing: "snapshotted-after-execution" },
            secondProbe: { sha256: journal.instrumentSha256, timing: "frozen-before-execution" },
            firstOutcome: { sha256: journal.priorQualityFrozen.instrument, timing: "frozen-before-execution" },
            continuation: { sha256: journal.qualityFrozen.instrument, timing: "approved-and-frozen-before-seventeen-untouched-cells" },
            publisher: { sha256: digest(new URL(import.meta.url)), timing: "after-acquisition; whitelisted normalization only" } }, files: {},
    };
    verifyData(capture, records);
    fs.mkdirSync(path.join(target, "bindings"), { recursive: true });
    fs.mkdirSync(path.join(target, "protocol"), { recursive: true });
    for (const role of ROLES) {
        save(path.join(target, `${role}.json`), records[role]);
        fs.writeFileSync(path.join(target, `${role}.md`), register(records[role]));
        fs.copyFileSync(path.join(directory, "tree/agents", `${role}.md`), path.join(target, "bindings", `${role}.txt`));
        capture.files[`${role}.json`] = digest(path.join(target, `${role}.json`));
    }
    const snapshots = [
        [path.join(firstDirectory, "frozen/acquire-v1-after-probe.mjs"), "first-probe.mjs.txt"],
        [path.join(directory, "frozen/acquire.mjs"), "second-probe.mjs.txt"],
        [path.join(directory, "frozen-quality/acquire.mjs"), "first-outcome.mjs.txt"],
        [path.join(directory, "frozen-quality-repair/acquire.mjs"), "continuation.mjs.txt"],
        [new URL(import.meta.url), "publisher.mjs.txt"],
    ];
    for (const [source, name] of snapshots) fs.copyFileSync(source, path.join(target, "protocol", name));
    fs.writeFileSync(path.join(target, "repairs/grader-before-decode-repair.mjs.txt"), old);
    save(path.join(target, "acquisition.json"), capture);
    return digest(path.join(target, "acquisition.json"));
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
    try {
        if (process.argv.length !== 5) throw Error("usage: node cli/normalize-personas.mjs <repo-root> <failed-probe-directory> <completed-directory>");
        console.log(publish(...process.argv.slice(2)));
    } catch (error) { console.error(error.message); process.exitCode = 2; }
}
