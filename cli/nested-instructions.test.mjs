// Nested guidance generation, ownership recovery and consumer parity.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseUnit, compileGuidance, guidanceEdits, ownedNestedFiles, run } from "./compile.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const roots = [];
process.on("exit", () => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });
const registry = ".claude/rules/portulan/.instructions";
const unit = (target = "api/CLAUDE.md", body = "Keep API decisions explicit.\n") => `---\ntier: on-path\ntarget: ${JSON.stringify(target)}\ndescription: API guidance.\n---\n\n${body}`;
function put(root, rel, text) { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function fixture(text = unit()) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-nested-")); roots.push(root);
    put(root, ".portulan/workspace.json", JSON.stringify({ portulan: { spec: "2.15" }, name: "fixture", summary: "Invented.", kind: "repository", tree: "../", gates: "gates.json", slots: { context: "context/" }, verify: { default: "check", recipes: [{ id: "check", run: "true" }] } }));
    put(root, ".portulan/gates.json", JSON.stringify({ portulan: { spec: "2.2" }, why: "gate-map.md", rules: [{id:"gated-fixture-push",tier:"gated",action:{shell:"git push"},reason:"Human approval."}] }));
    put(root,".portulan/gate-map.md","# Gates\n\n`gated-fixture-push` — Gated.\n");
    put(root, ".portulan/context/api.md", text); return root;
}
function snapshot(root) {
    const rows = [];
    const walk = rel => {
        for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
            const child = path.join(rel, entry.name), file = path.join(root, child);
            if (entry.isSymbolicLink()) rows.push([child, "link", fs.readlinkSync(file)]);
            else if (entry.isDirectory()) { rows.push([child, "dir"]); walk(child); }
            else if(entry.isFile())rows.push([child,fs.readFileSync(file).toString("base64")]);
            else rows.push([child,"special",fs.lstatSync(file).mode]);
        }
    }; walk(""); return rows;
}
test("the nested selector derives its directory scope without changing old rule units", () => {
    const parsed = parseUnit("api", unit()); assert.equal(parsed.target, "api/CLAUDE.md"); assert.deepEqual(parsed.paths, ["api/**"]);
    const old = parseUnit("api", unit().replace('target: "api/CLAUDE.md"', 'paths: ["api/**"]')); assert.equal(old.target, undefined); assert.deepEqual(old.paths, ["api/**"]);
});
test("a declared nested file is generated once, checked, restored and absent from scoped rules", () => {
    const root = fixture(); assert.ok(compileGuidance(root, { check: true }).drifted > 0); assert.equal(fs.existsSync(path.join(root, "api")), false);
    compileGuidance(root); const file = path.join(root, "api/CLAUDE.md"), original = fs.readFileSync(file, "utf8");
    assert.match(original, /Keep API decisions explicit\./); assert.equal(fs.existsSync(path.join(root, ".claude/rules/portulan/api.md")), false);
    assert.equal(compileGuidance(root, { check: true }).drifted, 0); assert.ok(fs.existsSync(path.join(root, registry)));
    fs.appendFileSync(file, "Drift.\n"); assert.ok(compileGuidance(root, { check: true }).drifted > 0); compileGuidance(root); assert.equal(fs.readFileSync(file, "utf8"), original);
    fs.rmSync(file); assert.ok(compileGuidance(root, { check: true }).drifted > 0); compileGuidance(root); assert.equal(fs.readFileSync(file, "utf8"), original);
});
for (const change of ["move", "on-read", "remove", "paths"]) test(`only owned nested output is retired on ${change}`, () => {
    const root = fixture(); compileGuidance(root); put(root, "human/CLAUDE.md", "Human guidance.\n");
    if (change === "move") put(root, ".portulan/context/api.md", unit("service/CLAUDE.md"));
    if (change === "on-read") put(root, ".portulan/context/api.md", "---\ntier: on-read\ndescription: API guidance.\n---\n\nKeep API decisions explicit.\n");
    if (change === "remove") fs.rmSync(path.join(root, ".portulan/context/api.md"));
    if (change === "paths") put(root, ".portulan/context/api.md", unit().replace('target: "api/CLAUDE.md"', 'paths: ["api/**"]'));
    assert.ok(compileGuidance(root, { check: true }).drifted > 0); compileGuidance(root);
    assert.equal(fs.existsSync(path.join(root, "api/CLAUDE.md")), false); assert.equal(fs.readFileSync(path.join(root, "human/CLAUDE.md"), "utf8"), "Human guidance.\n");
    assert.equal(compileGuidance(root, { check: true }).drifted, 0);
    assert.equal(fs.existsSync(path.join(root, registry)), change === "move");
});
for (const lost of ["new human file", "mark removed", "registry removed", "foreign mark"]) test(`ownership refusal precedes settings and guidance writes: ${lost}`, () => {
    const root = fixture();
    if (lost !== "new human file") compileGuidance(root);
    if (lost === "new human file" || lost === "mark removed") put(root, "api/CLAUDE.md", "Human guidance.\n");
    if (lost === "registry removed") fs.rmSync(path.join(root, registry));
    if (lost === "foreign mark") {
        const file = path.join(root, "api/CLAUDE.md"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("context/api.md", "context/foreign.md"));
    }
    const before = snapshot(root); assert.throws(() => compileGuidance(root), /own|compiled|registry|mark/i);
    assert.equal(run(["--workspace", root], { quiet:true }), 2); assert.deepEqual(snapshot(root), before);
});
for (const target of ["CLAUDE.md", ".claude/CLAUDE.md", "../api/CLAUDE.md", "/api/CLAUDE.md", "api/../CLAUDE.md", "api//CLAUDE.md", "api/*.md", "api/other.md", ".git/CLAUDE.md", "api\\CLAUDE.md", "api/CLAUDE.md\n"]) test(`unsafe or non-nested target is refused: ${JSON.stringify(target)}`, () => {
    assert.throws(() => parseUnit("api", unit(target)), /target|nested|CLAUDE|relative/);
});
test("target and paths are exclusive, and another tier cannot select a nested file", () => {
    assert.throws(() => parseUnit("api", unit().replace('target: "api/CLAUDE.md"', 'target: "api/CLAUDE.md"\npaths: ["api/**"]')), /both|exclusive|one of/);
    for (const tier of ["always", "on-read", "on-invoke"]) assert.throws(() => parseUnit("api", unit().replace("tier: on-path", `tier: ${tier}`)), /on-path/);
});
for (const body of ["@orders.txt\n", "@missing-today.md\n", "@~/private.md\n", "@/outside/private.md\n", "See @orders.txt for details.\n"]) test(`nested host imports are refused without probing: ${JSON.stringify(body)}`, () => {
    const root = fixture(unit("api/CLAUDE.md", body)); put(root, "api/orders.txt", "Ordinary data.\n");
    const before = snapshot(root); assert.throws(() => compileGuidance(root), /import|at-sign|@/); assert.deepEqual(snapshot(root), before);
});
test("literal import examples in code remain literal", () => {
    const root = fixture(unit("api/CLAUDE.md", "Use `@orders.txt` as an example.\n\n```text\n@~/private.md\n```\n")); compileGuidance(root); assert.equal(compileGuidance(root, { check: true }).drifted, 0);
});
for (const alias of ["file", "parent", "hard link"]) test(`an output alias is refused before mutation: ${alias}`, () => {
    const root = fixture();
    if (alias === "hard link") { compileGuidance(root); fs.linkSync(path.join(root, "api/CLAUDE.md"), path.join(root, "second.md")); }
    else { put(root, "backing/file.md", "Human.\n"); if (alias === "parent") fs.symlinkSync("backing", path.join(root, "api")); else { fs.mkdirSync(path.join(root, "api")); fs.symlinkSync("../backing/file.md", path.join(root, "api/CLAUDE.md")); } }
    const before = snapshot(root); assert.throws(() => compileGuidance(root)); assert.deepEqual(snapshot(root), before);
});
test("duplicate nested targets are refused before any write", () => {
    const root = fixture(); put(root, ".portulan/context/second.md", unit()); const before = snapshot(root); assert.throws(() => compileGuidance(root), /two|duplicate|same target/i); assert.deepEqual(snapshot(root), before);
});
test("a malformed ownership registry refuses without replacing any bytes", () => {
    const root = fixture(); compileGuidance(root); put(root, registry, "Not a registry.\n"); const before = snapshot(root); assert.throws(() => compileGuidance(root), /registry|ownership|metadata/); assert.deepEqual(snapshot(root), before);
});
test("guidanceEdits agrees with real compile for a nested move", () => {
    const root = fixture(); compileGuidance(root); put(root, ".portulan/context/api.md", unit("service/CLAUDE.md"));
    const edits = guidanceEdits(root).edits; assert.ok(edits.some(edit => edit.file === "api/CLAUDE.md" && edit.next === null)); assert.ok(edits.some(edit => edit.file === "service/CLAUDE.md" && edit.next?.includes("Keep API")));
});
test("the separate transactional edit writer has the same nested move result", async () => {
    const {applyEdits}=await import("./upgrade.mjs");
    const left=fixture(), right=fixture(); compileGuidance(left); compileGuidance(right);
    for(const root of [left,right]) put(root,".portulan/context/api.md",unit("service/CLAUDE.md"));
    const planned=guidanceEdits(left).edits.map(edit=>({...edit,root:"tree"}));
    assert.equal(applyEdits(path.join(left,".portulan"),planned,{treeDir:left}).ok,true);
    compileGuidance(right); assert.deepEqual(snapshot(left),snapshot(right));
});
test("a pending claim does not overwrite a human file arriving during the separate write", async () => {
    const {applyEdits}=await import("./upgrade.mjs"), root=fixture();
    const planned=guidanceEdits(root).edits.map(edit=>({...edit,root:"tree"})); let arrived=false;
    const result=applyEdits(path.join(root,".portulan"),planned,{treeDir:root,write:(file,text,options)=>{
        fs.writeFileSync(file,text,options);
        if(!arrived && String(file).includes(".instructions")) {arrived=true;put(root,"api/CLAUDE.md","Human arrival.\n");}
    }});
    assert.equal(arrived,true); assert.equal(result.ok,false); assert.equal(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),"Human arrival.\n");
});
test("vendoring a workspace-at-root excludes proved nested output and preserves human files", async () => {
    const root=fixture();
    for(const name of fs.readdirSync(path.join(root,".portulan"))) fs.renameSync(path.join(root,".portulan",name),path.join(root,name));
    fs.rmdirSync(path.join(root,".portulan"));
    const m=JSON.parse(fs.readFileSync(path.join(root,"workspace.json"))); m.tree="./";
    m.slots={...m.slots,identity:"identity.md",principles:"principles.md",gates:"gate-map.md"};put(root,"workspace.json",JSON.stringify(m));
    for(const name of ["identity","principles"]) put(root,`${name}.md`,`# ${name}\n\nInvented fixture.\n`);
    put(root,"human/CLAUDE.md","Human guidance.\n"); assert.equal(compileGuidance(root).declared,true);assert.ok(fs.existsSync(path.join(root,"api/CLAUDE.md")));
    const into=fs.mkdtempSync(path.join(os.tmpdir(),"portulan-nested-vendor-")); roots.push(into);
    const {run:vendor}=await import("./vendor.mjs"), lines=[];
    const code=await vendor([root,"--into",path.join(into,".portulan"),"--residence","in-repo","--host","codex"],{say:s=>lines.push(s),warn:s=>lines.push(s)});
    assert.equal(code,0,lines.join("\n"));
    assert.equal(fs.existsSync(path.join(into,".portulan/api/CLAUDE.md")),false);
    assert.equal(fs.readFileSync(path.join(into,".portulan/human/CLAUDE.md"),"utf8"),"Human guidance.\n");
    assert.match(fs.readFileSync(path.join(into,"AGENTS.md"),"utf8"),/\.portulan\/context\/api\.md/);
});
function interrupt(root, phase) {
    const source=`import fs from 'node:fs';import {applyEdits} from ${JSON.stringify(new URL('./upgrade.mjs',import.meta.url).href)};import {compileGuidance,guidanceEdits} from ${JSON.stringify(new URL('./compile.mjs',import.meta.url).href)};const link=fs.linkSync,rename=fs.renameSync;fs.linkSync=(a,b)=>{const result=link(a,b);if((['registry','move','separate-move'].includes(${JSON.stringify(phase)})&&b.endsWith('/.instructions'))||${JSON.stringify(phase)}==='target'&&b.endsWith('/api/CLAUDE.md'))process.exit(71);return result};fs.renameSync=(a,b)=>{const result=rename(a,b);return result};${phase==="separate-move" ? `applyEdits(${JSON.stringify(path.join(root,".portulan"))},guidanceEdits(${JSON.stringify(root)}).edits.map(edit=>({...edit,root:"tree"})),{treeDir:${JSON.stringify(root)}})` : `compileGuidance(${JSON.stringify(root)})`};`;
    const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',timeout:5000,killSignal:'SIGKILL'});
    assert.equal(result.status,71,result.stdout+result.stderr); return result;
}
for(const phase of ["registry","target","move"]) test(`an interrupted complete publication recovers from ${phase}`,()=>{
    const root=fixture();
    if(phase==="move") {compileGuidance(root);put(root,".portulan/context/api.md",unit("service/CLAUDE.md"));}
    interrupt(root,phase);assert.ok(compileGuidance(root,{check:true}).drifted>0);compileGuidance(root);
    assert.equal(compileGuidance(root,{check:true}).drifted,0);
    assert.equal(snapshot(root).filter(([file])=>file.includes(".portulan-guidance.")).length,0);
    assert.equal(fs.existsSync(path.join(root,phase==="move"?"service/CLAUDE.md":"api/CLAUDE.md")),true);
});
test("an interrupted pending registry cannot claim a newly arrived human file",()=>{
    const root=fixture();interrupt(root,"registry");put(root,"api/CLAUDE.md","Human arrival.\n");const before=snapshot(root);
    assert.throws(()=>compileGuidance(root),/ownership|human/);assert.deepEqual(snapshot(root),before);
});
for(const kind of ["registry","target","source"]) test(`a special ${kind} file is refused without blocking or mutating`,()=>{
    const root=fixture();compileGuidance(root);
    const rel=kind==="registry"?registry:kind==="target"?"api/CLAUDE.md":".portulan/context/api.md";
    fs.rmSync(path.join(root,rel));const made=spawnSync("mkfifo",[path.join(root,rel)]);assert.equal(made.status,0);
    const source=`import {compileGuidance} from ${JSON.stringify(new URL('./compile.mjs',import.meta.url).href)};try{compileGuidance(${JSON.stringify(root)});process.exit(0)}catch{process.exit(2)}`;
    const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',timeout:3000,killSignal:'SIGKILL'});
    assert.equal(result.status,2,result.error?.message??result.stdout+result.stderr);
    assert.equal(fs.lstatSync(path.join(root,rel)).isFIFO(),true);
    if(kind==="source") assert.equal(fs.existsSync(path.join(root,"api/CLAUDE.md")),true);
});
for(const declared of [true,false]) test(`retirement preserves a newly declared curated source with context ${declared}`,()=>{
    const root=fixture();compileGuidance(root);
    const m=JSON.parse(fs.readFileSync(path.join(root,".portulan/workspace.json")));m.slots.identity="../api/CLAUDE.md";if(!declared)delete m.slots.context;put(root,".portulan/workspace.json",JSON.stringify(m));
    if(declared)put(root,".portulan/context/api.md","---\ntier: on-read\ndescription: API guidance.\n---\n\nRetained.\n");
    const before=snapshot(root);assert.throws(()=>compileGuidance(root),/source|reserved|curated/);assert.throws(()=>ownedNestedFiles(root,".portulan"),/source|reserved|curated/);assert.deepEqual(snapshot(root),before);
});
test("a case-only target move cannot leave an ambiguous interrupted registry",()=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("API/CLAUDE.md"));const before=snapshot(root);
    assert.throws(()=>compileGuidance(root),/case|ambiguous|alias/i);assert.deepEqual(snapshot(root),before);
});

