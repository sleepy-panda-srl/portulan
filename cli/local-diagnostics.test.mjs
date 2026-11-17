// Local runner budgets, diagnostics and verification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {callLocalChat, FEEDBACK_CHARS, formatPassReceipt, main, runVerify, verifyGatedTransform} from '../packs/tools/local-llm/runner/local-llm.mjs';
import {receiptOf} from './ledger.mjs';

const complete = {choices:[{finish_reason:'stop',message:{content:'const value = 2;'}}],usage:{prompt_tokens:4,completion_tokens:5}};
const responding = data => async () => ({ok:true,json:async()=>data});
const temporary = t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'local-diagnostics-'));
    t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    return dir;
};
async function capture(fn) {
    const out=[],err=[],log=console.log,error=console.error;
    console.log=(...args)=>out.push(args.join(' '));
    console.error=(...args)=>err.push(args.join(' '));
    try { return {code:await fn(),out,err}; }
    finally {console.log=log;console.error=error;}
}

test('length preserves the raw response privately with request metadata and restores the target',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs'),before=Buffer.from('const value = 1;\r\n');
    fs.writeFileSync(file,before);
    const data={choices:[{finish_reason:'length',message:{content:'PARTIAL',reasoning_content:'RETURNED_REASONING'}}],usage:{prompt_tokens:4,completion_tokens:8192,completion_tokens_details:{reasoning_tokens:8192}}};
    const app=http.createServer((req,res)=>res.end(JSON.stringify(data)));
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
    t.after(()=>{app.closeAllConnections();app.close();});
    let verified=0;
    await assert.rejects(verifyGatedTransform({filePath:file,instruction:'SECRET_PROMPT',verifyCmd:'fixture',maxTokens:8192,
        requestId:'diagnostic-request',stateDir:dir,
        chatFn:options=>callLocalChat({...options,baseUrl:`http://127.0.0.1:${app.address().port}/v1`}),
        execFn:async()=>{verified++;return {status:0};},
    }),error=>{
        assert.ok(error.diagnosticPath,'the diagnostic is available to API callers');
        t.after(()=>fs.rmSync(path.dirname(error.diagnosticPath),{recursive:true,force:true}));
        assert.ok(error.message.includes(error.diagnosticPath));
        assert.match(error.message,/8192t/);
        const saved=JSON.parse(fs.readFileSync(error.diagnosticPath,'utf8'));
        assert.deepEqual(saved.response,data);
        assert.equal(saved.requestId,'diagnostic-request');
        assert.equal(saved.maxTokens,8192);
        assert.ok(saved.model);
        assert.doesNotMatch(JSON.stringify(saved),/SECRET_PROMPT/);
        assert.equal(fs.statSync(error.diagnosticPath).mode&0o777,0o600);
        assert.equal(fs.statSync(path.dirname(error.diagnosticPath)).mode&0o777,0o700);
        return true;
    });
    assert.equal(verified,0);
    assert.deepEqual(fs.readFileSync(file),before);
    const records=fs.readdirSync(path.join(dir,'portulan-local-llm-lifecycle')).map(name=>fs.readFileSync(path.join(dir,'portulan-local-llm-lifecycle',name),'utf8'));
    assert.doesNotMatch(records.join(''),/PARTIAL|RETURNED_REASONING|SECRET_PROMPT/);
});

test('CLI prints the length artifact path while leaving stdout empty',async t=>{
    const result=await capture(()=>main(['chat','--model','fixture','--prompt','source'],{fetchImpl:responding({choices:[{finish_reason:'length',message:{content:'PARTIAL'}}]})}));
    assert.equal(result.code,2);
    assert.deepEqual(result.out,[]);
    const match=/Saved incomplete response to (.+\.json)/.exec(result.err.join('\n'));
    assert.ok(match,result.err.join('\n'));
    t.after(()=>fs.rmSync(path.dirname(match[1]),{recursive:true,force:true}));
    assert.equal(JSON.parse(fs.readFileSync(match[1],'utf8')).response.choices[0].message.content,'PARTIAL');
    assert.doesNotMatch(result.err.join('\n'),/PARTIAL/);
});

