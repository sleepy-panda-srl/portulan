// Offline sizing controls and evidence replay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const evidence=process.env.PORTULAN_SIZING_EVIDENCE??path.join(root,'packs/tools/local-llm/evidence/sizing');
const read=file=>JSON.parse(fs.readFileSync(path.join(evidence,file)));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const lines=text=>text===''?0:(text.endsWith('\n')?text.slice(0,-1):text).split('\n').length;
const sources=[['capture.json','fixtures.json','README.md'],['diagnostic-capture.json','diagnostic-fixtures.json','diagnostic-protocol.md']];
const script=path.join(evidence,'acquire.mjs');
const childEnv={...process.env};
delete childEnv.NODE_TEST_CONTEXT;
test('sizing controls accept intended code and reject wrong or vacuous implementations without inference',()=>{
    const result=spawnSync(process.execPath,[script,'--self-check'],{encoding:'utf8',env:childEnv});
    assert.equal(result.status,0,result.stderr);
    const controls=JSON.parse(result.stdout);assert.equal(controls.length,6);
    for(const c of controls){assert.equal(c.baseline,1);assert.equal(c.intended,0);assert.equal(c.incorrect,1);}
    for(const c of controls.filter(x=>x.id.startsWith('insert-'))) assert.equal(c.additionalNegativeControls.length,5);
});
test('published sizing captures bind the frozen sources, profile and line/usage measurements',()=>{
    for(const [captureFile,corpusFile,notes]of sources){
        const capture=read(captureFile),corpus=read(corpusFile);
        const ran=spawnSync('git',['show',`${capture.parentCommit}:packs/tools/local-llm/runner/local-llm.mjs`],{cwd:root,maxBuffer:16*1024*1024});
        assert.equal(ran.status,0,`the capture's parent commit ${capture.parentCommit} is not in this clone's history`);
        assert.equal(capture.sourceSha256.runner,createHash('sha256').update(ran.stdout).digest('hex'));
        assert.equal(capture.sourceSha256.protocol,hash(script));assert.equal(capture.sourceSha256.fixtures,hash(path.join(evidence,corpusFile)));
        assert.equal(capture.sourceSha256.protocolNotes,hash(path.join(evidence,notes)));
        assert.deepEqual(capture.profile,corpus.profile);assert.equal(capture.cells.length,corpus.cells.length);
        for(const c of capture.cells){
            const f=corpus.cells.find(x=>x.id===c.id);assert.ok(f);
            const selected=f.lineRange?f.lineRange.split('-').map(Number):null;
            assert.equal(c.selectedTargetLines,selected?selected[1]-selected[0]+1:0);
            assert.equal(c.anchorLines,f.insertAfter===undefined?0:lines(f.before));
            assert.deepEqual(c.helperLines,Object.fromEntries(Object.entries(f.helpers).map(([name,text])=>[name,lines(text)])));
            assert.equal(c.attempts,1);assert.ok(c.requestId);assert.equal(c.requested.model,corpus.profile.model);
            assert.equal(c.requested.effort,'low');assert.equal(c.requested.enableThinking,false);assert.equal(c.requested.maxTokens,4096);
            for(const v of Object.values(c.usage)) assert.ok(v===null||Number.isSafeInteger(v)&&v>=0);
            for(const [subset,parent]of [['reasoning','output'],['cached','input']]) if(c.usage[subset]!==null)assert.ok(c.usage[parent]!==null&&c.usage[subset]<=c.usage[parent],`${subset} must be a reported subset`);
            assert.ok(c.wallMs>=0);assert.ok(c.modelMs===null||c.modelMs>=0);
            assert.equal(c.beforeSha256,createHash('sha256').update(f.before).digest('hex'));
            assert.equal(c.helpersIntact,true);assert.equal(c.scopeIntact,true);
            if(c.kept){
                assert.equal(c.outcome,'verified');assert.equal(c.emittedCodeLines,lines(c.emittedSource));
                assert.equal(c.afterSha256,createHash('sha256').update(c.acceptedSource).digest('hex'));
                const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sizing-delta-'));
                try{fs.writeFileSync(path.join(dir,'before'),f.before);fs.writeFileSync(path.join(dir,'after'),c.acceptedSource);
                    const diff=spawnSync('git',['diff','--no-index','--numstat','before','after'],{cwd:dir,encoding:'utf8'});assert.ok([0,1].includes(diff.status));
                    const match=/^(\d+)\t(\d+)\t/.exec(diff.stdout);assert.equal(c.addedSourceLines,match?Number(match[1]):0);assert.equal(c.removedSourceLines,match?Number(match[2]):0);
                }finally{fs.rmSync(dir,{recursive:true,force:true});}
            }else{assert.equal(c.acceptedSource,null);assert.equal(c.afterSha256,c.beforeSha256);assert.equal(c.rollback,'restored');assert.equal(c.addedSourceLines,0);}
        }
    }
    const assessment=read('parent-assessment.json');assert.equal(assessment.captureSha256,hash(path.join(evidence,'capture.json')));
});
test('every fixture-verified published artifact replays its behavioral verifier without a model',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sizing-replay-'));
    try{
        for(const [captureFile,corpusFile]of sources){const capture=read(captureFile),corpus=read(corpusFile);
            for(const c of capture.cells.filter(x=>x.kept)){const f=corpus.cells.find(x=>x.id===c.id),caseDir=path.join(dir,captureFile,c.id);fs.mkdirSync(caseDir,{recursive:true});
                fs.writeFileSync(path.join(caseDir,'cell.json'),JSON.stringify(f));fs.writeFileSync(path.join(caseDir,'target.mjs'),c.acceptedSource);
                for(const [name,text]of Object.entries(f.helpers))fs.writeFileSync(path.join(caseDir,name),text);
                const result=spawnSync(process.execPath,[script,'--verify-fixture',caseDir],{encoding:'utf8',env:childEnv});
                assert.equal(result.status,0,`${c.id}: ${result.stderr}`);assert.match(result.stdout,new RegExp(`^VERIFIED ${c.id} checks=`));
            }
        }
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('post-hoc parent rejection is reproducible from the retained synthetic artifact',async()=>{
    const c=read('capture.json').cells.find(x=>x.id==='context-large'),f=read('fixtures.json').cells.find(x=>x.id===c.id);
    const assessment=read('parent-assessment.json').contextLarge;assert.equal(assessment.decision,'parent-rejected');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sizing-parent-'));
    try{fs.writeFileSync(path.join(dir,'target.mjs'),c.acceptedSource);for(const [name,text]of Object.entries(f.helpers))fs.writeFileSync(path.join(dir,name),text);
        const module=await import(pathToFileURL(path.join(dir,'target.mjs')).href);
        for(const check of assessment.counterexamples){const actual=module.summarize(...check.input);assert.deepEqual(actual,check.actual);assert.notDeepEqual(actual,check.expected);assert.equal(check.passes,false);}
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