for(const writer of ["move","separate-move"]) test(`a copied foreign-target mark cannot authorize a pending ${writer} destination`,()=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("other/CLAUDE.md"));interrupt(root,writer);
    put(root,"other/CLAUDE.md",fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8")+"Human addition at the new destination.\n");
    const before=snapshot(root);
    for(const read of [()=>compileGuidance(root),()=>guidanceEdits(root),()=>ownedNestedFiles(root,".portulan")]) assert.throws(read,/target|mark|owner/i);
    assert.deepEqual(snapshot(root),before);
});
for(const child of ["client/CLAUDE.md/v2/CLAUDE.md","client/claude.md/v2/CLAUDE.md"]) test(`file/ancestor target conflict refuses before publication: ${child}`,()=>{
    const root=fixture(unit("client/CLAUDE.md"));put(root,".portulan/context/second.md",unit(child));const before=snapshot(root);
    for(const check of [true,false]) {assert.throws(()=>compileGuidance(root,{check}),/target|ancestor|CLAUDE|directory/i);assert.deepEqual(snapshot(root),before);}
    fs.rmSync(path.join(root,".portulan/context/second.md"));compileGuidance(root);assert.equal(compileGuidance(root,{check:true}).drifted,0);
});
test("read-only checks inspect clean and drifted output without mutation permissions",()=>{
    const root=fixture();assert.equal(run(["--workspace",root],{quiet:true}),0);const meta=path.join(root,registry),target=path.join(root,"api/CLAUDE.md");
    const original=fs.statSync(meta);assert.deepEqual(guidanceEdits(root).edits,[]);compileGuidance(root);assert.equal(fs.statSync(meta).ino,original.ino);assert.equal(fs.statSync(meta).mtimeMs,original.mtimeMs);
    fs.chmodSync(meta,0o444);fs.chmodSync(target,0o444);
    try {
        assert.equal(run(["--workspace",root,"--check"],{quiet:true}),0);
        put(root,".portulan/context/api.md",unit("api/CLAUDE.md","Changed source.\n"));
        assert.equal(run(["--workspace",root,"--check"],{quiet:true}),1);
        assert.equal(fs.statSync(meta).ino,original.ino);
    } finally {fs.chmodSync(meta,0o644);fs.chmodSync(target,0o644);}
});
test("the actual split rollback preserves human arrivals at both created and retired targets",async()=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("new/CLAUDE.md"));
    put(root,"CLAUDE.md","# Active\n\n## Instructions\n<!-- portulan: on-read -->\n\nHuman section.\n");
    const {run:instructions}=await import("./instructions.mjs");const lines=[];let count=0;
    const code=await instructions(["--workspace",path.join(root,".portulan"),"--write"],line=>lines.push(line),{write(file,text,options){
        if(path.basename(file).startsWith("..instructions.portulan-guidance.") && ++count===2) {
            put(root,"api/CLAUDE.md","Human retired replacement.\n");put(root,"new/CLAUDE.md","Human published replacement.\n");throw Error("Injected failure after human arrivals");
        }
        fs.writeFileSync(file,text,options);
    }});
    assert.equal(count,2);assert.equal(code,2);
    assert.equal(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),"Human retired replacement.\n");
    assert.equal(fs.readFileSync(path.join(root,"new/CLAUDE.md"),"utf8"),"Human published replacement.\n");
    assert.match(lines.join("\n"),/rollback was INCOMPLETE/);assert.doesNotMatch(lines.join("\n"),/rolled back, nothing is changed/);
});
for(const transition of ["create","replace","delete"]) test(`shared rollback preserves a concurrent human ${transition} replacement`,async()=>{
    const {applyEdits,restore}=await import("./upgrade.mjs"),root=fixture();if(transition!=="create")put(root,"record.md","Original.\n");
    const applied=applyEdits(root,[{file:"record.md",next:transition==="delete"?null:"Written.\n"}]);assert.equal(applied.ok,true);
    put(root,"record.md","Human later.\n");assert.equal(restore(root,applied.snapshots).ok,false);assert.equal(fs.readFileSync(path.join(root,"record.md"),"utf8"),"Human later.\n");
});

test("rollback can unwind two owned publications to the same path",async()=>{
    const {applyEdits,restore}=await import("./upgrade.mjs"),root=fixture();put(root,"record.md","Original.\n");
    const applied=applyEdits(root,[{file:"record.md",next:"First.\n"},{file:"record.md",next:"Second.\n"}]);assert.equal(applied.ok,true);
    assert.equal(restore(root,applied.snapshots).ok,true);assert.equal(fs.readFileSync(path.join(root,"record.md"),"utf8"),"Original.\n");
});

