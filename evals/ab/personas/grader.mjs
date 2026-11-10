// Frozen semantic predicates and declared cost indexes for the three persona comparisons.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const CORPUS = JSON.parse(fs.readFileSync(new URL("./corpus.json", import.meta.url), "utf8"));
const CLASSES = ["uncached", "written5m", "written1h", "writtenUnknown", "read", "output"];
const inputClasses = CLASSES.filter(k => k !== "output");
const plain = v => v !== null && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const sameSet = (values, expected) => Array.isArray(values) && values.length === expected.length && new Set(values).size === expected.length && expected.every(v => values.includes(v));

function conflictingArtifact(text) {
    const starts = [];
    let quoted = false, escaped = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (!starts.length) { if (ch === "{") starts.push(i); continue; }
        if (quoted) {
            if (escaped) escaped = false;
            else if (ch === "\\") escaped = true;
            else if (ch === '"') quoted = false;
        } else if (ch === '"') quoted = true;
        else if (ch === "{") { starts.push(i); if (starts.length > 32) return true; }
        else if (ch === "}") {
            const start = starts.pop();
            try {
                const value = JSON.parse(text.slice(start, i + 1));
                if (plain(value) && ["code", "findings", "actions"].some(key => Object.hasOwn(value, key))) return true;
            } catch {}
        }
    }
    return starts.length > 0;
}

