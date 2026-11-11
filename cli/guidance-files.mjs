// Nested instruction ownership and atomic guidance publication.

import fs from "node:fs";
import path from "node:path";
import { randomUUID,createHash } from "node:crypto";
import { isInside } from "./inside.mjs";

export class CompileError extends Error {
    constructor(message) { super(message); this.name = "CompileError"; }
}
export function readOwnedBytes(file, scope) {
    fs.lstatSync(file);
    let owner, real;
    try { owner = fs.realpathSync(scope); real = fs.realpathSync(file); }
    catch (error) { throw new CompileError(`${file} could not be resolved — ${error.code ?? error.message}`); }
    if (!isInside(owner, real)) throw new CompileError(`${file} resolves outside its owner ${scope}`);
    if (!fs.statSync(real).isFile()) throw new CompileError(`${file} is not a regular source file`);
    return fs.readFileSync(real);
}
export function readOwnedText(file, scope) {
    try{return new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(readOwnedBytes(file,scope));}
    catch(error){if(error instanceof TypeError)throw new CompileError(`${file} is not valid UTF-8`);throw error;}
}
export const sameContent=(left,right)=>left===null||right===null ? left===right : Buffer.from(left).equals(Buffer.from(right));
export function readOutput(file,scope) {
    const bytes=readOwnedBytes(file,scope);
    try{return new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return bytes;}
}
export const NESTED_REGISTRY = ".claude/rules/portulan/.instructions";
const MARK = '<!-- portulan compiled instruction ';
const posix = value => value.split(path.sep).join("/");
const relative = value => typeof value === "string" && value !== "" && !/[\\\u0000-\u001f\u007f\u0085\u2028\u2029]/.test(value) && !path.posix.isAbsolute(value) && !/^[A-Za-z]:/.test(value) && value.split("/").every(part => part !== "" && part !== "." && part !== "..");
const within = (base, value) => base === "." || value.startsWith(`${base}/`);
const samePath = value => value.toLowerCase();
const entry = file => {
    try { return fs.lstatSync(file); }
    catch (error) { if (error.code === "ENOENT") return null; throw new CompileError(`${file} could not be inspected — ${error.code ?? error.message}`); }
};
export function nestedTarget(value, where) {
    const parts = typeof value === "string" ? value.split("/") : [];
    if (!relative(value) || value.length > 1024 || parts.length < 2 || parts.length > 33 || parts.at(-1) !== "CLAUDE.md" || !parts.slice(0,-1).every(part => part.length <= 128 && part.toLowerCase()!=="claude.md" && /^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(part) && !/[ .]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
        throw new CompileError(`${where}: target must name a portable relative child-directory CLAUDE.md, without globs, escapes or control paths`);
    }
    return value;
}
function ownerAt(root, named) {
    const base = path.resolve(root), workspace = path.resolve(base, named);
    if (!isInside(base, workspace)) throw new CompileError("nested instruction workspace lies outside its project");
    const exists = entry(workspace);
    const owner = posix(exists ? path.relative(fs.realpathSync(base),fs.realpathSync(workspace)) : path.relative(base,workspace)) || ".";
    if (owner !== "." && !relative(owner)) throw new CompileError("nested instruction workspace cannot be represented inside its project");
    return owner;
}
function sourceId(value, owner) {
    if (!relative(value) || !value.endsWith(".md") || !within(owner, value)) throw new CompileError("nested ownership source is not inside its workspace");
    return value;
}
export function nestedMark(owner, source, target) {
    const json = JSON.stringify({ workspace: owner, source, target }).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
    return `${MARK}${json} -->\n`;
}
function marked(text) {
    const bytes=Buffer.from(text),end=bytes.indexOf(10);
    let first;try{first=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(end<0?bytes:bytes.subarray(0,end));}catch{return null;}
    if (!first.startsWith(MARK) || !first.endsWith(" -->")) return null;
    try {
        const value = JSON.parse(first.slice(MARK.length,-4));
        return value && Object.keys(value).sort().join(",") === "source,target,workspace" && typeof value.source === "string" && typeof value.workspace === "string" && typeof value.target === "string" ? value : null;
    } catch { return null; }
}
function landing(root, rel, kind = "file") {
    let current = path.resolve(root);
    for (const [index, part] of rel.split("/").entries()) {
        current = path.join(current, part); const value = entry(current);
        if (!value) return null;
        if(!fs.readdirSync(path.dirname(current)).includes(part)) throw new CompileError(`${rel} has a noncanonical case spelling; nested ownership refuses it`);
        if (value.isSymbolicLink() || (index < rel.split("/").length-1 || kind==="directory" ? !value.isDirectory() : !value.isFile())) throw new CompileError(`${rel} has a link or nonregular output path; nested ownership refuses it`);
    }
    return fs.lstatSync(current);
}
function temporaryKind(name,base) {
    for(const [kind,prefix] of [["prepared",`.${base}.portulan-guidance.`],["claim",`.${base}.portulan-guidance-claim.`]]) {
        if(!name.startsWith(prefix))continue;
        const match=/^\d+\.[a-f0-9-]{36}(?:\.([a-f0-9]{64}))?$/.exec(name.slice(prefix.length));
        if(match && (kind==="claim" ? Boolean(match[1]) : !match[1]))return {kind,digest:match[1]};
    }
    return null;
}
const digest=value=>createHash("sha256").update(value).digest("hex");
function temporaryLinks(root,rel,value) {
    if(value.nlink===1)return [];
    const file=path.join(root,rel),base=path.basename(file);
    const links=fs.readdirSync(path.dirname(file)).filter(name=>{
        const type=temporaryKind(name,base);if(!type)return false;
        const full=path.join(path.dirname(file),name),candidate=fs.lstatSync(full);
        return candidate.isFile()&&candidate.dev===value.dev&&candidate.ino===value.ino&&(type.kind!=="claim"||digest(fs.readFileSync(full))===type.digest);
    });
    if(value.nlink!==links.length+1)throw new CompileError(`${rel} is a multiply linked output; nested ownership cannot rewrite it`);
    return links.map(name=>posix(path.join(path.dirname(rel),name)));
}
function serialize(owner, files) {
    return `${JSON.stringify({ format: 1, workspace: owner, files: [...files].sort((a,b) => a.target < b.target ? -1 : a.target > b.target ? 1 : 0) },null,2)}\n`;
}
function consistentPrefixes(targets) {
    const seen=new Map();
    for(const target of targets) {
        const parts=target.split("/").slice(0,-1);
        for(let end=1;end<=parts.length;end++) {
            const prefix=parts.slice(0,end).join("/"),key=samePath(prefix),previous=seen.get(key);
            if(previous!==undefined && previous!==prefix)throw new CompileError(`nested targets have inconsistent case spelling for directory prefix ${prefix}`);
            seen.set(key,prefix);
        }
    }
}
export function validateNestedTargets(targets) {
    const seen=new Set();
    for(const target of targets){nestedTarget(target,"nested declaration");const key=samePath(target);if(seen.has(key))throw new CompileError(`${target}: two units have the same nested target`);seen.add(key);}
    consistentPrefixes(targets);
}
function registryRows(text, owner) {
    let data; try { data=JSON.parse(text); } catch { throw new CompileError("nested ownership registry is malformed"); }
    if(!data || Object.keys(data).sort().join(",")!=="files,format,workspace" || data.format!==1 || data.workspace!==owner || !Array.isArray(data.files) || data.files.length===0) throw new CompileError("nested ownership registry is foreign or malformed");
    const seen=new Set();
    for(const row of data.files) {
        if(!row || Object.keys(row).sort().join(",")!=="pending,sources,target" || typeof row.pending!=="boolean" || !Array.isArray(row.sources) || row.sources.length<1 || row.sources.length>2 || (!row.pending && row.sources.length!==1) || new Set(row.sources).size!==row.sources.length) throw new CompileError("nested ownership registry has malformed records");
        nestedTarget(row.target,"nested ownership registry");const key=samePath(row.target);
        if(seen.has(key)) throw new CompileError("nested ownership registry has duplicate targets");seen.add(key);
        for(const source of row.sources)sourceId(source,owner);
    }
    consistentPrefixes(data.files.map(row=>row.target));
    return data.files;
}
function prepared(root, rel, approve) {
    const parent=path.posix.dirname(rel),base=path.posix.basename(rel);
    try {if(!landing(root,parent,"directory"))return [];}catch{return [];}
    const result=[];
    for(const name of fs.readdirSync(path.join(root,parent))) {
        const type=temporaryKind(name,base);if(!type)continue;
        const file=path.posix.join(parent,name),at=entry(path.join(root,file));
        if(!at?.isFile() || at.isSymbolicLink() || at.nlink!==1)continue;
        let text;try{text=readOutput(path.join(root,file),root);if(type.kind==="claim" && digest(Buffer.from(text))!==type.digest)continue;if(!approve(text))continue;}catch{continue;}
        result.push({file,before:text,next:null,nested:true,claimBase:base,mode:at.mode,claim:type.kind==="claim",beforeIdentity:{dev:at.dev,ino:at.ino,mode:at.mode}});
    }
    return result;
}
export function readNestedState(root, workspace = ".portulan") {
    const owner=ownerAt(root,workspace);
    let present;try{present=fs.lstatSync(path.join(root,NESTED_REGISTRY));}catch(error){if(error.code!=="ENOENT" && error.code!=="ENOTDIR")throw error;}
    const cleanup=prepared(root,NESTED_REGISTRY,text=>sameContent(serialize(owner,registryRows(text,owner)),text));
    const value=present ? landing(root,NESTED_REGISTRY) : null;
    let text=null,files=[],recovery=null;
    if(value) {
        text=readOwnedText(path.join(root,NESTED_REGISTRY),root);files=registryRows(text,owner);
        cleanup.push(...temporaryLinks(root,NESTED_REGISTRY,value).map(file=>({file,before:text,next:null,nested:true,claimBase:path.posix.basename(NESTED_REGISTRY)})));
    } else {
        const candidates=cleanup.filter(edit=>edit.claim);
        if(candidates.length) {
            if(candidates.some(edit=>!sameContent(edit.before,candidates[0].before)))throw new CompileError("interrupted ownership claims disagree; review the retained registry files");
            recovery=candidates[0].before;files=registryRows(recovery,owner);
        }
    }
    const current=new Map();
    for(const row of files) {
        const at=landing(root,row.target);let body=null,source=null;
        const authorized=text=>{const mark=marked(text);return mark && mark.workspace===owner && mark.target===row.target && row.sources.includes(mark.source);};
        if(at) {
            body=readOutput(path.join(root,row.target),root);
            if(!authorized(body))throw new CompileError(`${row.target} has lost its compiler ownership mark; human guidance is preserved`);
            source=marked(body).source;
            for(const file of temporaryLinks(root,row.target,at))cleanup.push({file,before:body,next:null,nested:true,claimBase:path.posix.basename(row.target)});
        }
        const artifacts=prepared(root,row.target,authorized);
        const modes=new Set(artifacts.map(edit=>edit.mode));
        if(!at&&modes.size>1)throw new CompileError(`${row.target}: interrupted permission records disagree; review ${artifacts.map(edit=>edit.file).join(", ")}`);
        cleanup.push(...artifacts);
        current.set(row.target,{text:body,source,mode:at?.mode??artifacts[0]?.mode,evidence:artifacts.map(edit=>edit.file),evidenceSources:[...new Set(artifacts.map(edit=>marked(edit.before).source))]});
    }
    return {owner,text,files,cleanup,current,recovery};
}
function writable(root, rel) {
    const full = path.join(root,rel);
    let parent = path.dirname(full); while (!entry(parent)) parent = path.dirname(parent);
    fs.accessSync(parent,fs.constants.W_OK | fs.constants.X_OK);
}
export function workspaceProtection(root, workspace, manifest) {
    const owner=ownerAt(root,workspace), realRoot=fs.realpathSync(root), base=path.resolve(realRoot,owner);
    if(manifest===undefined) {
        try { manifest=JSON.parse(readOwnedText(path.join(base,"workspace.json"),base)); }
        catch { throw new CompileError("nested ownership cannot inspect its workspace source boundaries"); }
    }
    const found=[];
    for(const value of Object.values(manifest.slots ?? {}).filter(value=>typeof value === "string")) {
        const full=path.resolve(base,value), names=[full];
        try { names.push(fs.realpathSync(full)); } catch(error) { if(error.code!=="ENOENT" && error.code!=="ENOTDIR") throw error; }
        for(const name of names) found.push({path:posix(path.relative(realRoot,name))||".",directory:value.endsWith("/")});
    }
    for(const name of ["compile",".claude"]) found.push({path:posix(path.relative(realRoot,path.join(base,name))),directory:true});
    return found;
}
function reservedTarget(target,protectedPaths) {
    return protectedPaths.some(p=>p.directory ? p.path==="." || samePath(target)===samePath(p.path) || samePath(target).startsWith(`${samePath(p.path)}/`) : samePath(target)===samePath(p.path));
}
export function nestedPlan(root, guidance, files, workspace = ".portulan") {
    const state = readNestedState(root,workspace), desired = files.filter(file => file.nested);
    const deferred=new Set(desired.flatMap(file=>{const observed=state.current.get(file.path);return observed?.text===null?observed.evidence:[];}));
    const early=state.cleanup.filter(edit=>!deferred.has(edit.file)),late=state.cleanup.filter(edit=>deferred.has(edit.file));
    const edits = state.recovery ? [{file:NESTED_REGISTRY,before:null,next:state.recovery,exclusive:true,nested:true,mode:state.cleanup[0]?.mode},...early] : [...early], stale = [], claimed = new Set([NESTED_REGISTRY,...state.cleanup.map(edit => edit.file)]);
    validateNestedTargets(desired.map(file=>file.path));
    if(desired.length || state.files.length)landing(root,NESTED_REGISTRY);
    const protectedPaths = guidance?.protected ?? (state.files.length ? workspaceProtection(root,workspace) : []);
    const reserved=target=>reservedTarget(target,protectedPaths);
    for(const row of state.files) {
        if(reserved(row.target)) throw new CompileError(`${row.target} is now a reserved curated source and cannot be retired`);
        if(desired.some(file=>samePath(file.path)===samePath(row.target) && file.path!==row.target)) throw new CompileError(`${row.target} has an ambiguous case-only target change; retire it before selecting another spelling`);
    }
    for (const file of desired) {
        if ((state.owner !== "." && within(state.owner,file.path)) || reserved(file.path)) throw new CompileError(`${file.path} collides with a reserved workspace/source path`);
        sourceId(file.unit.ownedSource ?? file.unit.source,state.owner);
        landing(root,file.path);
        const observed = state.current.get(file.path);
        if (!observed && entry(path.join(root,file.path))) throw new CompileError(`${file.path} exists without its compiler ownership registry; human guidance is preserved`);
        claimed.add(file.path);
    }
    consistentPrefixes([...state.files.map(row=>row.target),...desired.map(file=>file.path)]);
    const final = desired.map(file => ({ target: file.path, sources: [file.unit.ownedSource ?? file.unit.source], pending: false }));
    const finalText = final.length ? serialize(state.owner,final) : null;
    const control=finalText===null ? null : {path:NESTED_REGISTRY,text:finalText,unit:null,control:true};
    if(state.text===finalText && state.cleanup.length===0 && desired.every(file=>state.current.get(file.path)?.text===file.text)) return {edits:[],claimed,stale:[],control};
    const desiredByPath = new Map(desired.map(file => [file.path,file]));
    const union = [];
    for (const row of state.files) {
        claimed.add(row.target); const now = state.current.get(row.target), wanted = desiredByPath.get(row.target);
        const observedSources=now.text!==null?[now.source]:(wanted?now.evidenceSources:[]);
        if(observedSources.length){const sources=[...new Set([...observedSources,...(wanted?[wanted.unit.ownedSource??wanted.unit.source]:[])])].sort();if(sources.length>2)throw new CompileError(`${row.target}: interrupted source transitions require review before another source can claim the target`);union.push({target:row.target,sources,pending:Boolean(wanted)});}
        if (!wanted && now.text !== null) stale.push({ file: row.target, before: now.text, next: null, nested: true });
    }
    for (const file of desired) {
        const source = file.unit.ownedSource ?? file.unit.source;
        if (!union.some(row => row.target === file.path)) union.push({ target: file.path, sources: [source], pending: true });
    }
    let beforeRegistry = state.recovery ?? state.text;
    if (union.length) {
        const unionText = serialize(state.owner,union);
        if (unionText !== beforeRegistry) { edits.push({ file:NESTED_REGISTRY,before:beforeRegistry,next:unionText,exclusive:beforeRegistry===null,nested:true }); beforeRegistry=unionText; }
    }
    for (const file of desired) {
        const before = state.current.get(file.path)?.text ?? null;
        if (before !== file.text) edits.push({ file:file.path,before,next:file.text,exclusive:before===null,nested:true,mode:state.current.get(file.path)?.mode });
    }
    edits.push(...late,...stale);
    if (finalText !== beforeRegistry) edits.push({ file:NESTED_REGISTRY,before:beforeRegistry,next:finalText,nested:true });
    return { edits, claimed, stale: [...state.cleanup,...stale,...(state.text!==null && !final.length ? [{ file:NESTED_REGISTRY,next:null,nested:true }] : [])], control };
}
function guidanceTemporary(file,base=path.basename(file),hash=null) {
    if(!base || base==="." || base===".." || path.basename(base)!==base || base.includes("\\"))throw new CompileError("invalid temporary-file basename");
    return path.join(path.dirname(file),`.${base}.portulan-guidance${hash?"-claim":""}.${process.pid}.${randomUUID()}${hash?"."+hash:""}`);
}
function rawIdentity(file,identity) {
    const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|fs.constants.O_NONBLOCK);
    try {const at=fs.fstatSync(fd);if(!at.isFile()||!matchesIdentity(at,identity))throw new CompileError(`${file} changed identity before reading`);return fs.readFileSync(fd);}finally{fs.closeSync(fd);}
}
const matchesIdentity=(at,identity)=>!identity || Boolean(at && at.dev===identity.dev && at.ino===identity.ino && (identity.mode===undefined||at.mode===identity.mode) && (identity.nlink===undefined||at.nlink===identity.nlink));
function putClaimBack(claim,file) {
    try{fs.linkSync(claim,file);fs.unlinkSync(claim);}
    catch{throw new CompileError(`${file} changed during publication; conflicting data remains at ${claim}. Review both paths`);}
}
function claimExisting(file,{before,beforeDigest,identity,allowLinks=false,claimBase,onClaim}={}) {
    const at=entry(file);
    if(!at){if(identity||beforeDigest||(before!==undefined && before!==null))throw new CompileError(`${file} changed after guidance planning`);return null;}
    if(!at.isFile() || at.isSymbolicLink() || (!allowLinks&&at.nlink!==1) || !matchesIdentity(at,identity))throw new CompileError(`${file} changed identity or is not an ordinary write target`);
    const expectedIdentity={dev:at.dev,ino:at.ino,nlink:at.nlink,mode:at.mode};
    if(before===null)throw new CompileError(`${file} arrived after guidance planning`);
    const expected=before===undefined?rawIdentity(file,expectedIdentity):before;
    if(beforeDigest && digest(Buffer.from(expected))!==beforeDigest)throw new CompileError(`${file} changed contents after publication`);
    const claim=guidanceTemporary(file,claimBase,digest(Buffer.from(expected)));
    const fd=fs.openSync(claim,"wx",at.mode&0o777),created=fs.fstatSync(fd),placeholder={dev:created.dev,ino:created.ino},expectedBytes=Buffer.from(expected);
    let moved=false,cleared=false,prepared=expectedBytes,preparedMode=created.mode;
    try {
        try{fs.writeFileSync(fd,expected);fs.fchmodSync(fd,at.mode);}catch(error){prepared=expectedBytes.subarray(0,fs.fstatSync(fd).size);throw error;}finally{preparedMode=fs.fstatSync(fd).mode;fs.closeSync(fd);}
        onClaim?.({file,claim,identity:{dev:at.dev,ino:at.ino,mode:at.mode},placeholder:{...placeholder,mode:preparedMode}});
        try{fs.renameSync(file,claim);moved=true;}catch(error){const held=entry(claim);if(held&&!matchesIdentity(held,placeholder)){moved=true;putClaimBack(claim,file);moved=false;cleared=true;}throw error;}
        const held=entry(claim);
        if(!held?.isFile() || !matchesIdentity(held,expectedIdentity) || (!allowLinks&&held.nlink!==1) || !sameContent(rawIdentity(claim,expectedIdentity),expected)) {
            putClaimBack(claim,file);moved=false;cleared=true;
            throw new CompileError(`${file} changed after guidance planning; its current data was preserved`);
        }
        return {file:claim,before:expected,identity:{dev:at.dev,ino:at.ino,mode:at.mode}};
    } finally {if(!moved&&!cleared&&matchesIdentity(entry(claim),placeholder)&&sameContent(rawIdentity(claim,placeholder),prepared))fs.unlinkSync(claim);}
}
export function guardedRemove(file,{before,beforeDigest,identity,allowLinks=false,claimBase,onRemove,onClaim}={}) {
    const claim=claimExisting(file,{before,beforeDigest,identity,allowLinks,claimBase,onClaim});
    if(claim!==null)try{onRemove?.(claim);fs.unlinkSync(claim.file);}catch(error){error.retainedGuidance=[claim];error.message+=`; retained guidance at ${claim.file}`;throw error;}
}
export function atomicWrite(file,text,{exclusive=false,before,beforeDigest,identity,allowLinks=false,mode,write=fs.writeFileSync,stagingPath,onPublish,onPrepare,onClaim,onCleanupClaim}={}) {
    const staging=stagingPath??guidanceTemporary(file),cleanup=[];let made=false,stageIdentity,claim=null,published=false,writeFinished=false;
    try {
        const fd=fs.openSync(staging,"wx",(mode??0o666)&0o7777);made=true;const owned=fs.fstatSync(fd);stageIdentity={dev:owned.dev,ino:owned.ino};
        try {if(write===fs.writeFileSync)write(fd,text);else write(staging,text,{flag:"r+"});writeFinished=true;if(mode!==undefined&&mode!==null)fs.fchmodSync(fd,mode);}finally{stageIdentity.mode=fs.fstatSync(fd).mode;fs.closeSync(fd);}
        if(!matchesIdentity(entry(staging),stageIdentity))throw new CompileError(`${staging} changed during preparation`);
        if(!sameContent(rawIdentity(staging,stageIdentity),text))throw new CompileError(`${staging} has incomplete or changed prepared bytes`);
        onPrepare?.({file,staging,identity:stageIdentity});
        if(!exclusive)claim=claimExisting(file,{before,beforeDigest,identity,allowLinks,onClaim});
        cleanup.push({file:staging,before:text,identity:stageIdentity});if(claim!==null)cleanup.push(claim);
        fs.linkSync(staging,file);published=true;onPublish?.(stageIdentity,cleanup);
        if(claim!==null){fs.unlinkSync(claim.file);claim=null;}
        return stageIdentity;
    } catch(error) {
        if(!published&&stageIdentity&&matchesIdentity(entry(file),stageIdentity)&&sameContent(rawIdentity(file,stageIdentity),text)){published=true;onPublish?.(stageIdentity,cleanup);}
        if(claim!==null && !published) {putClaimBack(claim.file,file);claim=null;}
        throw error;
    } finally {
        if(made && matchesIdentity(entry(staging),stageIdentity))try{guardedRemove(staging,{before:writeFinished?text:rawIdentity(staging,stageIdentity),identity:stageIdentity,allowLinks:true,claimBase:path.basename(file),onClaim:writeFinished?onCleanupClaim:undefined});}catch(error){cleanup.push(...(error.retainedGuidance??[]));throw error;}
    }
}
export function preflightNestedEdits(root, edits) {
    for(const edit of edits)try{const at=landing(root,edit.file);if(edit.beforeIdentity&&!matchesIdentity(at,edit.beforeIdentity))throw new CompileError(`${edit.file} changed identity or mode before publication`);writable(root,edit.file);}catch(error){if(error instanceof CompileError)throw error;throw new CompileError(`${edit.file} cannot be published — ${error.code??error.message}`);}
}
export function applyNestedEdits(root, edits) {
    preflightNestedEdits(root,edits);
    for (const edit of edits) {
        const file=path.join(root,edit.file), at=landing(root,edit.file), current=at ? readOutput(file,root) : null;
        if (!sameContent(current,edit.before)) throw new CompileError(`${edit.file} changed after guidance planning`);
        if (edit.next===null) { if(at)guardedRemove(file,{before:edit.before,identity:edit.beforeIdentity??{dev:at.dev,ino:at.ino,mode:at.mode},allowLinks:Boolean(edit.claimBase),claimBase:edit.claimBase});continue; }
        fs.mkdirSync(path.dirname(file),{recursive:true});
        atomicWrite(file,edit.next,{exclusive:edit.exclusive,before:edit.before,identity:edit.beforeIdentity??(at?{dev:at.dev,ino:at.ino,mode:at.mode}:undefined),mode:at ? at.mode : edit.mode});
    }
}
export function ownedNestedFiles(root, workspace = ".portulan") {
    const state=readNestedState(root,workspace);
    if(state.files.length) {
        const protectedPaths=workspaceProtection(root,workspace);
        for(const row of state.files)if(reservedTarget(row.target,protectedPaths))throw new CompileError(`${row.target} is now a reserved curated source and cannot be excluded from vendor material`);
    }
    return new Set([...state.current].filter(([,value])=>value.text!==null).map(([file])=>file).concat(state.cleanup.map(edit=>edit.file)));
}