for(const alias of ["symlink","hardlink","same bytes new inode"]) test(`rollback preserves a replaced or aliased post-image: ${alias}`,async()=>{
    const {applyEdits,restore}=await import("./upgrade.mjs"),root=fixture();const applied=applyEdits(root,[{file:"record.md",next:"Written.\n"}]);assert.equal(applied.ok,true);
    if(alias==="symlink") {put(root,"human.md","Human.\n");fs.rmSync(path.join(root,"record.md"));fs.symlinkSync("human.md",path.join(root,"record.md"));}
    else if(alias==="hardlink")fs.linkSync(path.join(root,"record.md"),path.join(root,"human.md"));
    else {put(root,"replacement.md","Written.\n");fs.renameSync(path.join(root,"replacement.md"),path.join(root,"record.md"));}
    const before=snapshot(root);assert.equal(restore(root,applied.snapshots).ok,false);assert.deepEqual(snapshot(root),before);
});
test("a failed split after final registry publication restores the complete nested move",async()=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("new/CLAUDE.md"));put(root,"CLAUDE.md","# Active\n\n## Instructions\n<!-- portulan: on-read -->\n\nHuman section.\n");
    const before=snapshot(root),{run:instructions}=await import("./instructions.mjs"),lines=[];let failed=false;
    const code=await instructions(["--workspace",path.join(root,".portulan"),"--write"],line=>lines.push(line),{write(file,text,options){
        if(path.basename(file).startsWith("on-read.md.portulan-upgrade.")) {failed=true;throw Error("Failure after final registry publication");}fs.writeFileSync(file,text,options);
    }});
    assert.equal(failed,true);assert.equal(code,2);assert.match(lines.join("\n"),/rolled back, nothing is changed/);assert.deepEqual(snapshot(root),before);
});

for(const mode of ["repair","retire"]) test(`an impossible stable ownership row preserves the foreign target on ${mode}`,()=>{
    const root=fixture();compileGuidance(root);const file=path.join(root,registry),data=JSON.parse(fs.readFileSync(file));data.files[0].sources.push(".portulan/context/foreign.md");put(root,registry,JSON.stringify(data));
    const target=path.join(root,"api/CLAUDE.md");fs.writeFileSync(target,fs.readFileSync(target,"utf8").replace('.portulan/context/api.md','.portulan/context/foreign.md')+"Human foreign body.\n");
    if(mode==="retire")fs.rmSync(path.join(root,".portulan/context/api.md"));const before=snapshot(root);
    for(const read of [()=>compileGuidance(root,{check:true}),()=>compileGuidance(root),()=>ownedNestedFiles(root,".portulan")])assert.throws(read,/registry|record|owner|source/);
    assert.deepEqual(snapshot(root),before);
});
function interruptPrepared(root,method,suffix,separate=false) {
    const operation=separate ? `applyEdits(${JSON.stringify(path.join(root,".portulan"))},guidanceEdits(${JSON.stringify(root)}).edits.map(edit=>({...edit,root:"tree"})),{treeDir:${JSON.stringify(root)}})` : `compileGuidance(${JSON.stringify(root)})`;
    const source=`import fs from 'node:fs';import {applyEdits} from ${JSON.stringify(new URL('./upgrade.mjs',import.meta.url).href)};import {compileGuidance,guidanceEdits} from ${JSON.stringify(new URL('./compile.mjs',import.meta.url).href)};const original=fs[${JSON.stringify(method)}];fs[${JSON.stringify(method)}]=(a,b)=>{if(((${JSON.stringify(method)}==='renameSync'?a:b).endsWith(${JSON.stringify(suffix)})))process.exit(71);return original(a,b)};${operation};`;

    const result=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',timeout:5000,killSignal:'SIGKILL'});assert.equal(result.status,71,result.stdout+result.stderr);
}
for(const separate of [false,true]) for(const [method,suffix] of [["linkSync","/.instructions"],["renameSync","/.instructions"],["linkSync","/api/CLAUDE.md"],["renameSync","/api/CLAUDE.md"]]) test(`complete prepared transient recovers before ${method} ${suffix} via ${separate?"shared writer":"compiler"}`,()=>{
    const root=fixture();if(method==="renameSync"){compileGuidance(root);put(root,".portulan/context/api.md",unit("api/CLAUDE.md","New source body.\n"));}
    interruptPrepared(root,method,suffix,separate);assert.ok(compileGuidance(root,{check:true}).drifted>0);compileGuidance(root);
    assert.equal(compileGuidance(root,{check:true}).drifted,0);assert.equal(snapshot(root).some(([file])=>file.includes('.portulan-guidance.')),false);
});
test("physical case aliases refuse while distinct case-sensitive paths remain independent",()=>{
    const root=fixture();put(root,"aPI/orders.txt","Ordinary data.\n");const aliases=fs.existsSync(path.join(root,"api/orders.txt"));const before=snapshot(root);
    if(aliases){assert.throws(()=>compileGuidance(root),/case|spelling/i);assert.deepEqual(snapshot(root),before);}
    else {compileGuidance(root);put(root,"aPI/CLAUDE.md","Human other-case file.\n");assert.equal(compileGuidance(root,{check:true}).drifted,0);assert.equal(fs.readFileSync(path.join(root,"aPI/CLAUDE.md"),"utf8"),"Human other-case file.\n");}
});

test("vendor refuses physical case aliases and preserves distinct case-sensitive human files",async()=>{
    const root=fixture();for(const name of fs.readdirSync(path.join(root,".portulan")))fs.renameSync(path.join(root,".portulan",name),path.join(root,name));fs.rmdirSync(path.join(root,".portulan"));
    const m=JSON.parse(fs.readFileSync(path.join(root,"workspace.json")));m.tree="./";m.slots={...m.slots,identity:"identity.md",principles:"principles.md",gates:"gate-map.md"};put(root,"workspace.json",JSON.stringify(m));for(const name of ["identity","principles"])put(root,`${name}.md`,`# ${name}\n\nInvented fixture.\n`);
    assert.equal(compileGuidance(root).declared,true);fs.renameSync(path.join(root,"api"),path.join(root,"aPI"));const aliases=fs.existsSync(path.join(root,"api/CLAUDE.md"));
    if(!aliases){put(root,"aPI/CLAUDE.md","Human distinct-case file.\n");compileGuidance(root);}
    const before=snapshot(root),into=fs.mkdtempSync(path.join(os.tmpdir(),"portulan-case-vendor-"));roots.push(into);const {run:vendor}=await import("./vendor.mjs"),lines=[];
    const code=await vendor([root,"--into",path.join(into,".portulan"),"--residence","in-repo","--host","codex"],{say:s=>lines.push(s),warn:s=>lines.push(s)});
    assert.equal(code,aliases?2:0,lines.join("\n"));assert.deepEqual(snapshot(root),before);
    if(aliases)assert.deepEqual(snapshot(into),[]);
    else {assert.equal(fs.existsSync(path.join(into,".portulan/api/CLAUDE.md")),false);assert.equal(fs.readFileSync(path.join(into,".portulan/aPI/CLAUDE.md"),"utf8"),"Human distinct-case file.\n");}
});
for(const rel of ["api/.CLAUDE.md.portulan-guidance.9.00000000-0000-4000-8000-000000000000",".claude/rules/portulan/..instructions.portulan-guidance.9.00000000-0000-4000-8000-000000000000"]) test(`unproved staging-shaped human text is preserved: ${rel}`,()=>{
    const root=fixture();compileGuidance(root);put(root,rel,"Human text.\n");const before=snapshot(root);
    assert.equal(ownedNestedFiles(root,".portulan").has(rel),false);compileGuidance(root);assert.equal(fs.readFileSync(path.join(root,rel),"utf8"),"Human text.\n");assert.deepEqual(snapshot(root),before);
});
test("an impossible empty stable registry refuses retirement",()=>{
    const root=fixture();compileGuidance(root);const data=JSON.parse(fs.readFileSync(path.join(root,registry)));data.files=[];put(root,registry,JSON.stringify(data));fs.rmSync(path.join(root,".portulan/context/api.md"));const before=snapshot(root);
    assert.throws(()=>compileGuidance(root),/registry|owner|record/);assert.deepEqual(snapshot(root),before);
});

for(const writer of ["move","separate-move"]) test(`a valid pending source transition recovers through ${writer}`,()=>{
    const root=fixture();compileGuidance(root);fs.renameSync(path.join(root,".portulan/context/api.md"),path.join(root,".portulan/context/client.md"));interrupt(root,writer);
    const data=JSON.parse(fs.readFileSync(path.join(root,registry)));assert.equal(data.files[0].pending,true);assert.equal(data.files[0].sources.length,2);
    assert.ok(compileGuidance(root,{check:true}).drifted>0);compileGuidance(root);assert.equal(compileGuidance(root,{check:true}).drifted,0);
    assert.match(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),/context\/client\.md/);
});