test('artifact write failure still refuses incomplete output without a replacement or verifier',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs');fs.writeFileSync(file,'original\n');
    const mkdtemp=fs.mkdtempSync;
    fs.mkdtempSync=()=>{throw new Error('fixture disk failure');};
    let verified=0;
    try {
        await assert.rejects(verifyGatedTransform({filePath:file,instruction:'change',verifyCmd:'fixture',trackLifecycle:false,
            chatFn:options=>callLocalChat({...options,trackLifecycle:false,fetchImpl:responding({choices:[{finish_reason:'length',message:{content:'partial'}}]})}),
            execFn:()=>{verified++;return {status:0};},
        }),/generation incomplete.*could not save/is);
    } finally {fs.mkdtempSync=mkdtemp;}
    assert.equal(verified,0);assert.equal(fs.readFileSync(file,'utf8'),'original\n');
});

test('max-tokens reaches each prompt mode and its receipt without changing ledger totals',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs');fs.writeFileSync(file,'const value = 1;\n');
    for(const cmd of ['chat','summarize','transform']){
        const bodies=[];
        const args=[cmd,'--model','fixture','--prompt','change','--max-tokens','8192'];
        if(cmd==='transform')args.push('--file',file,'--verify','true');
        const result=await capture(()=>main(args,{fetchImpl:async(_url,init)=>{bodies.push(JSON.parse(init.body));return responding(complete)();}}));
        assert.equal(result.code,0,result.err.join('\n'));
        assert.equal(bodies[0].max_tokens,8192);
        const receipt=[...result.out,...result.err].find(line=>line.startsWith('OK '));
        assert.match(receipt,/ max-tokens=8192 /);
        assert.deepEqual(receiptOf(receipt),receiptOf(receipt.replace(' max-tokens=8192','')));
        assert.ok(receiptOf(receipt),'new receipts remain visible to the ledger');
        assert.equal(receiptOf(receipt.replace('max-tokens=8192','max-tokens=9007199254740992')),null);
        assert.equal(receiptOf(receipt.replace('max-tokens=8192','max-tokens=0')),null);
    }
    const direct=await callLocalChat({messages:[],maxTokens:128,fetchImpl:responding(complete)});
    assert.match(formatPassReceipt({mode:'chat',model:'fixture',...direct}),/ max-tokens=128 /);
});

test('invalid output budgets and flags outside prompt modes refuse before transport',async()=>{
    let calls=0;
    const fetchImpl=async()=>{calls++;return responding(complete)();};
    for(const value of ['0','-1','1.5','Infinity','9007199254740992','wrong']){
        assert.equal((await capture(()=>main(['chat','--prompt','change','--max-tokens',value],{fetchImpl}))).code,2,value);
        await assert.rejects(callLocalChat({messages:[],maxTokens:Number(value),fetchImpl}),/max.tokens/i);
        await assert.rejects(verifyGatedTransform({filePath:'unread',verifyCmd:'fixture',maxTokens:Number(value),chatFn:fetchImpl}),/max.tokens/i);
    }
    for(const cmd of ['status','lifecycle','dedup','eval'])for(const flags of [['--max-tokens','8192'],['--progress']]){
        assert.equal((await capture(()=>main([cmd,...flags],{fetchImpl}))).code,2,`${cmd} ${flags}`);
    }
    assert.equal(calls,0);
});