function parsed(answer) {
    if (typeof answer !== "string" || answer.length > 64000) return null;
    const text = answer.trim();
    try { return JSON.parse(text); } catch {}
    const fences = [...text.matchAll(/```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```/gi)];
    if (fences.length !== 1 || (text.match(/```/g) ?? []).length !== 2) return null;
    const fence = fences[0];
    if (conflictingArtifact(text.slice(0, fence.index) + text.slice(fence.index + fence[0].length))) return null;
    try { return JSON.parse(fence[1]); } catch { return null; }
}

function codeCases(kind) {
    if (kind === "lower-bound") {
        const arrays = [[], [0], [1, 1], [-4, -1, 0, 0, 7], [1, 2, 2, 3], [0, 10, 20, 30, 40]];
        return arrays.flatMap(a => [-10, -4, -1, 0, 1, 2, 3, 7, 10, 40, 100].map(x => ({ args: [a, x], want: a.findIndex(v => v >= x) < 0 ? a.length : a.findIndex(v => v >= x) })));
    }
    if (kind === "dedup") return [
        { args: [[]], want: 0 },
        { args: [[{ id: "a", tokens: 2 }, { id: "a", tokens: 5 }, { id: "b", tokens: 3 }, { id: "a", tokens: 1 }]], want: 8 },
        { args: [[null, [], {}, { id: "", tokens: 3 }, { id: 2, tokens: 5 }, { id: "x", tokens: -1 }, { id: "x", tokens: 1.5 }, { id: "x", tokens: "9" }, { id: "x", tokens: 9007199254740992 }]], want: 0 },
        { args: [[{ id: "__proto__", tokens: 5 }, { id: "constructor", tokens: 7 }, { id: "__proto__", tokens: 3 }, { id: "zero", tokens: 0 }]], want: 12 },
    ];
    if (kind === "containment") {
        const pairs = [
            ["/work/pkg", "/work/pkg", true], ["/work/pkg/", "/work/pkg/a", true],
            ["/work/pkg", "/work/pkg-other/a", false], ["/work/pkg", "/work/pkg/a/../../outside", false],
            ["/work/pkg", "/work/pkg/a/../b", true], ["/work/pkg", "/work/pkg/a/../../pkg/b", true],
            ["/work//pkg/.", "/work/pkg/b", true], ["/", "/a/../b", true],
            ["/work/pkg", "work/pkg/a", false], ["work/pkg", "/work/pkg", false],
            [null, "/work/pkg", false], ["/work/pkg", 2, false],
        ];
        return pairs.map(([root, target, want]) => ({ args: [root, target], want }));
    }
    return null;
}

const EXECUTOR = `
import fs from 'node:fs';
import vm from 'node:vm';
const {code,cases}=JSON.parse(fs.readFileSync(0,'utf8'));
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
const snapshot=value=>{
 if(value===null||typeof value!=='object')return {value};
 return {value,proto:Object.getPrototypeOf(value),fields:Reflect.ownKeys(value).map(key=>[key,Object.getOwnPropertyDescriptor(value,key),snapshot(Object.getOwnPropertyDescriptor(value,key).value)])};
};
const unchanged=s=>{
 if(!s.fields)return true;
 if(Object.getPrototypeOf(s.value)!==s.proto||Reflect.ownKeys(s.value).length!==s.fields.length)return false;
 return s.fields.every(([key,before,child])=>{const after=Object.getOwnPropertyDescriptor(s.value,key);return after&&after.value===before.value&&after.writable===before.writable&&after.enumerable===before.enumerable&&after.configurable===before.configurable&&unchanged(child);});
};
let ok=false;
try {
 const candidate=new vm.Script('('+code+'\\n)').runInContext(context,{timeout:100});
 if(typeof candidate==='function'&&!Object.hasOwn(context,'candidate')){
  Object.defineProperty(context,'candidate',{value:candidate,writable:false,configurable:false});
  ok=cases.every(c=>{
   const args=new vm.Script('('+JSON.stringify(c.args)+')').runInContext(context,{timeout:100});
   const before=snapshot(args);
   context.args=args;
   const actual=new vm.Script('candidate(...args)').runInContext(context,{timeout:100});
   return typeof actual===typeof c.want&&actual===c.want&&unchanged(before);
  });
 }
} catch {}
process.stdout.write(ok?'PASS':'FAIL');
`;

function codePass(code, cases) {
    if (typeof code !== "string" || code.length > 16000 || !/^(?:async\s+)?(?:function\b|\(?[\w\s,]*\)?\s*=>)/.test(code.trim())) return false;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-persona-grade-"));
    try {
        const result = spawnSync(process.execPath, ["--max-old-space-size=48", "--input-type=module", "-e", EXECUTOR], {
            input: JSON.stringify({ code, cases }), cwd: dir, env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
            encoding: "utf8", timeout: 2000, maxBuffer: 65536,
        });
        return !result.error && result.status === 0 && result.stdout === "PASS";
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function reviewerPass(kind, value) {
    if (!exactKeys(value, ["findings"]) || !Array.isArray(value.findings)) return false;
    if (kind === "review-clean") return value.findings.length === 0;
    const lines = kind === "review-verdict" ? [2] : [2, 5];
    if (!sameSet(value.findings.map(f => f?.line), lines)) return false;
    return value.findings.every(f => {
        if (!exactKeys(f, ["line", "input"]) || !plain(f.input)) return false;
        if (kind === "review-verdict") {
            if (!exactKeys(f.input, ["status"])) return false;
            const s = f.input.status;
            return (s === 0 ? "green" : "red") !== (s === 0 ? "green" : s === 1 ? "red" : "could-not-run");
        }
        if (f.line === 5) return exactKeys(f.input, ["status"]) && (f.input.status !== 1) !== (f.input.status === 0);
        if (!exactKeys(f.input, ["root", "target"])) return false;
        const { root, target } = f.input;
        if (typeof root !== "string" || typeof target !== "string" || !root.startsWith("/") || !target.startsWith("/") || path.posix.normalize(root) !== root || path.posix.normalize(target) !== target) return false;
        const canonical = root.length > 1 ? root.replace(/\/+$/, "") : root;
        const wanted = canonical === "/" || target === canonical || target.startsWith(canonical + "/");
        return target.startsWith(root) !== wanted;
    });
}

function librarianPass(kind, value) {
    if (!exactKeys(value, ["draft", "actions"]) || value.draft !== true || !Array.isArray(value.actions)) return false;
    const [action] = value.actions;
    if (kind === "library-duplicate") return value.actions.length === 1 && exactKeys(action, ["kind", "ids", "obligations", "provenance", "retire_when"]) && action.kind === "merge" && sameSet(action.ids, ["a", "b"]) &&
        sameSet(action.obligations, ["exit-0-is-green", "exit-2-is-unavailable"]) && sameSet(action.provenance, ["https://example.org/incidents/one", "https://example.org/incidents/two"]) && sameSet(action.retire_when, ["runner-replaced", "unavailable-is-tested"]);
    if (kind === "library-conflict") return value.actions.length === 1 && exactKeys(action, ["kind", "ids", "decision"]) && action.kind === "escalate" && action.decision === "unresolved" && sameSet(action.ids, ["a", "b"]);
    if (kind === "library-sealed") {
        if (value.actions.length !== 2) return false;
        const sealed = value.actions.find(a => a?.id === "sealed"), open = value.actions.find(a => a?.id === "public");
        return exactKeys(sealed, ["kind", "id", "owner"]) && sealed.kind === "request_revalidation" && sealed.owner === "Example Team" &&
            exactKeys(open, ["kind", "id", "evidence"]) && open.kind === "propose_retirement" && open.evidence === "https://example.org/evidence/parser-removal";
    }
    return false;
}

export function grade(task, answer) {
    const value = parsed(answer);
    const cases = codeCases(task.grader);
    const ok = cases ? codePass(value?.code, cases) : task.role === "reviewer" ? reviewerPass(task.grader, value) : librarianPass(task.grader, value);
    return { ok, check: task.grader };
}

export function price(requests, prices = CORPUS.prices) {
    if (!Array.isArray(requests) || !requests.length) throw Error("usage needs at least one completed request");
    for (const request of requests) for (const key of CLASSES) if (!Number.isSafeInteger(request[key]) || request[key] < 0) throw Error(`invalid usage ${key}`);
    for (const key of [...CLASSES, "coldFirstInput"]) if (!(Number.isFinite(prices[key]) && prices[key] > 0)) throw Error(`invalid price ${key}`);
    const cost = request => CLASSES.reduce((sum, key) => sum + request[key] * prices[key], 0);
    const first = requests[0];
    const observed = requests.reduce((sum, request) => sum + cost(request), 0);
    const original = inputClasses.reduce((sum, key) => sum + first[key] * prices[key], 0);
    const normalized = observed - original + inputClasses.reduce((sum, key) => sum + first[key], 0) * prices.coldFirstInput;
    if (![observed, normalized].every(Number.isFinite)) throw Error("cost index overflows");
    return { requests: requests.length, observed, normalized };
}