for(const shared of [false,true]) test(`case-conflicting uncreated prefixes refuse before ${shared?"shared publication":"compile"}`,async()=>{
    const root=fixture(unit("Parts/alpha/CLAUDE.md"));put(root,".portulan/context/second.md",unit("parts/beta/CLAUDE.md"));const before=snapshot(root),{applyEdits}=await import("./upgrade.mjs");
    assert.throws(()=>shared ? applyEdits(path.join(root,".portulan"),guidanceEdits(root).edits.map(edit=>({...edit,root:"tree"})),{treeDir:root}) : compileGuidance(root),/case|prefix|spelling/i);assert.deepEqual(snapshot(root),before);
    put(root,".portulan/context/second.md",unit("Parts/beta/CLAUDE.md"));compileGuidance(root);assert.equal(compileGuidance(root,{check:true}).drifted,0);assert.ok(fs.existsSync(path.join(root,"Parts/alpha/CLAUDE.md")));assert.ok(fs.existsSync(path.join(root,"Parts/beta/CLAUDE.md")));
});
test("a recorded inconsistent directory-prefix spelling refuses without mutation",()=>{
    const root=fixture(unit("Parts/alpha/CLAUDE.md"));put(root,registry,JSON.stringify({format:1,workspace:".portulan",files:[{target:"Parts/alpha/CLAUDE.md",sources:[".portulan/context/api.md"],pending:true},{target:"parts/beta/CLAUDE.md",sources:[".portulan/context/second.md"],pending:true}]}));const before=snapshot(root);assert.throws(()=>compileGuidance(root),/case|prefix|spelling/i);assert.deepEqual(snapshot(root),before);
});
test("split projects pending imported guidance and measures the real write",async()=>{
    const root=fixture();compileGuidance(root);put(root,"CLAUDE.md","@api/CLAUDE.md\n\n## Instructions\n<!-- portulan: on-read -->\n\nHuman section.\n");put(root,".portulan/context/api.md",unit("api/CLAUDE.md","x".repeat(25001)+"\n"));
    const {run:instructions}=await import("./instructions.mjs"),{alwaysTier}=await import("./context.mjs"),dry=[],written=[],before=snapshot(root);
    assert.equal(await instructions(["--workspace",path.join(root,".portulan")],line=>dry.push(line)),0);assert.deepEqual(snapshot(root),before);const forecast=/always tier goes from [\d,]+ B .* to ([\d,]+) B/.exec(dry.join("\n"));assert.ok(forecast,dry.join("\n"));
    assert.equal(await instructions(["--workspace",path.join(root,".portulan"),"--write"],line=>written.push(line)),0);
    const bytes=alwaysTier(root).entries.reduce((sum,entry)=>sum+entry.bytes,0);assert.ok(bytes>25001);const reported=/written, and the index compiled: the always tier is ([\d,]+) B/.exec(written.join("\n"));assert.ok(reported);assert.equal(Number(reported[1].replaceAll(",","")),bytes);assert.equal(Number(forecast[1].replaceAll(",","")),bytes);
});
function rootWorkspaceFixture(){
    const origin=fixture(),parent=fs.mkdtempSync(path.join(os.tmpdir(),"portulan-retire-parent-"));roots.push(parent);const root=path.join(parent,"project");fs.renameSync(origin,root);
    for(const name of fs.readdirSync(path.join(root,".portulan")))fs.renameSync(path.join(root,".portulan",name),path.join(root,name));fs.rmdirSync(path.join(root,".portulan"));
    const m=JSON.parse(fs.readFileSync(path.join(root,"workspace.json")));m.tree="./";m.slots={...m.slots,identity:"identity.md",principles:"principles.md",gates:"gate-map.md"};put(root,"workspace.json",JSON.stringify(m));for(const name of ["identity","principles"])put(root,`${name}.md`,`# ${name}\n\nInvented fixture.\n`);
    compileGuidance(root);return {root,parent};
}
for(const leave of ["pointer","nothing"]) test(`vendor ${leave} preserves changed generated and copied files and names the actual tree`,async()=>{
    const {root,parent}=rootWorkspaceFixture(),into=path.join(parent,"feed"),{run:vendor}=await import("./vendor.mjs"),lines=[];put(root,"notes.md","Original note.\n");put(parent,".claude/rules/portulan/.instructions","Unrelated parent registry.\n");let injected=false;
    const say=line=>{lines.push(line);if(!injected && line.includes("vendor: materialising")){injected=true;for(const [rel,text] of [["api/CLAUDE.md","Human replacement.\n"],["notes.md","Human updated note.\n"]]){put(root,rel+".human",text);fs.renameSync(path.join(root,rel+".human"),path.join(root,rel));}}};
    assert.equal(await vendor([root,"--into",into,"--residence","feed-side","--switch","--leave",leave,"--kind","demo"],{say,warn:say}),0,lines.join("\n"));assert.equal(injected,true);
    assert.equal(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),"Human replacement.\n");assert.equal(fs.readFileSync(path.join(root,"notes.md"),"utf8"),"Human updated note.\n");assert.equal(fs.existsSync(path.join(into,"api/CLAUDE.md")),false);assert.equal(fs.readFileSync(path.join(into,"notes.md"),"utf8"),"Original note.\n");assert.ok(lines.some(line=>line.includes("left alone")&&line.includes("api/CLAUDE.md")&&line.includes("notes.md")));assert.equal(lines.some(line=>line.includes(path.join(parent,".claude"))),false);
});
test("vendor leaves a file arriving at final empty-residence removal",async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),original=fs.rmdirSync,lines=[];let arrived=false;
    t.mock.method(fs,"rmdirSync",(file,...args)=>{if(path.resolve(file)===path.resolve(root)&&!arrived){arrived=true;put(root,"late-human.md","Late human data.\n");}return original(file,...args);});
    const code=await vendor([root,"--into",path.join(parent,"feed"),"--residence","feed-side","--switch","--leave","nothing","--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line)});assert.equal(code,0,lines.join("\n"));assert.equal(arrived,true);assert.equal(fs.readFileSync(path.join(root,"late-human.md"),"utf8"),"Late human data.\n");assert.doesNotMatch(lines.join("\n"),/nothing left at/);
});
test("vendor pointer creation preserves a late human README",async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),original=fs.writeFileSync,readme=path.join(root,"README.md"),lines=[];let arrived=false;
    t.mock.method(fs,"writeFileSync",(file,text,...args)=>{if(String(file)===readme&&!arrived){arrived=true;original(file,"Late human README.\n");}return original(file,text,...args);});
    assert.equal(await vendor([root,"--into",path.join(parent,"feed"),"--residence","feed-side","--switch","--leave","pointer","--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line)}),0,lines.join("\n"));assert.equal(arrived,true);assert.equal(fs.readFileSync(readme,"utf8"),"Late human README.\n");
});
test("vendor preserves a pre-existing manifest staging file",async()=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs");put(root,"workspace.json.vendoring","Human staging-shaped data.\n");const before=snapshot(root),lines=[];
    assert.equal(await vendor([root,"--into",path.join(parent,"feed"),"--residence","feed-side","--switch","--leave","pointer","--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line)}),2,lines.join("\n"));assert.deepEqual(snapshot(root),before);
});

test("vendor refuses a source manifest changed after staging",async()=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),lines=[];let changed=false;
    const say=line=>{lines.push(line);if(!changed&&line.includes("vendor: materialising")){changed=true;const m=JSON.parse(fs.readFileSync(path.join(root,"workspace.json")));m.summary="Human revised summary.";put(root,"workspace.json.human",JSON.stringify(m));fs.renameSync(path.join(root,"workspace.json.human"),path.join(root,"workspace.json"));}};
    const into=path.join(parent,"feed"),code=await vendor([root,"--into",into,"--residence","feed-side","--switch","--leave","nothing","--kind","demo"],{say,warn:say});assert.equal(changed,true);assert.equal(code,2,lines.join("\n"));assert.equal(JSON.parse(fs.readFileSync(path.join(root,"workspace.json"))).summary,"Human revised summary.");assert.equal(fs.existsSync(path.join(into,"workspace.json")),false);
});

for(const action of ["move","rewrite"])for(const shared of [false,true])test(`last namespace operation preserves a human ${action} save via ${shared?"shared":"compile"}`,async(t)=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",action==="move"?unit("other/CLAUDE.md"):unit("api/CLAUDE.md","New source.\n"));
    const target=path.join(root,"api/CLAUDE.md"),rename=fs.renameSync,rm=fs.rmSync,human="Human at the final namespace operation.\n";let injected=false;
    const plant=()=>{if(injected)return;injected=true;put(root,"api/save.human",human);rename(path.join(root,"api/save.human"),target);};
    t.mock.method(fs,"renameSync",(from,to,...args)=>{if(from===target||to===target)plant();return rename(from,to,...args);});
    t.mock.method(fs,"rmSync",(file,...args)=>{if(file===target)plant();return rm(file,...args);});
    const {applyEdits}=await import("./upgrade.mjs");if(shared)assert.equal(applyEdits(path.join(root,".portulan"),guidanceEdits(root).edits.map(edit=>({...edit,root:"tree"})),{treeDir:root}).ok,false);else assert.throws(()=>compileGuidance(root));
    assert.equal(injected,true);assert.equal(fs.readFileSync(target,"utf8"),human);
});
for(const existed of [false,true])test(`last rollback operation retains a human ${existed?"replacement":"created-file"} save`,async(t)=>{
    const root=fixture(),{applyEdits,restore}=await import("./upgrade.mjs"),file=path.join(root,"record.md"),rename=fs.renameSync,rm=fs.rmSync;if(existed)put(root,"record.md","Original.\n");const applied=applyEdits(root,[{file:"record.md",next:"Published.\n"}]);assert.equal(applied.ok,true);let injected=false;
    const plant=()=>{if(injected)return;injected=true;put(root,"save.human","Human during rollback.\n");rename(path.join(root,"save.human"),file);};
    t.mock.method(fs,"renameSync",(from,to,...args)=>{if(from===file||to===file)plant();return rename(from,to,...args);});t.mock.method(fs,"rmSync",(at,...args)=>{if(at===file)plant();return rm(at,...args);});
    assert.equal(restore(root,applied.snapshots).ok,false);assert.equal(injected,true);assert.equal(fs.readFileSync(file,"utf8"),"Human during rollback.\n");
});
for(const action of ["repair","retire"])for(const shared of [false,true])test(`intact mark permits byte-level ${action} through ${shared?"shared":"compiler"}`,async()=>{
    const root=fixture();compileGuidance(root);const file=path.join(root,"api/CLAUDE.md"),clean=fs.readFileSync(file);fs.appendFileSync(file,Buffer.from([255]));if(action==="retire")fs.rmSync(path.join(root,".portulan/context/api.md"));
    assert.ok(compileGuidance(root,{check:true}).drifted>0);if(shared){const {applyEdits}=await import("./upgrade.mjs");assert.equal(applyEdits(root,guidanceEdits(root).edits).ok,true);}else compileGuidance(root);
    assert.equal(fs.existsSync(file),action==="repair");if(action==="repair")assert.deepEqual(fs.readFileSync(file),clean);assert.equal(compileGuidance(root,{check:true}).drifted,0);
});
for(const nested of [false,true])test(`failed ${nested?"nested":"ordinary"} staging preserves another invocation's recovery file`,()=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("api/CLAUDE.md","Changed.\n"));
    const script=`import fs from 'node:fs';import path from 'node:path';import {applyEdits} from ${JSON.stringify(new URL('./upgrade.mjs',import.meta.url).href)};import {guidanceEdits} from ${JSON.stringify(new URL('./compile.mjs',import.meta.url).href)};const root=${JSON.stringify(root)},nested=${nested};const edits=nested?guidanceEdits(root).edits:[{file:'ordinary.md',next:'Changed.'}];const index=nested?edits.findIndex(e=>e.file==='api/CLAUDE.md'):0;const human=path.join(root,(nested?'api/CLAUDE.md':'ordinary.md')+'.portulan-upgrade.'+process.pid+'.'+index);fs.writeFileSync(human,'Human recovery data.');const result=applyEdits(root,edits,{write(file,text,options){if(nested&&path.basename(file).startsWith('.CLAUDE.md.portulan-guidance.'))throw Error('Failure');fs.writeFileSync(file,text,options)}});process.stdout.write(JSON.stringify({ok:result.ok,kept:fs.existsSync(human)&&fs.readFileSync(human,'utf8')==='Human recovery data.'}));`;
    const child=spawnSync(process.execPath,["--input-type=module","-e",script],{encoding:"utf8",timeout:5000});assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),{ok:false,kept:true});
});
test("join preview refuses the same lost nested ownership as its write",async()=>{
    const root=fixture();compileGuidance(root);put(root,"CLAUDE.md","@api/CLAUDE.md\n\n## Instructions\n<!-- portulan: on-read -->\n\nA marked section.\n");const {run:instructions}=await import("./instructions.mjs");assert.equal(await instructions(["--workspace",path.join(root,".portulan"),"--write"],()=>{}),0);put(root,"api/CLAUDE.md","Human replacement.\n");const before=snapshot(root);
    for(const extra of [[],["--write"]]){const lines=[];assert.equal(await instructions(["--workspace",path.join(root,".portulan"),"--join",...extra],line=>lines.push(line)),2);assert.deepEqual(snapshot(root),before);assert.doesNotMatch(lines.join("\n"),/run with --write to apply/);}
});
for(const existing of [false,true])test(`vendor rollback retains human arrivals in ${existing?"pointer":"absent"} destination`,async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),into=path.join(parent,"feed"),{run:vendor}=await import("./vendor.mjs"),rename=fs.renameSync,lines=[];let injected=false;
    if(existing){put(into,"workspace.json",JSON.stringify({portulan:{spec:"2.15"},name:"feed",summary:"Pointer.",kind:"pointer",governed_by:{workspace:"fixture"}}));put(into,"README.md","Original pointer README.\n");}
    const inject=()=>{if(injected)return;injected=true;put(into,"api/CLAUDE.md","Human destination instruction.\n");if(existing){put(into,"README.md.human","Human revised destination README.\n");rename(path.join(into,"README.md.human"),path.join(into,"README.md"));put(into,"identity.md.human","Human destination identity.\n");rename(path.join(into,"identity.md.human"),path.join(into,"identity.md"));}const m=JSON.parse(fs.readFileSync(path.join(root,"workspace.json")));m.summary="Human changed source manifest.";put(root,"workspace.json",JSON.stringify(m));};
    t.mock.method(fs,"renameSync",(from,to,...args)=>{const result=rename(from,to,...args);if((!existing&&to===into)||(existing&&to===path.join(into,"workspace.json")))inject();return result;});
    if(existing){const link=fs.linkSync;t.mock.method(fs,"linkSync",(from,to,...args)=>{const result=link(from,to,...args);if(to===path.join(into,"workspace.json"))inject();return result;});}
    const code=await vendor([root,"--into",into,"--residence","feed-side","--switch","--leave","nothing","--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line)});
    assert.equal(injected,true,lines.join("\n"));assert.equal(code,2,lines.join("\n"));assert.equal(fs.readFileSync(path.join(into,"api/CLAUDE.md"),"utf8"),"Human destination instruction.\n");
    if(existing){assert.equal(JSON.parse(fs.readFileSync(path.join(into,"workspace.json"))).kind,"pointer");assert.equal(fs.readFileSync(path.join(into,"README.md"),"utf8"),"Human revised destination README.\n");assert.equal(fs.readFileSync(path.join(into,"identity.md"),"utf8"),"Human destination identity.\n");}else assert.equal(fs.existsSync(path.join(into,"workspace.json")),false);
    assert.match(lines.join("\n"),/rollback.*incomplete|retained|left.*review/i);
});