test('transform receipts preserve stricter wrapper budgets and mark varying retry budgets unknown',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs');fs.writeFileSync(file,'const value = 1;\n');
    for(const budgets of [[128],[128,256]]){
        let attempt=0;
        const sent=[];
        const result=await verifyGatedTransform({filePath:file,instruction:'change',verifyCmd:'fixture',maxTokens:8192,
            chatFn:options=>callLocalChat({...options,maxTokens:budgets[attempt++],fetchImpl:async(_url,init)=>{sent.push(JSON.parse(init.body).max_tokens);return responding(complete)();}}),
            execFn:async()=>({status:attempt===budgets.length?0:1}),
        });
        assert.deepEqual(sent,budgets);
        assert.ok(result.ok);
        assert.ok(result.receipt.includes(` max-tokens=${budgets.length===1?'128':'?'} `));
        assert.ok(receiptOf(result.receipt));
    }
});

test('progress is visible while a fixture server is still holding its response',async t=>{
    t.mock.timers.enable({apis:['setInterval']});
    let received;
    const waiting=new Promise(resolve=>received=resolve);
    const app=http.createServer((_req,res)=>received(res));
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
    t.after(()=>{app.closeAllConnections();app.close();});
    const lines=[];
    const pending=callLocalChat({baseUrl:`http://127.0.0.1:${app.address().port}/v1`,messages:[],progress:true,onProgress:line=>lines.push(line)});
    const response=await waiting;
    const count=lines.length;t.mock.timers.tick(10000);
    assert.ok(lines.length>count,'a heartbeat arrived before the server completed');
    assert.match(lines.at(-1),/phase=generation.*tokens=\?/);
    response.end(JSON.stringify(complete));await pending;
    const finished=lines.length;t.mock.timers.tick(10000);assert.equal(lines.length,finished);
});

test('progress reports a slow generation before completion and cleans up on every outcome',async t=>{
    t.mock.timers.enable({apis:['setInterval']});
    for(const outcome of ['success','failure','abort']){
        const lines=[],controller=new AbortController();
        let resolve,reject;
        const fetchImpl=async(_url,init)=>new Promise((res,rej)=>{
            resolve=res;reject=rej;
            init.signal?.addEventListener('abort',()=>rej(new Error('fixture abort')),{once:true});
        });
        const pending=callLocalChat({messages:[],progress:true,onProgress:line=>lines.push(line),signal:controller.signal,fetchImpl,trackLifecycle:false});
        await Promise.resolve();
        t.mock.timers.tick(20000);
        assert.ok(lines.length>=2);
        assert.ok(lines.some(line=>/phase=generation/.test(line)));
        assert.ok(lines.every(line=>/tokens=\?/.test(line)));
        if(outcome==='success'){resolve(await responding(complete)());await pending;}
        else {const rejected=assert.rejects(pending);if(outcome==='abort')controller.abort();else reject(new Error('fixture transport failure'));await rejected;}
        const count=lines.length;t.mock.timers.tick(30000);assert.equal(lines.length,count,'timer stopped');
    }
});

test('progress includes queued time, shared transform request identity, and stays opt-in',async t=>{
    t.mock.timers.enable({apis:['setInterval']});
    const dir=temporary(t),file=path.join(dir,'target.mjs');fs.writeFileSync(file,'const value = 1;\n');
    const lines=[];
    await verifyGatedTransform({filePath:file,instruction:'change',verifyCmd:'fixture',requestId:'shared-request',stateDir:dir,progress:true,
        chatFn:options=>callLocalChat({...options,onProgress:line=>lines.push(line),fetchImpl:responding(complete)}),execFn:async()=>({status:0}),
    });
    assert.ok(lines.some(line=>/request=shared-request phase=queued/.test(line)));
    assert.ok(lines.some(line=>/request=shared-request phase=generation/.test(line)));
    const count=lines.length;t.mock.timers.tick(30000);assert.equal(lines.length,count);
    await callLocalChat({messages:[],onProgress:line=>lines.push(line),fetchImpl:responding(complete)});
    assert.equal(lines.length,count,'no progress without opt-in');
    for(const cmd of ['chat','summarize']){
        const result=await capture(()=>main([cmd,'--model','fixture','--prompt','source','--progress'],{fetchImpl:responding(complete)}));
        assert.equal(result.code,0);
        assert.ok(result.err.some(line=>/phase=generation/.test(line)));
        assert.equal(result.out.length,1,'stdout contains only the answer');
    }
});

