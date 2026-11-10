#!/usr/bin/env node
// Regrade the acquired core-persona records and check their shipped routing without a model.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { CORPUS, grade, price } from "../evals/ab/personas/grader.mjs";

export const CAPTURE = "evals/ab/personas/acquisition.json";
export const CAPTURE_SHA256 = "ff3688658bc20af6b78e834a5149ea6bd52bc88027b0340ec98cb52430c6d641";
export const ROLES = ["implementer", "reviewer", "librarian"];
export const ROUTING = { model: "inherit", effort: null, omitClaudeMd: false, cacheLifetime: "5m" };
const CLASSES = ["uncached", "written5m", "written1h", "writtenUnknown", "read", "output"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const demand = (ok, why) => { if (!ok) throw new Finding(why); };
export class Finding extends Error {}

export function costOf(call) {
    const parent = price(call.usage.parent), child = price(call.usage.child);
    return { parent, child, observed: parent.observed + child.observed, normalized: parent.normalized + child.normalized };
}

export function summarize(record) {
    const arms = Object.fromEntries(["a", "b"].map(arm => {
        const turns = record.turns.filter(turn => turn.arm === arm);
        const costs = turns.map(costOf);
        return [arm, { passed: turns.filter(turn => grade(CORPUS.cases.find(task => task.id === turn.task), turn.answer).ok).length,
            cases: turns.length, observed: costs.reduce((sum, value) => sum + value.observed, 0), normalized: costs.reduce((sum, value) => sum + value.normalized, 0) }];
    }));
    return { arms, mediumWinsObservedCorpus: arms.b.passed === 3 && arms.b.normalized < arms.a.normalized,
        shipped: ROUTING, scope: "retained policy; one observed model and three cases; no global medium default earned" };
}

export function register(record) {
    const result = summarize(record);
    const lines = [`# ${record.role} — acquired routing comparison`, "", `Host: ${record.host}. Concrete model: ${record.model}.`, "",
        "A uses the shipped inherited model and undeclared child effort (observed high). B requests medium through the native child tool. Each case has one attempt per arm.", "",
        "| Arm | Semantic passes | Observed cost index | Cold-normalized cost index |", "|---|---:|---:|---:|"];
    for (const arm of ["a", "b"]) {
        const value = result.arms[arm];
        lines.push(`| ${arm.toUpperCase()} | ${value.passed}/${value.cases} | ${value.observed.toFixed(2)} | ${value.normalized.toFixed(2)} |`);
    }
    lines.push("", `Medium wins this observed corpus: **${result.mediumWinsObservedCorpus ? "yes" : "no"}**. The shipped policy remains inherited model, undeclared effort, instruction floor retained and five-minute cache lifetime.`, "",
        "These are three observations, not a reliability estimate. A result on this concrete model does not establish medium effort for other inherited models. Cost indexes use the frozen declared vector, include parent and child requests, and are not subscription bills. First-request input is normalized separately in each fresh parent and child context.", "",
        "| Case | A | B |", "|---|---|---|");
    for (const task of CORPUS.cases.filter(task => task.role === record.role)) {
        const verdict = arm => grade(task, record.turns.find(turn => turn.task === task.id && turn.arm === arm).answer).ok ? "PASS" : "FAIL";
        lines.push(`| ${task.id} | ${verdict("a")} | ${verdict("b")} |`);
    }
    lines.push("", "The common acquisition record accounts for both mechanism probes and discloses the one retained-answer decoder repair after the first outcome. The original failed decode score and the repaired score are both retained; that child was never rerun.", "");
    return lines.join("\n");
}

function checkCall(call, model, ids, contexts, quality = false) {
    demand(call && ["complete", "invalid"].includes(call.state), "call completion state missing");
    demand(typeof call.context === "string" && !contexts.has(call.context), "a parent context was reused");
    contexts.add(call.context);
    demand(typeof call.childContext === "string" && !contexts.has(call.childContext), "a child context was reused");
    contexts.add(call.childContext);
    demand(hash(call.raw?.parent) && hash(call.raw?.result), "raw parent/result digest missing");
    demand(Date.parse(call.started) <= Date.parse(call.ended), "call timing is invalid");
    for (const side of ["parent", "child"]) {
        const requests = call.usage?.[side];
        demand(Array.isArray(requests) && requests.length > 0, `${side} usage missing`);
        for (const [index, request] of requests.entries()) {
            demand(typeof request.id === "string" && !ids.has(request.id), "duplicate request identity");
            ids.add(request.id);
            demand(request.model === model, "concrete model changed");
            demand(request.effort === (side === "parent" ? "high" : call.effort ?? "high"), "effective effort differs from frozen arm");
            demand(Number.isFinite(request.at) && request.at >= Date.parse(call.started) && request.at <= Date.parse(call.ended), "request outside its call");
            demand(index === 0 || request.at >= requests[index - 1].at, "usage requests are out of chronological order");
            for (const key of CLASSES) demand(Number.isSafeInteger(request[key]) && request[key] >= 0, `invalid ${key} count`);
        }
    }
    costOf(call);
    if (!quality) return;
    demand(call.state === "complete" && call.exit === 0 && call.timedOut === false, "quality call did not complete");
    demand(hash(call.raw.child) && hash(call.invocation?.promptSha256), "raw child/prompt digest missing");
    demand(call.invocation.type === `portulan:${call.role}` && call.invocation.effort === call.effort && call.invocation.model === null && call.invocation.background === false, "native child selection changed");
    demand(call.model === model && call.requestedModel === model, "quality model changed");
    demand(call.parentEffort === "high" && call.fresh === true, "quality parent was not fresh/high");
    demand(hash(call.answerRawSha256) && sha(call.answer) === call.answerPresentationSha256 && typeof call.answerNormalized === "boolean", "answer presentation provenance missing");
    demand(call.answerNormalized === (call.answerRawSha256 !== call.answerPresentationSha256), "answer normalization flag differs");
    demand(!/\/Users\/|\/private\/var\/folders\//.test(call.answer), "an original local path remains in a public answer");
}

export function verifyData(capture, records) {
    demand(capture.version === 1 && capture.phase === "complete", "acquisition is incomplete");
    demand(capture.model === "claude-sonnet-5-5" && same(capture.prices, CORPUS.prices), "frozen model or price vector changed");
    demand(capture.seed === CORPUS.seed && /^[a-f0-9]{40}$/.test(capture.sourceCommit), "corpus seed or source commit missing");
    demand(same(Object.keys(capture.taskSha256 ?? {}).sort(), CORPUS.cases.map(task => task.id).sort()), "frozen task roster changed");
    for (const task of CORPUS.cases) demand(sha(JSON.stringify({ role: task.role, task: task.task }, null, 2) + "\n") === capture.taskSha256[task.id], "frozen task bytes differ from the public corpus");
    demand(same(capture.routing, ROUTING), "routing differs from retained policy");
    demand(capture.preflights?.length === 2 && capture.preflights[0].state === "invalid" && capture.preflights[1].state === "complete", "both mechanism probes must be accounted");
    demand(capture.preflights[0].reason === "error_max_budget_usd" && capture.preflights[0].argvProvenance === "reconstructed-after-execution", "failed first probe provenance missing");
    demand(capture.preflights[1].markerSeen === true, "native medium mechanism was not demonstrated");
    demand(capture.preflights[0].instrumentSha256 === capture.instruments.firstProbe.sha256 && capture.preflights[1].instrumentSha256 === capture.instruments.secondProbe.sha256, "probe instrument attribution differs");
    const repair = capture.decodeRepair;
    demand(repair?.observedOutcomes === 1 && repair.retainedKey === "implementer-lower-bound-a" && repair.reruns === 0 && repair.approval === "PASS", "one-answer repair disclosure missing");
    for (const key of ["previousGrader", "grader", "abortedJournalSha256", "approvalSha256", "semanticSuffixSha256"]) demand(hash(repair[key]), `repair ${key} missing`);
    const ids = new Set(), contexts = new Set();
    checkCall(capture.preflights[0], "claude-fable-5-2", ids, contexts);
    checkCall(capture.preflights[1], capture.model, ids, contexts, true);
    demand(capture.preflights[1].effort === "medium" && capture.preflights[1].answer === "MECHANISM_OK", "medium probe answer/effort differs");
    const all = [];
    for (const role of ROLES) {
        const record = records[role];
        demand(record?.version === 1 && record.role === role && record.model === capture.model && record.host === capture.host, "role record identity changed");
        demand(record.turns?.length === 6, "role has other than six acquired turns");
        const expected = CORPUS.cases.filter(task => task.role === role).flatMap(task => ["a", "b"].map(arm => `${task.id}-${arm}`));
        demand(same(record.turns.map(turn => turn.key).sort(), expected.sort()), "role case/arm coverage differs");
        for (const turn of record.turns) {
            const task = CORPUS.cases.find(task => task.id === turn.task);
            demand(turn.role === role && task.role === role && turn.key === `${turn.task}-${turn.arm}` && turn.effort === (turn.arm === "a" ? null : "medium"), "role/arm changed");
            checkCall(turn, capture.model, ids, contexts, true);
            demand(turn.instrumentSha256 === capture.instruments[turn.key === repair.retainedKey ? "firstOutcome" : "continuation"].sha256, "quality instrument attribution differs");
            const actual = grade(task, turn.answer);
            demand(same(actual, turn.regraded ?? turn.grade), "stored semantic grade differs");
            if (turn.key === repair.retainedKey) demand(turn.grade.ok === false && turn.regraded?.ok === true, "original failed decode score was overwritten");
            else demand(!Object.hasOwn(turn, "regraded"), "an unapproved outcome was regraded");
            if (turn.arm === "a") demand(actual.ok, "a failed control earns no routing");
            all.push(turn);
        }
        demand(same(record.summary, summarize(record)), "stored role summary differs");
    }
    const expectedOrder = CORPUS.cases.flatMap((task, index) => (index % 2 === 0 ? ["a", "b"] : ["b", "a"]).map(arm => `${task.id}-${arm}`));
    demand(same(capture.order, expectedOrder), "frozen acquisition order changed");
    const chronological = all.sort((a, b) => Date.parse(a.started) - Date.parse(b.started));
    demand(same(capture.publication?.normalizedAnswers, chronological.filter(turn => turn.answerNormalized).map(turn => turn.key)), "normalized answer disclosure differs");
    demand(same(chronological.map(turn => turn.key), expectedOrder), "turns did not run in frozen order");
    demand(Date.parse(capture.qualityFrozenAt) <= Date.parse(chronological[0].started) && Date.parse(capture.continuationFrozenAt) >= Date.parse(chronological[0].ended) && Date.parse(capture.continuationFrozenAt) <= Date.parse(chronological[1].started), "freeze/repair timing differs from the disclosed sequence");
    const calls = [...capture.preflights, ...chronological];
    demand(calls.every((call, index) => index === 0 || Date.parse(call.started) >= Date.parse(calls[index - 1].ended)), "fresh calls overlap or probes were reordered");
    const requests = capture.preflights.flatMap(call => [...call.usage.parent, ...call.usage.child]).length + all.flatMap(call => [...call.usage.parent, ...call.usage.child]).length;
    demand(capture.accounting.requests === requests && capture.accounting.calls === 20 && capture.accounting.qualityChildren === 18 && capture.accounting.parentContexts === 20, "usage accounting is incomplete");
    return { roles: ROLES.length, qualityChildren: all.length, requests, overhead: capture.preflights.map(costOf) };
}

export function verifyCapture(root, expectedDigest = CAPTURE_SHA256) {
    const bytes = fs.readFileSync(path.join(root, CAPTURE));
    demand(sha(bytes) === expectedDigest, "acquisition digest changed");
    const capture = JSON.parse(bytes), directory = path.dirname(path.join(root, CAPTURE));
    const records = {};
    for (const role of ROLES) {
        const file = `${role}.json`, data = fs.readFileSync(path.join(directory, file));
        demand(sha(data) === capture.files[file], `${role} record digest changed`);
        records[role] = JSON.parse(data);
        demand(fs.readFileSync(path.join(directory, `${role}.md`), "utf8") === register(records[role]), `${role} register differs`);
    }
    const sources = ["evals/ab/personas/corpus.json", "evals/ab/personas/grader.mjs", ...ROLES.map(role => `core/personas/${role}.md`)];
    demand(same(Object.keys(capture.sources ?? {}).sort(), sources.sort()), "required source roster differs");
    for (const [file, expected] of Object.entries(capture.sources)) demand(sha(fs.readFileSync(path.join(root, file))) === expected, `source differs: ${file}`);
    const old = fs.readFileSync(path.join(directory, "repairs/grader-before-decode-repair.mjs.txt"), "utf8");
    const current = fs.readFileSync(path.join(directory, "grader.mjs"), "utf8");
    demand(sha(old) === capture.decodeRepair.previousGrader && sha(current) === capture.decodeRepair.grader, "decoder versions differ");
    const suffix = text => text.slice(text.indexOf("function codeCases"));
    demand(suffix(old) === suffix(current) && sha(suffix(current)) === capture.decodeRepair.semanticSuffixSha256, "repair changed semantic predicates or pricing");
    const first = records.implementer.turns.find(turn => turn.key === capture.decodeRepair.retainedKey);
    demand(fs.readFileSync(path.join(directory, "repairs/first-control-answer.txt"), "utf8") === first.answer + "\n", "retained first answer differs");
    for (const [key, name] of Object.entries({ firstProbe: "first-probe", secondProbe: "second-probe", firstOutcome: "first-outcome", continuation: "continuation", publisher: "publisher" })) {
        demand(sha(fs.readFileSync(path.join(directory, `protocol/${name}.mjs.txt`))) === capture.instruments[key].sha256, "instrument snapshot differs");
    }
    for (const role of ROLES) {
        const source = fs.readFileSync(path.join(root, `core/personas/${role}.md`), "utf8");
        const header = source.split("---")[1];
        demand(/^model: inherit$/m.test(header) && !/^effort:/m.test(header) && /^omitClaudeMd: false$/m.test(header) && /^cacheLifetime: 5m$/m.test(header), "shipped source routing differs");
        const binding = fs.readFileSync(path.join(directory, `bindings/${role}.txt`));
        demand(sha(binding) === capture.bindings[role], "captured binding differs");
        const installed = path.join(root, `agents/${role}.md`);
        if (fs.existsSync(installed)) demand(sha(fs.readFileSync(installed)) === capture.bindings[role], "shipped plugin binding differs");
    }
    return verifyData(capture, records);
}

export function run(argv = process.argv.slice(2)) {
    try {
        if (argv.length && !(argv.length === 2 && argv[0] === "--repo-root")) throw Error("usage: node cli/persona-routing.mjs [--repo-root <dir>]");
        const result = verifyCapture(path.resolve(argv[1] ?? "."));
        console.log(`persona-routing: ${result.roles} acquired role records, ${result.qualityChildren} quality children and ${result.requests} accounted requests; shipped policy matches`);
        return 0;
    } catch (error) { console.error(`persona-routing: ${error.message}`); return error instanceof Finding ? 1 : 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) process.exitCode = run();