for(const shared of [false,true])for(const suffix of ["/.instructions","/api/CLAUDE.md"])test(`a complete ownership claim recovers after ${suffix} via ${shared?"shared":"compiler"}`,()=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("api/CLAUDE.md","Fresh body.\n"));
    const operation=shared?`applyEdits(${JSON.stringify(root)},guidanceEdits(${JSON.stringify(root)}).edits)`:`compileGuidance(${JSON.stringify(root)})`;
    const source=`import fs from 'node:fs';import {compileGuidance,guidanceEdits} from ${JSON.stringify(new URL('./compile.mjs',import.meta.url).href)};import {applyEdits} from ${JSON.stringify(new URL('./upgrade.mjs',import.meta.url).href)};const rename=fs.renameSync;fs.renameSync=(a,b)=>{const result=rename(a,b);if(a.endsWith(${JSON.stringify(suffix)})&&b.includes('.portulan-guidance-claim.'))process.exit(71);return result};${operation};`;
    const child=spawnSync(process.execPath,["--input-type=module","-e",source],{encoding:"utf8",timeout:5000});assert.equal(child.status,71,child.stderr);assert.ok(compileGuidance(root,{check:true}).drifted>0);compileGuidance(root);assert.equal(compileGuidance(root,{check:true}).drifted,0);assert.equal(snapshot(root).some(([file])=>file.includes('.portulan-guidance')),false);assert.match(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),/Fresh body/);
});

for(const shared of [false,true])test(`a human arrival after the old entry was claimed survives ${shared?"shared":"compiler"} publication`,async(t)=>{
    const root=fixture();compileGuidance(root);const target=path.join(root,"api/CLAUDE.md"),prior=fs.readFileSync(target),link=fs.linkSync;put(root,".portulan/context/api.md",unit("api/CLAUDE.md","Changed.\n"));let arrived=false;
    t.mock.method(fs,"linkSync",(from,to,...args)=>{if(to===target&&!arrived){arrived=true;put(root,"api/CLAUDE.md","Human after claim.\n");}return link(from,to,...args);});
    if(shared){const {applyEdits}=await import("./upgrade.mjs");assert.equal(applyEdits(root,guidanceEdits(root).edits).ok,false);}else assert.throws(()=>compileGuidance(root));
    assert.equal(arrived,true);assert.equal(fs.readFileSync(target,"utf8"),"Human after claim.\n");
    const claims=fs.readdirSync(path.dirname(target)).filter(name=>name.startsWith(".CLAUDE.md.portulan-guidance-claim."));assert.ok(claims.some(name=>fs.readFileSync(path.join(path.dirname(target),name)).equals(prior)));assert.throws(()=>compileGuidance(root),/ownership|human/i);
});
test("shared rollback restores a damaged owned body byte for byte",async()=>{
    const root=fixture();compileGuidance(root);const file=path.join(root,"api/CLAUDE.md");fs.appendFileSync(file,Buffer.from([255,254]));const before=snapshot(root),{applyEdits,restore}=await import("./upgrade.mjs"),edits=[...guidanceEdits(root).edits,{file:"failure.md",next:"Failure.\n"}];
    const result=applyEdits(root,edits,{write(file,bytes,options){if(file.includes("failure.md"))throw Error("Controlled failure");fs.writeFileSync(file,bytes,options);}});assert.equal(result.ok,false);assert.equal(restore(root,result.snapshots).ok,true);assert.deepEqual(snapshot(root),before);
});
for(const shared of [false,true])test(`a registry claim recovers even when the source is renamed again through ${shared?"shared":"compiler"}`,()=>{
    const root=fixture();compileGuidance(root);fs.renameSync(path.join(root,".portulan/context/api.md"),path.join(root,".portulan/context/client.md"));
    const operation=shared?`applyEdits(root,guidanceEdits(root).edits)`:`compileGuidance(root)`;
    const source=`import fs from 'node:fs';import {compileGuidance,guidanceEdits} from ${JSON.stringify(new URL('./compile.mjs',import.meta.url).href)};import {applyEdits} from ${JSON.stringify(new URL('./upgrade.mjs',import.meta.url).href)};const root=${JSON.stringify(root)},rename=fs.renameSync;fs.renameSync=(a,b)=>{const result=rename(a,b);if(a.endsWith('/.instructions')&&b.includes('.portulan-guidance-claim.'))process.exit(71);return result};${operation};`;
    const child=spawnSync(process.execPath,["--input-type=module","-e",source],{encoding:"utf8",timeout:5000});assert.equal(child.status,71,child.stderr);fs.renameSync(path.join(root,".portulan/context/client.md"),path.join(root,".portulan/context/final.md"));compileGuidance(root);assert.equal(compileGuidance(root,{check:true}).drifted,0);assert.match(fs.readFileSync(path.join(root,"api/CLAUDE.md"),"utf8"),/context\/final\.md/);assert.equal(snapshot(root).some(([file])=>file.includes(".portulan-guidance")),false);
});
test("unpublished registry preparation grants no ownership over an unregistered target",()=>{
    const root=fixture();compileGuidance(root);const bytes=fs.readFileSync(path.join(root,registry));fs.rmSync(path.join(root,registry));put(root,".claude/rules/portulan/..instructions.portulan-guidance.123.00000000-0000-0000-0000-000000000000",bytes);const before=snapshot(root);assert.throws(()=>compileGuidance(root),/ownership|registry|human/i);assert.deepEqual(snapshot(root),before);
});
for(const where of ["source","ownership"])test(`invalid UTF-8 in ${where} still refuses before mutation`,()=>{
    const root=fixture();compileGuidance(root);const file=path.join(root,where==="source"?".portulan/context/api.md":"api/CLAUDE.md"),bytes=fs.readFileSync(file);fs.writeFileSync(file,Buffer.concat([Buffer.from([255]),bytes]));const before=snapshot(root);assert.throws(()=>compileGuidance(root));assert.deepEqual(snapshot(root),before);
});
for(const original of [false,true])test(`vendor rollback preserves changed host records with gitignore ${original?"present":"absent"}`,async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),host=path.join(parent,"host"),{run:vendor}=await import("./vendor.mjs"),lines=[],say=line=>{lines.push(line);if(line.startsWith("vendor: wrote"))throw Error("Controlled publication failure");};const m=JSON.parse(fs.readFileSync(path.join(root,"workspace.json")));m.handoffs={index:{path:"handoffs-index.md"}};m.slots.handoffs="handoffs/";put(root,"workspace.json",JSON.stringify(m));put(root,"handoffs/.gitkeep","");if(original)put(host,".gitignore","Original ignore.\n");
    const link=fs.linkSync,write=fs.writeFileSync,rename=fs.renameSync,ignore=path.join(host,".gitignore");let injected=false;
    const inject=()=>{if(injected)return;injected=true;for(const [rel,text]of [[".gitignore","Human ignore.\n"],["changes/README.md","Human fragment guide.\n"],["changes/new.md","Human fragment.\n"]]){put(host,rel+".human",text);rename(path.join(host,rel+".human"),path.join(host,rel));}};
    t.mock.method(fs,"linkSync",(from,to,...args)=>{const value=link(from,to,...args);if(to===ignore)inject();return value;});t.mock.method(fs,"writeFileSync",(file,...args)=>{const value=write(file,...args);if(file===ignore)inject();return value;});
    assert.equal(await vendor([root,"--into",path.join(host,".portulan"),"--residence","in-repo","--host","generic"],{say,warn:line=>lines.push(line)}),2,lines.join("\n"));assert.equal(injected,true,lines.join("\n"));for(const [rel,text]of [[".gitignore","Human ignore.\n"],["changes/README.md","Human fragment guide.\n"],["changes/new.md","Human fragment.\n"]])assert.equal(fs.readFileSync(path.join(host,rel),"utf8"),text);assert.equal(fs.existsSync(path.join(host,".portulan/workspace.json")),false);assert.match(lines.join("\n"),/rollback incomplete/);
});