test('retry feedback: every bounded failure matches what the following model attempt sees',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs');fs.writeFileSync(file,'original\n');
    const messages=[];
    let checks=0;
    const result=await verifyGatedTransform({filePath:file,instruction:'change',verifyCmd:'fixture',verifyExpect:'PASSED',retries:2,
        chatFn:async options=>{messages.push(options.messages[1].content);return {content:'replacement'};},
        execFn:async()=>++checks===1?{status:1,stdout:'x'.repeat(3000),stderr:'style rule failed'}:checks===2?{status:0,stdout:'no matching tests'}:{status:0,stdout:'PASSED'},
    });
    assert.equal(result.ok,true);
    assert.equal(result.retryFailures.length,2);
    for(const [index,failure] of result.retryFailures.entries()){
        assert.equal(failure.attempt,index+1);assert.equal(failure.phase,'verification');
        assert.ok(failure.feedback.length<=FEEDBACK_CHARS+1);
        assert.ok(messages[index+1].includes(failure.feedback));
    }
    assert.match(result.retryFailures[0].feedback,/style rule failed/);
    assert.match(result.retryFailures[1].feedback,/without matching --verify-expect/);
});

test('retry feedback: successful CLI stdout stays one receipt and stderr exposes every earlier tail',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs'),checker=path.join(dir,'check.cjs');
    fs.writeFileSync(file,'original\n');
    fs.writeFileSync(checker,"const fs=require('node:fs');const value=fs.readFileSync(process.argv[2],'utf8').trim();if(value==='green'){process.exit(0);}console.error('bad candidate: '+value);process.exit(1);\n");
    const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
    const args=['transform','--model','fixture','--file',file,'--prompt','change','--verify',`${quote(process.execPath)} ${quote(checker)} ${quote(file)}`];
    let attempt=0;
    const result=await capture(()=>main(args,{fetchImpl:async()=>responding({choices:[{finish_reason:'stop',message:{content:++attempt<3?`red${attempt}`:'green'}}]})()}));
    assert.equal(result.code,0);
    assert.equal(result.out.length,1);assert.match(result.out[0],/^OK .*attempts=3 /);
    assert.equal(result.err.length,2);
    assert.match(result.err[0],/attempt=1 phase=verification[\s\S]*bad candidate: red1/);
    assert.match(result.err[1],/attempt=2 phase=verification[\s\S]*bad candidate: red2/);
    const firstGreen=await capture(()=>main(args,{fetchImpl:responding({choices:[{finish_reason:'stop',message:{content:'green'}}]})}));
    assert.equal(firstGreen.code,0);assert.equal(firstGreen.out.length,1);assert.deepEqual(firstGreen.err,[]);
});

test('retry feedback: a silent red verifier still supplies a bounded diagnostic',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs');fs.writeFileSync(file,'original\n');
    let checks=0;
    const result=await verifyGatedTransform({filePath:file,instruction:'change',verifyCmd:'fixture',
        chatFn:async()=>({content:'replacement'}),execFn:async()=>({status:++checks===1?1:0}),
    });
    assert.equal(result.ok,true);assert.equal(result.retryFailures.length,1);
    assert.match(result.retryFailures[0].feedback,/exited 1.*without output/i);
});

test('precheck: red skips full verification and green still requires the full verifier',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs');fs.writeFileSync(file,'original\n');
    let prechecks=0,verifies=0,attempts=0;
    const result=await verifyGatedTransform({filePath:file,instruction:'change',precheckCmd:'cheap',verifyCmd:'full',retries:2,
        chatFn:async()=>({content:`candidate${++attempts}`}),
        execFn:async cmd=>cmd==='cheap'?{status:++prechecks===1?1:0,stderr:'syntax failed'}:{status:++verifies===1?1:0,stderr:'test failed'},
    });
    assert.equal(result.ok,true);assert.equal(result.attempts,3);
    assert.equal(prechecks,3);assert.equal(verifies,2);
    assert.deepEqual(result.retryFailures.map(failure=>failure.phase),['precheck','verification']);
    assert.equal(fs.readFileSync(file,'utf8'),'candidate3\n');
});

