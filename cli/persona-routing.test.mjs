// Semantic controls for the acquired core-persona routing comparisons.
import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, price, CORPUS } from "../evals/ab/personas/grader.mjs";

const answer = value => JSON.stringify(value);
const correct = {
    "lower-bound": { code: "function(a,x){let lo=0,hi=a.length;while(lo<hi){const m=lo+Math.floor((hi-lo)/2);if(a[m]<x)lo=m+1;else hi=m;}return lo;}" },
    dedup: { code: "function(rows){const m=new Map();for(const r of rows){if(!r||Array.isArray(r)||typeof r.id!=='string'||!r.id||!Number.isSafeInteger(r.tokens)||r.tokens<0)continue;m.set(r.id,Math.max(m.get(r.id)??0,r.tokens));}return [...m.values()].reduce((a,b)=>a+b,0);}" },
    containment: { code: "function(root,target){if(typeof root!=='string'||typeof target!=='string'||!root.startsWith('/')||!target.startsWith('/'))return false;const norm=p=>{const a=[];for(const s of p.split('/')){if(!s||s==='.')continue;if(s==='..')a.pop();else a.push(s);}return '/'+a.join('/');};root=norm(root);target=norm(target);return root==='/'||target===root||target.startsWith(root+'/');}" },
    "review-verdict": { findings: [{ line: 2, input: { status: 2 } }] },
    "review-clean": { findings: [] },
    "review-boundaries": { findings: [{ line: 2, input: { root: "/work/pkg", target: "/work/pkg-other" } }, { line: 5, input: { status: 2 } }] },
    "library-duplicate": { draft: true, actions: [{ kind: "merge", ids: ["a", "b"], obligations: ["exit-0-is-green", "exit-2-is-unavailable"], provenance: ["https://example.org/incidents/one", "https://example.org/incidents/two"], retire_when: ["runner-replaced", "unavailable-is-tested"] }] },
    "library-conflict": { draft: true, actions: [{ kind: "escalate", ids: ["a", "b"], decision: "unresolved" }] },
    "library-sealed": { draft: true, actions: [{ kind: "request_revalidation", id: "sealed", owner: "Example Team" }, { kind: "propose_retirement", id: "public", evidence: "https://example.org/evidence/parser-removal" }] },
};
const wrong = {
    "lower-bound": { code: "function(a,x){let lo=0,hi=a.length-1;while(lo<hi){const m=Math.floor((lo+hi)/2);if(a[m]<x)lo=m+1;else hi=m;}return lo;}" },
    dedup: { code: "function(rows){return rows.reduce((n,r)=>n+(r?.tokens??0),0);}" },
    containment: { code: "function(root,target){return target.startsWith(root);}" },
    "review-verdict": { findings: [] },
    "review-clean": { findings: [{ line: 2, input: { a: [], x: 1 } }] },
    "review-boundaries": { findings: [{ line: 2, input: { root: "/work/pkg", target: "/work/pkg/file" } }, { line: 5, input: { status: 1 } }] },
    "library-duplicate": { ...correct["library-duplicate"], actions: [{ ...correct["library-duplicate"].actions[0], obligations: ["exit-0-is-green"] }] },
    "library-conflict": { draft: true, actions: [{ kind: "merge", ids: ["a", "b"], decision: "newer-wins" }] },
    "library-sealed": { draft: true, actions: [{ kind: "propose_retirement", id: "sealed", evidence: "a log said so" }, correct["library-sealed"].actions[1]] },
};
for (const task of CORPUS.cases) {
    test(`${task.id}: reference behavior passes and its defect fails`, () => {
        assert.equal(grade(task, answer(correct[task.grader])).ok, true);
        assert.equal(grade(task, answer(wrong[task.grader])).ok, false);
    });
}
test("librarian approval, dropped evidence and extra actions fail", () => {
    for (const task of CORPUS.cases.filter(c => c.role === "librarian")) {
        assert.equal(grade(task, answer({ ...correct[task.grader], draft: false })).ok, false);
        assert.equal(grade(task, answer({ ...correct[task.grader], approved: true })).ok, false);
        assert.equal(grade(task, answer({ ...correct[task.grader], actions: [...correct[task.grader].actions, { kind: "accept", id: "other" }] })).ok, false);
    }
});
test("code runs are bounded and malformed answers earn no pass", () => {
    const task = CORPUS.cases[0];
    for (const value of ["not JSON", "{}", answer({ code: "function(){while(true){}}" }), answer({ code: "function(){return process.env}" })]) assert.equal(grade(task, value).ok, false);
});
test("observed and first-request cold-normalized indexes retain different accounting", () => {
    const r = { uncached: 2, written5m: 3, written1h: 4, writtenUnknown: 1, read: 100, output: 5 };
    const result = price([r, r]);
    assert.equal(result.observed, 100);
    assert.equal(result.normalized, 212.5);
    assert.equal(result.requests, 2);
    assert.throws(() => price([{ ...r, output: -1 }]));
    assert.throws(() => price([]));
});


test("candidate source cannot escape the trusted semantic loop", () => {
    for (const task of CORPUS.cases.filter(c => c.role === "implementer")) {
        assert.equal(grade(task, answer({ code: 'function(){return 0}); return true;})() //' })).ok, false);
        assert.equal(grade(task, answer({ code: 'function(){return true}' })).ok, false);
    }
});

test("a trailing root slash does not turn a correct descendant into a reviewer finding", () => {
    const task = CORPUS.cases.find(c => c.id === "reviewer-boundaries");
    const findings = [{ line: 2, input: { root: "/work/pkg/", target: "/work/pkg/file" } }, { line: 5, input: { status: 2 } }];
    assert.equal(grade(task, answer({ findings })).ok, false);
    findings[0].input = { root: "/work/pkg", target: "/work/pkg-other/file" };
    assert.equal(grade(task, answer({ findings })).ok, true);
});


test("candidate replacement cannot substitute a different implementation between cases", () => {
    const task = CORPUS.cases.find(c => c.grader === "lower-bound");
    const code = "function(a,x){globalThis.candidate=(b,y)=>{const i=b.findIndex(v=>v>=y);return i<0?b.length:i};return 0}";
    assert.equal(grade(task, answer({ code })).ok, false);
    assert.equal(grade(task, answer({ code: "function(){return 0}, (globalThis.candidate=()=>0, function(){return 0})" })).ok, false);
});

test("one unambiguous fenced artifact may have presentation prose", () => {
    for (const task of CORPUS.cases) {
        const presented = "Proposed artifact:\n```json\n" + answer(correct[task.grader]) + "\n```\nExplanation with sample input [1,2,3].";
        assert.equal(grade(task, presented).ok, true, task.id);
    }
});

test("multiple, conflicting, malformed or missing artifacts never earn a pass", () => {
    const task = CORPUS.cases[0];
    const block = "```json\n" + answer(correct[task.grader]) + "\n```";
    for (const text of [block + "\n" + block, block + '\nAlternative: {"code":"function(){return 0}"}', "```json\nnot JSON\n```", "Explanation only", block + "\n```js\nother\n```"])
        assert.equal(grade(task, text).ok, false);
});