for(const mode of ["created","existing","repeated"])test(`post-publication cleanup failure journals ${mode} edits for rollback`,async(t)=>{
    const root=fixture(),{applyEdits,restore}=await import("./upgrade.mjs"),unlink=fs.unlinkSync,file=path.join(root,"record.md");if(mode!=="created")put(root,"record.md","Original.\n");const before=mode==="created"?null:fs.readFileSync(file);let injected=false;
    t.mock.method(fs,"unlinkSync",(at,...args)=>{if(!injected&&String(at).includes("portulan-guidance-claim.")&&fs.existsSync(file)&&fs.readFileSync(file,"utf8")==="Published.\n"){injected=true;throw Object.assign(Error("Cleanup failed"),{code:"EIO"});}return unlink(at,...args);});
    const edits=mode==="repeated"?[{file:"record.md",next:"Intermediate.\n"},{file:"record.md",next:"Published.\n"}]:[{file:"record.md",next:"Published.\n"}];const result=applyEdits(root,edits);assert.equal(injected,true);assert.equal(result.ok,false);assert.equal(restore(root,result.snapshots).ok,true);assert.equal(fs.existsSync(file),before!==null);if(before!==null)assert.deepEqual(fs.readFileSync(file),before);assert.equal(snapshot(root).some(([file])=>file.includes("portulan-guidance")||file.includes("portulan-upgrade")),false);
});
test("real split restores its instruction section after post-publication cleanup fails",async(t)=>{
    const root=fixture();compileGuidance(root);const original="## Instructions\n<!-- portulan: on-read -->\n\nEssential live instructions.\n";put(root,"CLAUDE.md",original);const unlink=fs.unlinkSync,file=path.join(root,"CLAUDE.md");let injected=false;
    t.mock.method(fs,"unlinkSync",(at,...args)=>{if(!injected&&path.dirname(at)===root&&path.basename(at).startsWith(".CLAUDE.md.portulan-guidance-claim.")&&fs.readFileSync(file,"utf8")!==original){injected=true;throw Object.assign(Error("Cleanup failed"),{code:"EIO"});}return unlink(at,...args);});
    const {run:instructions}=await import("./instructions.mjs"),lines=[];assert.equal(await instructions(["--workspace",path.join(root,".portulan"),"--write"],line=>lines.push(line)),2);assert.equal(injected,true);assert.equal(fs.readFileSync(file,"utf8"),original);assert.equal(fs.existsSync(path.join(root,".portulan/context/instructions.md")),false);assert.equal(snapshot(root).some(([file])=>file.includes("portulan-guidance")),false);
});
test("rollback never follows a cleanup journal outside its transaction root",async()=>{
    const root=fixture(),outside=fixture(),{applyEdits,restore}=await import("./upgrade.mjs");put(outside,"human.md","Outside human file.\n");const file=path.join(outside,"human.md"),at=fs.statSync(file),applied=applyEdits(root,[{file:"record.md",next:"Published.\n"}]);assert.equal(applied.ok,true);applied.snapshots[0].cleanup.push({file,before:"Outside human file.\n",identity:{dev:at.dev,ino:at.ino}});assert.equal(restore(root,applied.snapshots).ok,false);assert.equal(fs.readFileSync(file,"utf8"),"Outside human file.\n");
});
for(const leave of ["nothing","pointer"])test(`final vendor ${leave} transition preserves a saved source manifest`,async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),manifest=path.join(root,"workspace.json"),into=path.join(parent,"feed"),rename=fs.renameSync,rm=fs.rmSync;let injected=false;const save=()=>{if(injected)return;injected=true;const m=JSON.parse(fs.readFileSync(manifest));m.summary="Human final manifest save.";put(root,"workspace.json.human",JSON.stringify(m));rename(path.join(root,"workspace.json.human"),manifest);};
    t.mock.method(fs,"renameSync",(from,to,...args)=>{if(from===manifest||to===manifest)save();return rename(from,to,...args);});t.mock.method(fs,"rmSync",(at,...args)=>{if(at===manifest)save();return rm(at,...args);});
    const lines=[];assert.equal(await vendor([root,"--into",into,"--residence","feed-side","--switch","--leave",leave,"--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line)}),2,lines.join("\n"));assert.equal(injected,true);assert.equal(JSON.parse(fs.readFileSync(manifest)).summary,"Human final manifest save.");assert.equal(fs.existsSync(path.join(into,"workspace.json")),false);
});
test("failed pointer publication retains a later staging replacement",async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),manifest=path.join(root,"workspace.json"),stage=manifest+".vendoring",rename=fs.renameSync,link=fs.linkSync;let injected=false;
    const intercept=(from,to)=>{if(injected||from!==stage||to!==manifest)return;injected=true;put(root,"workspace.json.vendoring.human","Human recovery data.\n");rename(stage+".human",stage);throw Error("Pointer publication failed");};
    t.mock.method(fs,"renameSync",(from,to,...args)=>{intercept(from,to);return rename(from,to,...args);});t.mock.method(fs,"linkSync",(from,to,...args)=>{intercept(from,to);return link(from,to,...args);});
    const lines=[];assert.equal(await vendor([root,"--into",path.join(parent,"feed"),"--residence","feed-side","--switch","--leave","pointer","--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line)}),2,lines.join("\n"));assert.equal(injected,true);assert.equal(fs.readFileSync(stage,"utf8"),"Human recovery data.\n");assert.equal(JSON.parse(fs.readFileSync(manifest)).name,"fixture");
});
for(const destination of ["host","existing"])test(`vendor rollback preserves unrelated empty ${destination} directories`,async()=>{
    const {root,parent}=rootWorkspaceFixture(),into=path.join(parent,destination),{run:vendor}=await import("./vendor.mjs");put(into,"work/empty-input/.remove","");fs.rmSync(path.join(into,"work/empty-input/.remove"));
    const args=destination==="host"?[root,"--into",path.join(into,".portulan"),"--residence","in-repo","--host","generic"]:[root,"--into",into,"--residence","feed-side","--switch","--leave","nothing","--kind","demo"],lines=[];assert.equal(await vendor(args,{say:line=>lines.push(line),warn:line=>lines.push(line),faultAt:"materialise:manifest"}),2,lines.join("\n"));assert.match(lines.join("\n"),/injected I\/O failure after `materialise:manifest`/);assert.equal(fs.statSync(path.join(into,"work/empty-input")).isDirectory(),true);
});
for(const leave of ["nothing","pointer"])test(`vendor ${leave} retirement preserves a later empty source directory`,async()=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),lines=[];let arrived=false;const say=line=>{lines.push(line);if(!arrived&&line.includes("vendor: materialising")){arrived=true;fs.mkdirSync(path.join(root,"new-human-empty"));}};
    assert.equal(await vendor([root,"--into",path.join(parent,"feed"),"--residence","feed-side","--switch","--leave",leave,"--kind","demo"],{say,warn:say}),0,lines.join("\n"));assert.equal(arrived,true);assert.equal(fs.statSync(path.join(root,"new-human-empty")).isDirectory(),true);assert.doesNotMatch(lines.join("\n"),/nothing left at/);
});
test("vendor can clean its own read-only staging directories after publishing into an existing residence",async()=>{
    const {root,parent}=rootWorkspaceFixture(),into=path.join(parent,"feed"),{run:vendor}=await import("./vendor.mjs"),lines=[];fs.mkdirSync(into);fs.chmodSync(path.join(root,"context"),0o555);
    try{assert.equal(await vendor([root,"--into",into,"--residence","feed-side","--switch","--leave","nothing","--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line)}),0,lines.join("\n"));assert.equal(fs.statSync(path.join(into,"context")).mode&0o777,0o555);assert.equal(fs.existsSync(path.join(parent,".feed.vendoring")),false);}
    finally{for(const file of [path.join(root,"context"),path.join(into,"context"),path.join(parent,".feed.vendoring/context")])if(fs.existsSync(file))fs.chmodSync(file,0o755);}
});
for(const form of ["nested","scoped"])test(`actual ${form} compiler detects unequal replacement-character bytes and refuses invalid source`,()=>{
    const root=fixture(form==="nested"?unit("api/CLAUDE.md","Literal \ufffd remains.\n"):unit("api/CLAUDE.md","Literal \ufffd remains.\n").replace('target: "api/CLAUDE.md"','paths: ["api/**"]'));compileGuidance(root);const target=path.join(root,form==="nested"?"api/CLAUDE.md":".claude/rules/portulan/api.md"),bytes=fs.readFileSync(target),index=bytes.indexOf(Buffer.from([239,191,189]));assert.ok(index>=0);fs.writeFileSync(target,Buffer.concat([bytes.subarray(0,index),Buffer.from([255]),bytes.subarray(index+3)]));
    assert.equal(run(["--workspace",root,"--check"],{quiet:true}),1);assert.equal(run(["--workspace",root],{quiet:true}),0);assert.deepEqual(fs.readFileSync(target),bytes);fs.appendFileSync(path.join(root,".portulan/context/api.md"),Buffer.from([255]));const before=snapshot(root);assert.equal(run(["--workspace",root,"--check"],{quiet:true}),2);assert.equal(run(["--workspace",root],{quiet:true}),2);assert.throws(()=>guidanceEdits(root));assert.deepEqual(snapshot(root),before);
});
for(const human of [false,true])for(const shared of [false,true])test(`a failed ${shared?"shared":"join"} deletion ${human?"retains a later human arrival":"restores the active unit"}`,async(t)=>{
    const root=fixture(),{applyEdits,restore}=await import("./upgrade.mjs"),{run:instructions}=await import("./instructions.mjs");compileGuidance(root);put(root,"CLAUDE.md","## Instructions\n<!-- portulan: on-read -->\n\nEssential instructions.\n");if(!shared)assert.equal(await instructions(["--workspace",path.join(root,".portulan"),"--write"],()=>{}),0);
    const rel=shared?"api/CLAUDE.md":".portulan/context/instructions.md",file=path.join(root,rel),before=fs.readFileSync(file),unlink=fs.unlinkSync,rename=fs.renameSync;let injected=false;if(shared)put(root,".portulan/context/api.md",unit("other/CLAUDE.md"));
    t.mock.method(fs,"unlinkSync",(at,...args)=>{if(!injected&&path.dirname(at)===path.dirname(file)&&path.basename(at).startsWith("."+path.basename(file)+".portulan-guidance-claim.")){injected=true;if(human){put(root,rel+".human","Human arrival after deletion.\n");rename(file+".human",file);}throw Object.assign(Error("Cleanup EIO"),{code:"EIO"});}return unlink(at,...args);});
    if(shared){const result=applyEdits(root,guidanceEdits(root).edits);assert.equal(result.ok,false);assert.equal(restore(root,result.snapshots).ok,!human);assert.equal(fs.existsSync(path.join(root,"other/CLAUDE.md")),false);}else{const lines=[];assert.equal(await instructions(["--workspace",path.join(root,".portulan"),"--join","--write"],line=>lines.push(line)),2);if(human)assert.match(lines.join("\n"),/INCOMPLETE/);else assert.match(lines.join("\n"),/rolled back/);}
    assert.equal(injected,true);assert.deepEqual(fs.readFileSync(file),human?Buffer.from("Human arrival after deletion.\n"):before);if(!human)assert.equal(snapshot(root).some(([file])=>file.includes("portulan-guidance")),false);
});
for(const rel of ["README.md","workspace.json"])test(`vendor rollback never pairs old ${rel} bytes with a newer pointer identity`,async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),into=path.join(parent,"feed"),{run:vendor}=await import("./vendor.mjs"),read=fs.readFileSync,rename=fs.renameSync;const original={portulan:{spec:"2.15"},name:"feed",kind:"pointer",summary:"Original pointer.",governed_by:{workspace:"fixture"}};put(into,"workspace.json",JSON.stringify(original));put(into,"README.md","Original README.\n");const file=path.join(into,rel),saved=rel==="README.md"?"Human pointer README.\n":JSON.stringify({...original,summary:"Human pointer save."});let edited=false;
    t.mock.method(fs,"readFileSync",(at,...args)=>{const value=read(at,...args);if(!edited&&at===file&&args.length===0){edited=true;put(into,rel+".human",saved);rename(file+".human",file);}return value;});
    const lines=[];assert.equal(await vendor([root,"--into",into,"--residence","feed-side","--switch","--leave","nothing","--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line),faultAt:"materialise:manifest"}),2,lines.join("\n"));assert.equal(edited,true);assert.equal(fs.readFileSync(file,"utf8"),saved);assert.equal(JSON.parse(fs.readFileSync(path.join(root,"workspace.json"))).kind,"repository");
});
for(const conflict of ["duplicate","prefix"])test(`vendor host rendering refuses source-intrinsic ${conflict} targets`,async()=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),into=path.join(parent,"host/.portulan");put(root,"context/api.md",unit(conflict==="duplicate"?"api/CLAUDE.md":"parts/a/CLAUDE.md"));put(root,"context/second.md",unit(conflict==="duplicate"?"api/CLAUDE.md":"Parts/b/CLAUDE.md"));assert.throws(()=>compileGuidance(root));const before=snapshot(root);
    for(const extra of [["--dry-run"],[]]){const lines=[];assert.equal(await vendor([root,"--into",into,"--residence","in-repo","--host","generic",...extra],{say:line=>lines.push(line),warn:line=>lines.push(line)}),2,lines.join("\n"));assert.equal(fs.existsSync(into),false);assert.equal(fs.existsSync(path.join(parent,"host/AGENTS.md")),false);assert.deepEqual(snapshot(root),before);}
});
for(const failure of ["write","chmod","replacement"])test(`vendor ${failure} staging failure ${failure==="replacement"?"preserves a later replacement":"cleans its partial and permits retry"}`,async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),into=path.join(parent,"host/.portulan"),stage=path.join(parent,"host/.portulan.vendoring"),wanted=Buffer.from("Unique staged bytes for partial failure and retry.\n"),write=fs.writeFileSync,chmod=fs.fchmodSync,rename=fs.renameSync;put(root,"notes.md",wanted);let failed=false,descriptor;
    t.mock.method(fs,"writeFileSync",(file,bytes,...args)=>{if(typeof file==="number"&&Buffer.from(bytes).equals(wanted)){descriptor=file;if(!failed&&failure!=="chmod"){failed=true;write(file,wanted.subarray(0,4));if(failure==="replacement"){put(stage,"notes.md.human","Human staging replacement.\n");rename(path.join(stage,"notes.md.human"),path.join(stage,"notes.md"));}throw Object.assign(Error("Partial ENOSPC"),{code:"ENOSPC"});}}return write(file,bytes,...args);});
    t.mock.method(fs,"fchmodSync",(fd,...args)=>{if(fd===descriptor&&!failed&&failure==="chmod"){failed=true;throw Object.assign(Error("chmod EIO"),{code:"EIO"});}return chmod(fd,...args);});
    const args=[root,"--into",into,"--residence","in-repo","--host","generic"],lines=[];assert.equal(await vendor(args,{say:line=>lines.push(line),warn:line=>lines.push(line)}),2,lines.join("\n"));assert.equal(failed,true);if(failure==="replacement"){assert.equal(fs.readFileSync(path.join(stage,"notes.md"),"utf8"),"Human staging replacement.\n");assert.match(lines.join("\n"),/rollback incomplete/);}else{assert.equal(fs.existsSync(stage),false);assert.equal(await vendor(args,{say:line=>lines.push(line),warn:line=>lines.push(line)}),0,lines.join("\n"));assert.deepEqual(fs.readFileSync(path.join(into,"notes.md")),wanted);}
});
for(const shared of [false,true])for(const metadata of [false,true])test(`partial ${metadata?"registry":"target"} claim preparation cleans up through ${shared?"shared":"compiler"}`,async(t)=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("api/CLAUDE.md","Fresh body.\n"));const before=snapshot(root),open=fs.openSync,write=fs.writeFileSync,close=fs.closeSync,fds=new Map(),prefix=metadata?"..instructions.portulan-guidance-claim.":".CLAUDE.md.portulan-guidance-claim.";let failed=false;
    t.mock.method(fs,"openSync",(file,...args)=>{const fd=open(file,...args);fds.set(fd,String(file));return fd;});t.mock.method(fs,"closeSync",fd=>{fds.delete(fd);return close(fd);});t.mock.method(fs,"writeFileSync",(fd,bytes,...args)=>{if(!failed&&typeof fd==="number"&&path.basename(fds.get(fd)??"").startsWith(prefix)){failed=true;write(fd,Buffer.from(bytes).subarray(0,4));throw Object.assign(Error("Partial claim ENOSPC"),{code:"ENOSPC"});}return write(fd,bytes,...args);});
    if(shared){const {applyEdits,restore}=await import("./upgrade.mjs"),result=applyEdits(root,guidanceEdits(root).edits);assert.equal(result.ok,false);assert.equal(restore(root,result.snapshots).ok,true);assert.deepEqual(snapshot(root),before);}else assert.throws(()=>compileGuidance(root));assert.equal(failed,true);assert.equal(snapshot(root).some(([file])=>file.includes("portulan-guidance")),false);compileGuidance(root);assert.equal(compileGuidance(root,{check:true}).drifted,0);
});
test("partial claim cleanup preserves an atomic human replacement",t=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("api/CLAUDE.md","Fresh body.\n"));const open=fs.openSync,write=fs.writeFileSync,rename=fs.renameSync,fds=new Map();let failed=false,retained;
    t.mock.method(fs,"openSync",(file,...args)=>{const fd=open(file,...args);fds.set(fd,String(file));return fd;});t.mock.method(fs,"writeFileSync",(fd,bytes,...args)=>{const file=fds.get(fd);if(!failed&&typeof fd==="number"&&path.basename(file??"").startsWith("..instructions.portulan-guidance-claim.")){failed=true;retained=file;write(fd,Buffer.from(bytes).subarray(0,4));write(file+".human","Human recovery replacement.\n");rename(file+".human",file);throw Object.assign(Error("Partial claim ENOSPC"),{code:"ENOSPC"});}return write(fd,bytes,...args);});
    assert.throws(()=>compileGuidance(root));assert.equal(failed,true);assert.equal(fs.readFileSync(retained,"utf8"),"Human recovery replacement.\n");
});
test("handled claim rename failure cleans its backup under a restrictive umask",t=>{
    const root=fixture();compileGuidance(root);put(root,".portulan/context/api.md",unit("api/CLAUDE.md","Fresh body.\n"));const rename=fs.renameSync;let failed=false;t.mock.method(fs,"renameSync",(from,to,...args)=>{if(!failed&&from===path.join(root,registry)){failed=true;throw Object.assign(Error("Claim rename EIO"),{code:"EIO"});}return rename(from,to,...args);});const mask=process.umask(0o077);try{assert.throws(()=>compileGuidance(root));assert.equal(failed,true);assert.equal(snapshot(root).some(([file])=>file.includes("portulan-guidance")),false);}finally{process.umask(mask);}compileGuidance(root);assert.equal(compileGuidance(root,{check:true}).drifted,0);
});
for(const rollback of [false,true])test(`vendor ${rollback?"rollback":"append"} preserves all existing gitignore bytes`,async()=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),host=path.join(parent,"host"),into=path.join(host,".portulan"),m=JSON.parse(fs.readFileSync(path.join(root,"workspace.json"))),before=Buffer.from([102,128,10]);m.handoffs={index:{path:"handoffs-index.md"}};m.slots.handoffs="handoffs/";put(root,"workspace.json",JSON.stringify(m));put(root,"handoffs/.gitkeep","");put(host,".gitignore",before);const lines=[],say=line=>{lines.push(line);if(rollback&&line.startsWith("vendor: wrote"))throw Error("Failure after host records");};
    assert.equal(await vendor([root,"--into",into,"--residence","in-repo","--host","generic"],{say,warn:line=>lines.push(line)}),rollback?2:0,lines.join("\n"));const after=fs.readFileSync(path.join(host,".gitignore"));if(rollback)assert.deepEqual(after,before);else{assert.deepEqual(after.subarray(0,before.length),before);assert.match(after.subarray(before.length).toString("utf8"),/\/\.portulan\/handoffs-index\.md/);}
});
for(const conflict of ["duplicate","prefix"])test(`native residence switch refuses ${conflict} declarations before retiring its source`,async()=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),into=path.join(parent,"feed");put(root,"context/api.md",unit(conflict==="duplicate"?"api/CLAUDE.md":"parts/a/CLAUDE.md"));put(root,"context/second.md",unit(conflict==="duplicate"?"api/CLAUDE.md":"Parts/b/CLAUDE.md"));const before=snapshot(root);for(const extra of [["--dry-run"],[]]){const lines=[];assert.equal(await vendor([root,"--into",into,"--residence","feed-side","--switch","--leave","nothing","--kind","demo",...extra],{say:line=>lines.push(line),warn:line=>lines.push(line)}),2,lines.join("\n"));assert.deepEqual(snapshot(root),before);assert.equal(fs.existsSync(into),false);}
});
for(const phase of ["claim","link"])test(`a split handles an ambiguous ${phase} error after the filesystem operation`,async(t)=>{
    const root=fixture();compileGuidance(root);const original="## Instructions\n<!-- portulan: on-read -->\n\nEssential instructions.\n",file=path.join(root,"CLAUDE.md");put(root,"CLAUDE.md",original);const rename=fs.renameSync,link=fs.linkSync;let failed=false;
    t.mock.method(fs,"renameSync",(from,to,...args)=>{const result=rename(from,to,...args);if(!failed&&phase==="claim"&&from===file&&String(to).includes("portulan-guidance-claim.")){failed=true;throw Object.assign(Error("Ambiguous rename EIO"),{code:"EIO"});}return result;});
    t.mock.method(fs,"linkSync",(from,to,...args)=>{const result=link(from,to,...args);if(!failed&&phase==="link"&&to===file){failed=true;throw Object.assign(Error("Ambiguous link EIO"),{code:"EIO"});}return result;});
    const {run:instructions}=await import("./instructions.mjs"),lines=[];assert.equal(await instructions(["--workspace",path.join(root,".portulan"),"--write"],line=>lines.push(line)),2,lines.join("\n"));assert.equal(failed,true);assert.equal(fs.readFileSync(file,"utf8"),original);assert.equal(fs.existsSync(path.join(root,".portulan/context/instructions.md")),false);assert.equal(snapshot(root).some(([file])=>file.includes("portulan-guidance")),false);
});
for(const join of [false,true])for(const changed of ["root","unit"])test(`${join?"join":"split"} preserves a ${changed} save after planning`,async()=>{
    const root=fixture();compileGuidance(root);put(root,"CLAUDE.md","## Instructions\n<!-- portulan: on-read -->\n\nEssential instructions.\n");const {run:instructions}=await import("./instructions.mjs"),args=["--workspace",path.join(root,".portulan")];if(join)assert.equal(await instructions([...args,"--write"],()=>{}),0);const rel=changed==="root"?"CLAUDE.md":".portulan/context/instructions.md",file=path.join(root,rel),saved=(fs.existsSync(file)?fs.readFileSync(file,"utf8"):"Human unit.\n")+"\nHuman save after planning.\n",other=path.join(root,changed==="root"?".portulan/context/instructions.md":"CLAUDE.md"),otherBefore=fs.existsSync(other)?fs.readFileSync(other):null;let edited=false;const lines=[];
    const say=line=>{lines.push(line);if(!edited&&line.startsWith("instructions:")){edited=true;put(root,rel+".human",saved);fs.renameSync(file+".human",file);}};assert.equal(await instructions([...args,...(join?["--join"]:[]),"--write"],say),2,lines.join("\n"));assert.equal(edited,true);assert.equal(fs.readFileSync(file,"utf8"),saved);if(otherBefore===null)assert.equal(fs.existsSync(other),false);else assert.deepEqual(fs.readFileSync(other),otherBefore);
});
test("an interrupted split publishes its unit before replacing its live source",()=>{
    const root=fixture();compileGuidance(root);put(root,"CLAUDE.md","## Instructions\n<!-- portulan: on-read -->\n\nEssential instructions.\n");const script=`import fs from 'node:fs';import {run} from ${JSON.stringify(new URL('./instructions.mjs',import.meta.url).href)};const link=fs.linkSync;fs.linkSync=(from,to,...args)=>{const value=link(from,to,...args);if(to===${JSON.stringify(path.join(root,'CLAUDE.md'))})process.exit(71);return value;};await run(['--workspace',${JSON.stringify(path.join(root,'.portulan'))},'--write'],()=>{});`;
    const child=spawnSync(process.execPath,["--input-type=module","-e",script],{encoding:"utf8",timeout:5000});assert.equal(child.status,71,child.stderr);assert.match(fs.readFileSync(path.join(root,".portulan/context/instructions.md"),"utf8"),/Essential instructions/);compileGuidance(root);assert.equal(compileGuidance(root,{check:true}).drifted,0);
});
for(const changed of [false,true])for(const arrived of [false,true])test(`ambiguous vendor retirement preserves ${changed?"changed":"unchanged"} material with arrival ${arrived}`,async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),file=path.join(root,"notes.md"),rename=fs.renameSync,original="Original notes.\n",saved="Human save before retirement.\n",later="Independent arrival after retirement.\n";put(root,"notes.md",original);let failed=false;
    t.mock.method(fs,"renameSync",(from,to,...args)=>{if(!failed&&from===file&&String(to).includes(".portulan-retire.")){failed=true;if(changed){put(root,"notes.md.human",saved);rename(file+".human",file);}const result=rename(from,to,...args);if(arrived)put(root,"notes.md",later);throw Object.assign(Error("Ambiguous retirement EIO"),{code:"EIO"});}return rename(from,to,...args);});
    const lines=[];assert.equal(await vendor([root,"--into",path.join(parent,"feed"),"--residence","feed-side","--switch","--leave","nothing","--kind","demo"],{say:line=>lines.push(line),warn:line=>lines.push(line)}),2,lines.join("\n"));assert.equal(failed,true);assert.equal(fs.readFileSync(file,"utf8"),arrived?later:changed?saved:original);assert.equal(fs.readFileSync(path.join(parent,"feed/notes.md"),"utf8"),original);if(changed)assert.ok(snapshot(root).some(([rel,type])=>type!=="dir"&&fs.lstatSync(path.join(root,rel)).isFile()&&fs.readFileSync(path.join(root,rel)).includes(saved)));
});
for(const host of [false,true])test(`vendor ${host?"host rendering":"native switch"} validates the bytes it actually stages`,async(t)=>{
    const {root,parent}=rootWorkspaceFixture(),{run:vendor}=await import("./vendor.mjs"),file=path.join(root,"context/second.md"),read=fs.readFileSync,rename=fs.renameSync,original=unit("worker/CLAUDE.md"),saved=unit(host?"special/CLAUDE.md":"api/CLAUDE.md");put(root,"context/second.md",original);const physical=fs.realpathSync(file);let edited=false;
    t.mock.method(fs,"readFileSync",(at,...args)=>{const bytes=read(at,...args);if(!edited&&(at===file||at===physical)){edited=true;put(root,"context/second.md.human",saved);rename(file+".human",file);}return bytes;});const into=path.join(parent,host?"host/.portulan":"feed"),args=host?[root,"--into",into,"--residence","in-repo","--host","generic"]:[root,"--into",into,"--residence","feed-side","--switch","--leave","nothing","--kind","demo"],lines=[];
    assert.equal(await vendor(args,{say:line=>lines.push(line),warn:line=>lines.push(line)}),host?0:2,lines.join("\n"));assert.equal(edited,true);assert.equal(fs.readFileSync(file,"utf8"),saved);if(host){assert.equal(fs.readFileSync(path.join(into,"context/second.md"),"utf8"),saved);const agents=fs.readFileSync(path.join(parent,"host/AGENTS.md"),"utf8");assert.match(agents,/special\/\*\*/);assert.doesNotMatch(agents,/worker\/\*\*/);}else{assert.equal(fs.existsSync(into),false);assert.equal(JSON.parse(fs.readFileSync(path.join(root,"workspace.json"))).kind,"repository");}
});
for(const join of [false,true])test(`${join?"join":"split"} preview preflights pending nested parent permissions`,async()=>{
    const root=fixture();compileGuidance(root);put(root,"CLAUDE.md","## Instructions\n<!-- portulan: on-read -->\n\nMarked section.\n");const {run:instructions}=await import("./instructions.mjs"),args=["--workspace",path.join(root,".portulan")];if(join)assert.equal(await instructions([...args,"--write"],()=>{}),0);put(root,".portulan/context/api.md",unit("api/CLAUDE.md","Changed.\n"));const dir=path.join(root,"api"),mode=fs.statSync(dir).mode;fs.chmodSync(dir,0o555);const before=snapshot(root);
    try{for(const extra of [[],["--write"]]){const lines=[];assert.equal(await instructions([...args,...(join?["--join"]:[]),...extra],line=>lines.push(line)),2,lines.join("\n"));assert.doesNotMatch(lines.join("\n"),/run with --write/);assert.deepEqual(snapshot(root),before);}assert.equal(compileGuidance(root,{check:true}).drifted>0,true);}finally{fs.chmodSync(dir,mode);}
});