test('precheck: exhausted red and every no-verdict outcome restore the original bytes',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs'),before=Buffer.from('original\r\n');
    for(const check of [{status:1},{status:2,stderr:'unavailable'},{status:null,error:new Error('launch failed')},{status:null,signal:'SIGTERM'}]){
        fs.writeFileSync(file,before);
        let verifies=0,prechecks=0;
        const pending=verifyGatedTransform({filePath:file,instruction:'change',precheckCmd:'cheap',verifyCmd:'full',retries:1,stateDir:dir,
            chatFn:async()=>({content:'candidate'}),
            execFn:async cmd=>{if(cmd==='cheap'){prechecks++;return check;}verifies++;return {status:0};},
        });
        if(check.status===1){
            const result=await pending;assert.equal(result.ok,false);assert.equal(prechecks,2);assert.match(result.error,/precheck.*red/i);
        }else await assert.rejects(pending,error=>{
            assert.match(error.message,/Precheck command.*no verdict/);
            const saved=/Saved candidate reply to (.+\/reply\.txt)/.exec(error.message);
            assert.ok(saved);assert.equal(fs.readFileSync(saved[1],'utf8'),'candidate');
            t.after(()=>fs.rmSync(path.dirname(saved[1]),{recursive:true,force:true}));
            assert.equal(prechecks,1);return true;
        });
        assert.equal(verifies,0);assert.deepEqual(fs.readFileSync(file),before);
    }
    fs.writeFileSync(file,before);
    const fullRed=await verifyGatedTransform({filePath:file,instruction:'change',precheckCmd:'cheap',verifyCmd:'full',retries:0,
        chatFn:async()=>({content:'candidate'}),execFn:async cmd=>({status:cmd==='cheap'?0:1}),
    });
    assert.equal(fullRed.ok,false);assert.deepEqual(fs.readFileSync(file),before);
});

test('precheck: CLI retries invalid syntax without running the full verifier for it',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs'),checker=path.join(dir,'check.cjs'),count=path.join(dir,'count');
    fs.writeFileSync(file,'const value = 1;\n');
    fs.writeFileSync(checker,"require('node:fs').appendFileSync(process.argv[2],'verified\\n');\n");
    const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
    let attempts=0;
    const result=await capture(()=>main(['transform','--model','fixture','--file',file,'--prompt','change',
        '--precheck',`${quote(process.execPath)} --check ${quote(file)}`,
        '--verify',`${quote(process.execPath)} ${quote(checker)} ${quote(count)}`],
        {fetchImpl:async()=>responding({choices:[{finish_reason:'stop',message:{content:++attempts===1?'const value = ;':'const value = 2;'}}]})()},
    ));
    assert.equal(result.code,0,result.err.join('\n'));
    assert.equal(fs.readFileSync(count,'utf8'),'verified\n');assert.equal(attempts,2);
    assert.match(result.out[0],/attempts=2 /);assert.equal(result.out.length,1);
    assert.match(result.err.join('\n'),/phase=precheck.*failed:[\s\S]*SyntaxError/);
});

test('precheck: cancellation terminates its child and rolls back without full verification',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs'),checker=path.join(dir,'wait.cjs');
    fs.writeFileSync(file,'original\n');fs.writeFileSync(checker,"console.log('ready');setInterval(()=>{},1000);\n");
    const quote=value=>"'"+value.replaceAll("'","'\\''")+"'",controller=new AbortController();
    let started=0;
    await assert.rejects(verifyGatedTransform({filePath:file,instruction:'change',precheckCmd:`${quote(process.execPath)} ${quote(checker)}`,
        verifyCmd:'full',signal:controller.signal,chatFn:async()=>({content:'candidate'}),
        execFn:(cmd,options)=>{
            assert.notEqual(cmd,'full','full verifier never runs after cancellation');started++;
            return runVerify(cmd,{onSpawn:child=>{options.onSpawn(child);child.stdout.once('data',()=>controller.abort());}});
        },
    }),/Precheck command.*no verdict/);
    assert.equal(started,1);assert.equal(fs.readFileSync(file,'utf8'),'original\n');
});

