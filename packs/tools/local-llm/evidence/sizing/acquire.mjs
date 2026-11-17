// Manual local sizing acquisition and behavioral controls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { main, localModelFetch, extractFencedCode, readUsage, acquireEndpointLock } from '../../runner/local-llm.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const corpusFile=path.join(here,'fixtures.json'), corpus=JSON.parse(fs.readFileSync(corpusFile));
const self=fileURLToPath(import.meta.url), runner=fileURLToPath(new URL('../../runner/local-llm.mjs',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const lines=text=>text===''?0:(text.endsWith('\n')?text.slice(0,-1):text).split('\n').length;
const quote=text=>`'${text.replaceAll("'", "'\\''")}'`;
const run=(args,options={})=>spawnSync(process.execPath,args,{encoding:'utf8',...options});
function prepare(dir,cell) {
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'cell.json'),JSON.stringify(cell));
    fs.writeFileSync(path.join(dir,'target.mjs'),cell.before);
    fs.writeFileSync(path.join(dir,'before.mjs'),cell.before);
    fs.writeFileSync(path.join(dir,'prompt.txt'),cell.instruction);
    for(const [name,text] of Object.entries(cell.helpers)) fs.writeFileSync(path.join(dir,name),text);
}
function applied(cell,code) {
    const rows=cell.before.replace(/\n$/,'').split('\n');
    if(cell.insertAfter!==undefined) rows.splice(cell.insertAfter,0,'',...code.split('\n'));
    else { const [a,b]=cell.lineRange.split('-').map(Number); rows.splice(a-1,b-a+1,...code.split('\n')); }
    return rows.join('\n')+'\n';
}
async function verify(dir) {
    const cell=JSON.parse(fs.readFileSync(path.join(dir,'cell.json'))), target=path.join(dir,'target.mjs');
    const syntax=run(['--check',target]);
    assert.equal(syntax.status,0,syntax.stderr);
    let count;
    if(cell.requiredTests) {
        const text=fs.readFileSync(target,'utf8');
        assert.ok(text.startsWith(cell.before),'test imports must stay intact');
        assert.ok(!text.includes('PILOT_MUTANT'),'tests must not inspect the fault-injection flag');
        const tokens=new WeakMap(), remaining=cell.expectedAssertions.map(x=>JSON.stringify([x.args,x.expected]));
        let testCount=0, assertions=0;
        const fakeAssert={equal:(actual,expected)=>{
            assert.ok(tokens.has(actual),'actual value must come from clamp');
            const key=JSON.stringify([tokens.get(actual),expected]), at=remaining.indexOf(key);
            assert.ok(at>=0,'unexpected, duplicated or wrong assertion tuple');remaining.splice(at,1);assertions++;
        }};
        new vm.Script(text.slice(cell.before.length)).runInNewContext({
            clamp:(...args)=>{const token=Object.freeze({});tokens.set(token,args);return token;},
            assert:fakeAssert,test:(_name,fn)=>{const start=assertions;assert.equal(fn(),undefined,'fixture tests are synchronous');assert.equal(assertions-start,2,'two required assertions per test');testCount++;},
        },{timeout:1000});
        assert.equal(testCount,cell.requiredTests);assert.equal(remaining.length,0,'all required assertion tuples must be exercised');
        const actual=run(['--test',target],{cwd:dir,env:{...process.env,PILOT_MUTANT:'0'}});
        assert.equal(actual.status,0,actual.stdout+actual.stderr);
        const match=/^# tests (\d+)$/m.exec(actual.stdout)??/^ℹ tests (\d+)$/m.exec(actual.stdout);
        assert.ok(match,'test reporter must give its executed test count'); count=Number(match[1]);
        assert.equal(count,cell.requiredTests,'no missing or extra test cases');
        const mutant=run(['--test',target],{cwd:dir,env:{...process.env,PILOT_MUTANT:'1'}});
        assert.equal(mutant.status,1,'tests must reject the wrong helper');
    } else {
        const module=await import(pathToFileURL(target).href);
        const fn=module[cell.exportName]; assert.equal(typeof fn,'function');
        assert.ok(cell.checks.length>=5,'behavior corpus cannot be empty');
        for(const check of cell.checks) {
            if(check.throws) assert.throws(()=>fn(...check.args),error=>error.name===check.throws);
            else assert.deepEqual(fn(...check.args),check.expected);
        }
        count=cell.checks.length;
    }
    console.log(`VERIFIED ${cell.id} checks=${count}`);
}
function selfCheck() {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'portulan-sizing-controls-')), results=[];
    try {
        for(const cell of corpus.cells) {
            const target=path.join(dir,cell.id); prepare(target,cell);
            const check=()=>run([self,'--verify-fixture',target]);
            assert.equal(check().status,1,`${cell.id} baseline must fail`);
            fs.writeFileSync(path.join(target,'target.mjs'),applied(cell,cell.expectedSource));
            const good=check(); assert.equal(good.status,0,`${cell.id}: ${good.stderr}`);
            fs.writeFileSync(path.join(target,'target.mjs'),applied(cell,cell.badSource));
            assert.equal(check().status,1,`${cell.id} incorrect/vacuous implementation must fail`);
            for(const negative of cell.negativeSources??[]) {
                fs.writeFileSync(path.join(target,'target.mjs'),applied(cell,negative.source));
                assert.equal(check().status,1,`${cell.id} ${negative.name} must fail`);
            }
            results.push({id:cell.id,baseline:1,intended:0,incorrect:1,additionalNegativeControls:(cell.negativeSources??[]).map(n=>n.name)});
        }
        return results;
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
function argsFor(cell,dir) {
    const p=corpus.profile, target=path.join(dir,'target.mjs');
    return ['transform','--role',p.role,'--effort',p.effort,'--max-tokens',String(p.maxTokens),'--retries',String(p.retries),'--base-url',p.baseUrl,
        '--file',target,...(cell.insertAfter!==undefined?['--insert-after',String(cell.insertAfter)]:['--lines',cell.lineRange]),
        ...Object.keys(cell.helpers).flatMap(name=>['--context-file',path.join(dir,name)]),
        '--prompt-file',path.join(dir,'prompt.txt'),'--preflight','--precheck',`${quote(process.execPath)} --check ${quote(target)}`,
        '--verify',`${quote(process.execPath)} ${quote(self)} --verify-fixture ${quote(dir)}`,'--verify-expect',`^VERIFIED ${cell.id} checks=`, '--progress'];
}
async function child(dir) {
    const cell=JSON.parse(fs.readFileSync(path.join(dir,'cell.json')));
    const queued=new AbortController(), start=performance.now(), signals=['SIGINT','SIGTERM','SIGHUP'];
    const cancelQueue=()=>queued.abort();for(const signal of signals)process.on(signal,cancelQueue);
    let lock;
    try {
        lock=await acquireEndpointLock(corpus.profile.baseUrl,{signal:queued.signal});
        if(queued.signal.aborted) {lock.release();throw Error('cancelled while queued');}
        fs.writeFileSync(path.join(dir,'lock.json'),JSON.stringify({status:'acquired',queuedMs:lock.queuedMs}));
    } catch(error) {
        if(!queued.signal.aborted)throw error;
        fs.writeFileSync(path.join(dir,'lock.json'),JSON.stringify({status:'cancelled',elapsedMs:Math.round(performance.now()-start)}));process.exitCode=2;return;
    } finally {for(const signal of signals)process.off(signal,cancelQueue);}
    const recordingFetch=async(url,options)=>{
        fs.writeFileSync(path.join(dir,'request.json'),options.body,{flag:'wx',mode:0o600});
        const response=await localModelFetch(url,options);
        fs.writeFileSync(path.join(dir,'response.json'),await response.text(),{flag:'wx',mode:0o600});
        return response;
    };
    try {process.exitCode=await main(argsFor(cell,dir),{fetchImpl:recordingFetch});}
    finally {lock.release();}
}
function launch(dir) {
    return new Promise((resolve,reject)=>{
        const started=performance.now(), out=fs.openSync(path.join(dir,'stdout.log'),'wx',0o600), err=fs.openSync(path.join(dir,'stderr.log'),'wx',0o600);
        const processChild=spawn(process.execPath,[self,'--child',dir],{cwd:dir,env:{...process.env,PORTULAN_LOCAL_LLM_STATE_DIR:path.join(dir,'state')},stdio:['ignore',out,err]});
        let cancelled=false, hardKill;
        const timeout=setTimeout(()=>{cancelled=true;processChild.kill('SIGTERM');hardKill=setTimeout(()=>processChild.kill('SIGKILL'),5000);},corpus.profile.cancelAfterMs);
        const heartbeat=setInterval(()=>console.log(`${path.basename(dir)} waiting; wall=${Math.round(performance.now()-started)}ms`),30000);
        processChild.once('error',reject);
        processChild.once('close',(code,signal)=>{clearTimeout(timeout);clearTimeout(hardKill);clearInterval(heartbeat);fs.closeSync(out);fs.closeSync(err);resolve({code,signal,cancelled,wallMs:Math.round(performance.now()-started)});});
    });
}
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
function lifecycle(dir) {
    const found=[];
    const walk=folder=>{if(!fs.existsSync(folder))return;for(const item of fs.readdirSync(folder,{withFileTypes:true})){const f=path.join(folder,item.name);if(item.isDirectory())walk(f);else if(item.name.endsWith('.json')){const r=readJson(f);if(r?.requestId)found.push(r);}}};
    walk(path.join(dir,'state'));return found.sort((a,b)=>(b.elapsedMs??0)-(a.elapsedMs??0))[0]??null;
}
function result(cell,dir,execution) {
    const request=readJson(path.join(dir,'request.json')), response=readJson(path.join(dir,'response.json')), rec=lifecycle(dir);
    const stdout=fs.readFileSync(path.join(dir,'stdout.log'),'utf8'), stderr=fs.readFileSync(path.join(dir,'stderr.log'),'utf8');
    const usage=readUsage(response?.usage);
    const normalized={input:usage.promptTokens,output:usage.completionTokens,reasoning:usage.reasoningTokens,cached:usage.cachedPromptTokens};
    const finish=response?.choices?.[0]?.finish_reason??null;
    let emitted=null;try{if(finish!=='length')emitted=extractFencedCode(response.choices[0].message.content).replace(/\n$/,'');}catch{}
    const after=fs.readFileSync(path.join(dir,'target.mjs'),'utf8');
    const diff=spawnSync('git',['diff','--no-index','--numstat','before.mjs','target.mjs'],{cwd:dir,encoding:'utf8'});
    assert.ok([0,1].includes(diff.status),'source delta must be measurable');
    const changed=/^(\d+)\t(\d+)\t/m.exec(diff.stdout);
    const keep=execution.code===0;
    const reportedRefusal=Boolean(response?.choices?.[0]?.message?.refusal);
    const outcome=execution.cancelled?'cancelled':reportedRefusal?'model-refusal':keep?'verified':finish==='length'?'incomplete-length':rec?.reason?.startsWith('red_')?'verifier-red':response?.choices?'refused':'could-not-run';
    if(request) {
        assert.equal(request.model,corpus.profile.model);assert.equal(request.reasoning_effort,corpus.profile.effort);
        assert.equal(request.chat_template_kwargs?.enable_thinking,false);assert.equal(request.max_tokens,corpus.profile.maxTokens);
    }
    const helpersIntact=Object.entries(cell.helpers).every(([f,text])=>fs.readFileSync(path.join(dir,f),'utf8')===text);
    const scopeRows=cell.before.replace(/\n$/,'').split('\n');
    const [a,b]=cell.insertAfter!==undefined?[cell.insertAfter+1,cell.insertAfter]:cell.lineRange.split('-').map(Number);
    const prefix=scopeRows.slice(0,a-1).join('\n'), suffix=scopeRows.slice(b).join('\n');
    const scopeIntact=after.startsWith(prefix)&&after.trimEnd().endsWith(suffix.trimEnd());
    assert.ok(helpersIntact&&scopeIntact,'input scope must remain intact');
    if(!keep) assert.equal(after,cell.before,'failed/cancelled target must roll back');
    return {id:cell.id,shape:cell.shape,requestedGeneratedLines:cell.requestedGeneratedLines,
        selectedTargetLines:cell.insertAfter!==undefined?0:b-a+1,anchorLines:cell.insertAfter!==undefined?lines(cell.before):0,
        helperLines:Object.fromEntries(Object.entries(cell.helpers).map(([f,s])=>[f,lines(s)])),
        outcome,...execution,requestId:rec?.requestId??null,providerResponseId:response?.id??null,attempts:rec?.attempt??null,
        reportedRefusal,terminalReason:rec?.reason??null,kept:keep,endpointLock:readJson(path.join(dir,'lock.json')),
        requested:request?{model:request.model,effort:request.reasoning_effort,enableThinking:request.chat_template_kwargs?.enable_thinking,maxTokens:request.max_tokens}:null,
        finishReason:finish,usage:normalized,modelMs:/\btime=(\d+)ms/.test(stdout)?Number(/\btime=(\d+)ms/.exec(stdout)[1]):null,
        emittedCodeLines:emitted===null?null:lines(emitted),addedSourceLines:changed?Number(changed[1]):0,removedSourceLines:changed?Number(changed[2]):0,
        rollback:keep?'not-applicable':'restored',providerCancellation:rec?.providerCancellation??'unknown',helpersIntact,scopeIntact,
        beforeSha256:hash(cell.before),afterSha256:hash(after),responseSha256:fs.existsSync(path.join(dir,'response.json'))?hash(fs.readFileSync(path.join(dir,'response.json'))):null,
        receipt:stdout.split('\n').find(s=>s.startsWith('OK '))??stderr.split('\n').find(s=>s.startsWith('CANCELLED '))??null,
        acceptedSource:keep?after:null,emittedSource:keep?emitted:null};
}
async function acquire(outputDir) {
    const controls=selfCheck();fs.mkdirSync(outputDir,{mode:0o700});
    const metadata=await fetch('http://127.0.0.1:1234/api/v1/models',{signal:AbortSignal.timeout(4000)}).then(r=>r.json());
    const model=metadata.models.find(m=>m.key===corpus.profile.model);assert.ok(model,'pinned model must be listed');
    const runtime=Object.fromEntries(['key','publisher','architecture','format','quantization','size_bytes','params_string'].map(k=>[k,model[k]??null]));
    const capture={schema:1,startedAt:new Date().toISOString(),parentCommit:spawnSync('git',['rev-parse','HEAD'],{cwd:here,encoding:'utf8'}).stdout.trim(),
        sourceSha256:{runner:hash(fs.readFileSync(runner)),protocol:hash(fs.readFileSync(self)),fixtures:hash(fs.readFileSync(corpusFile)),protocolNotes:hash(fs.readFileSync(path.join(here,'README.md')))},
        instrumentation:{transport:'production localModelFetch with private buffered-body recording',endpointLock:'production acquireEndpointLock held around the entire child command; injected fetch does not take another lock',queue:'manual wait recorded separately; native CLI queue telemetry is not claimed'},
        profile:corpus.profile,stoppingRule:corpus.stoppingRule,runtime:{reportedModel:runtime,reportedMetadataSha256:hash(JSON.stringify(runtime)),loadedInstancesBefore:model.loaded_instances.length,
            activeTemplateSha256:null,templateLimit:'The local API does not expose the active template bytes; no loaded-template/weight attestation.',repairReport:'https://github.com/sleepy-panda-srl/portulan/issues/571#issuecomment-6945668358'},
        machine:{cpu:os.cpus()[0]?.model??null,memoryBytes:os.totalmem(),platform:os.platform(),release:os.release(),arch:os.arch(),node:process.version},controls,cells:[]};
    fs.writeFileSync(path.join(outputDir,'preregistered.json'),JSON.stringify(capture,null,2)+'\n',{flag:'wx',mode:0o600});
    let stopped=false;
    for(const cell of corpus.cells) {
        if(stopped) {capture.cells.push({id:cell.id,outcome:'not-run',reason:'prior cancellation or unavailable call'});continue;}
        assert.equal(hash(fs.readFileSync(self)),capture.sourceSha256.protocol,'protocol changed during acquisition');
        assert.equal(hash(fs.readFileSync(corpusFile)),capture.sourceSha256.fixtures,'corpus changed during acquisition');
        assert.equal(hash(fs.readFileSync(runner)),capture.sourceSha256.runner,'runner changed during acquisition');
        assert.equal(hash(fs.readFileSync(path.join(here,'README.md'))),capture.sourceSha256.protocolNotes,'protocol notes changed during acquisition');
        const dir=path.join(outputDir,cell.id);prepare(dir,cell);console.log(`Starting ${cell.id}`);
        const execution=await launch(dir), record=result(cell,dir,execution);capture.cells.push(record);
        console.log(`${cell.id}: ${record.outcome}; output=${record.usage.output??'?'} reasoning=${record.usage.reasoning??'?'} emittedLines=${record.emittedCodeLines??'?'}`);
        fs.writeFileSync(path.join(outputDir,`${cell.id}.record.json`),JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
        stopped=['cancelled','could-not-run'].includes(record.outcome);
    }
    capture.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(outputDir,'capture.json'),JSON.stringify(capture,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('Capture complete; review synthetic accepted source before publishing capture.json.');
}
const [mode,dir]=process.argv.slice(2);
if(mode==='--verify-fixture'&&dir) await verify(dir).catch(error=>{console.error(error.message);process.exitCode=1;});
else if(mode==='--self-check') console.log(JSON.stringify(selfCheck(),null,2));
else if(mode==='--child'&&dir) await child(dir);
else if(mode==='--acquire'&&dir&&path.isAbsolute(dir)) await acquire(dir);
else {console.error('Manual protocol: --self-check | --acquire <new absolute private directory>');process.exitCode=2;}