test('precheck: invalid commands and missing full verification refuse before generation',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs');fs.writeFileSync(file,'original\n');
    let generated=0;
    for(const precheckCmd of ['', ' ', 42])await assert.rejects(verifyGatedTransform({filePath:file,instruction:'change',verifyCmd:'full',precheckCmd,
        chatFn:async()=>{generated++;return {content:'candidate'};},execFn:async()=>({status:0}),
    }),/precheck/i);
    await assert.rejects(verifyGatedTransform({filePath:file,instruction:'change',precheckCmd:'cheap',chatFn:async()=>{generated++;}}),/requires --verify/);
    for(const cmd of ['chat','summarize','status','eval','dedup']){
        const result=await capture(()=>main([cmd,'--precheck','cheap'],{fetchImpl:async()=>{generated++;return responding(complete)();}}));
        assert.equal(result.code,2);
    }
    assert.equal(generated,0);assert.equal(fs.readFileSync(file,'utf8'),'original\n');
});

test('precheck cancellation: pre-aborted requests start neither baseline nor generation',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs'),controller=new AbortController();fs.writeFileSync(file,'original\n');
    controller.abort();let checks=0,generated=0;
    await assert.rejects(verifyGatedTransform({filePath:file,instruction:'change',preflight:true,precheckCmd:'cheap',verifyCmd:'full',signal:controller.signal,
        chatFn:async()=>{generated++;return {content:'candidate'};},execFn:async()=>{checks++;return {status:0};},
    }),/aborted/);
    assert.equal(checks,0);assert.equal(generated,0);assert.equal(fs.readFileSync(file,'utf8'),'original\n');
});

test('precheck cancellation: aborting a real baseline child prevents generation',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs'),checker=path.join(dir,'baseline.cjs'),controller=new AbortController();
    fs.writeFileSync(file,'original\n');fs.writeFileSync(checker,"console.log('ready');setInterval(()=>{},1000);\n");
    const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
    let generated=0,started=0;
    await assert.rejects(verifyGatedTransform({filePath:file,instruction:'change',preflight:true,precheckCmd:'cheap',verifyCmd:`${quote(process.execPath)} ${quote(checker)}`,signal:controller.signal,
        chatFn:async()=>{generated++;return {content:'candidate'};},
        execFn:(cmd,options)=>{started++;return runVerify(cmd,{onSpawn:child=>{options.onSpawn(child);child.stdout.once('data',()=>controller.abort());}});},
    }),/aborted|no verdict/);
    assert.equal(started,1);assert.equal(generated,0);assert.equal(fs.readFileSync(file,'utf8'),'original\n');
});

test('precheck cancellation: an injected generation returning after abort cannot write a candidate',async t=>{
    const dir=temporary(t),file=path.join(dir,'target.mjs'),controller=new AbortController(),before='original\n';fs.writeFileSync(file,before);
    const write=fs.writeFileSync;let writes=0,checks=0;
    fs.writeFileSync=(target,content,...args)=>{if(target===file&&String(content)!==before)writes++;return write(target,content,...args);};
    try {
        await assert.rejects(verifyGatedTransform({filePath:file,instruction:'change',precheckCmd:'cheap',verifyCmd:'full',signal:controller.signal,
            chatFn:async()=>{controller.abort();return {content:'candidate'};},execFn:async()=>{checks++;return {status:0};},
        }),/aborted/);
    } finally {fs.writeFileSync=write;}
    assert.equal(writes,0);assert.equal(checks,0);assert.equal(fs.readFileSync(file,'utf8'),before);
});
