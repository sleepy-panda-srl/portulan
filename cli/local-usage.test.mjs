// Usage, exhaustion and rollback tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {callLocalChat, formatPassReceipt, verifyGatedTransform, RailError} from '../packs/tools/local-llm/runner/local-llm.mjs';
import {receiptOf} from './ledger.mjs';

const response = (usage, finish_reason = 'stop') => async () => ({ok:true,json:async()=>({
    choices:[{finish_reason,message:{content:'ANSWER',reasoning_content:'PRIVATE_REASONING'}}],usage,
})});
const invoke = (usage, reason) => callLocalChat({messages:[{role:'user',content:'PRIVATE_PROMPT'}],fetchImpl:response(usage,reason)});
const usage = {prompt_tokens:12,completion_tokens:18,prompt_tokens_details:{cached_tokens:4},completion_tokens_details:{reasoning_tokens:15}};

test('an injected policy rail is not relabelled as a transport failure',async()=>{
    const expected=new RailError('Injected input budget exceeded');
    await assert.rejects(callLocalChat({messages:[{role:'user',content:'safe'}],fetchImpl:async()=>{throw expected;}}),error=>error===expected);
});

test('reported cached input and reasoning remain measured subsets',async()=>{
    const reply=await invoke(usage);
    assert.equal(reply.promptTokens,12);assert.equal(reply.completionTokens,18);
    assert.equal(reply.reasoningTokens,15);assert.equal(reply.cachedPromptTokens,4);
    const receipt=formatPassReceipt({mode:'chat',model:'m',...reply});
    assert.match(receipt,/ reasoning=15t cached-in=4t /);
    assert.equal(receipt.includes('\n'),false);
    assert.doesNotMatch(JSON.stringify(reply),/PRIVATE_REASONING|PRIVATE_PROMPT/);
    assert.equal(receiptOf(receipt).out,18,'reasoning is not added to completion');
});

for(const value of [undefined,null,-1,0.5,'18',Infinity,Number.MAX_SAFE_INTEGER+1,{private:'DO_NOT_LOG'}]) {
    test(`invalid or missing usage remains unknown: ${String(value)}`,async()=>{
        const reply=await invoke({prompt_tokens:value,completion_tokens:value,prompt_tokens_details:{cached_tokens:value},completion_tokens_details:{reasoning_tokens:value}});
        for(const key of ['promptTokens','completionTokens','reasoningTokens','cachedPromptTokens']) assert.equal(reply[key],null,key);
        assert.doesNotMatch(formatPassReceipt({mode:'chat',model:'m',...reply}),/DO_NOT_LOG|Infinity|NaN/);
    });
}
test('zero is measured; inconsistent or unverifiable subsets are unknown',async()=>{
    const zero=await invoke({prompt_tokens:0,completion_tokens:0,prompt_tokens_details:{cached_tokens:0},completion_tokens_details:{reasoning_tokens:0}});
    assert.equal(zero.reasoningTokens,0);assert.equal(zero.cachedPromptTokens,0);
    for(const counters of [{...usage,completion_tokens:14},{...usage,completion_tokens:null}])assert.equal((await invoke(counters)).reasoningTokens,null);
    for(const counters of [{...usage,prompt_tokens:3},{...usage,prompt_tokens:null}])assert.equal((await invoke(counters)).cachedPromptTokens,null);
});
test('receipt validation does not expose subsets whose aggregate parent is unknown',()=>{
    const receipt=formatPassReceipt({mode:'chat',model:'m',promptTokens:Number.MAX_SAFE_INTEGER+1,completionTokens:null,reasoningTokens:3,cachedPromptTokens:4});
    assert.match(receipt,/in=\? out=\?/);assert.match(receipt,/reasoning=\? cached-in=\?/);
});

test('Q06 exhaustion names measured reasoning, without suggesting smaller input as a cure',async()=>{
    await assert.rejects(invoke({...usage,completion_tokens:8191,completion_tokens_details:{reasoning_tokens:8191}},'length'),error=>{
        assert.match(error.message,/reasoning.*(?:budget|8191)/i);
        assert.match(error.message,/8191/);
        assert.match(error.message,/backend|thinking control/i);
        assert.doesNotMatch(error.message,/PRIVATE_|split the task and selected span/i);
        return true;
    });
});
test('partial or inconsistent reasoning cannot be diagnosed as all-reasoning exhaustion',async()=>{
    for(const count of [3,19,'18',undefined])await assert.rejects(invoke({...usage,completion_tokens_details:{reasoning_tokens:count}},'length'),error=>{
        assert.match(error.message,/combined output budget/i);
        assert.doesNotMatch(error.message,/reasoning exhausted/i);
        return true;
    });
});

test('length refusal precedes transform writes and verification',async t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'local usage '));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    const file=path.join(dir,'target.mjs'),before='export const value = 1;\n';fs.writeFileSync(file,before);
    let verified=false;
    await assert.rejects(verifyGatedTransform({filePath:file,instruction:'change',verifyCmd:'fixture',retries:0,
        chatFn:options=>callLocalChat({...options,fetchImpl:response(usage,'length')}),
        execFn:()=>{verified=true;return {status:0};}}));
    assert.equal(verified,false);assert.equal(fs.readFileSync(file,'utf8'),before);
});
test('transform retries sum subsets once and propagate missing measurements',async t=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'local sums '));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    const file=path.join(dir,'target.mjs');fs.writeFileSync(file,'export const value = 1;\n');
    for(const missing of [false,true]){
        let attempts=0;
        const result=await verifyGatedTransform({filePath:file,instruction:'change',verifyCmd:'fixture',retries:1,
            chatFn:async()=>({content:'export const value = 2;',promptTokens:12,completionTokens:18,reasoningTokens:missing&&attempts===1?null:15,cachedPromptTokens:4,totalMs:1}),
            execFn:()=>({status:++attempts===1?1:0})});
        assert.match(result.receipt,missing?/reasoning=\? cached-in=8t/:/reasoning=30t cached-in=8t/);
        assert.match(result.receipt,/in=24t out=36t/);
    }
});
test('ledger accepts legacy and extended receipts, refuses impossible subsets',()=>{
    const legacy='OK mode=chat model=m attempts=1 in=12t out=18t time=10ms rate=1tok/s spend=$0.00';
    const extended=legacy.replace(' spend=',' reasoning=15t cached-in=4t spend=');
    assert.deepEqual(receiptOf(extended),receiptOf(legacy));
    assert.equal(receiptOf(extended.replace('reasoning=15t','reasoning=19t')),null);
    assert.equal(receiptOf(extended.replace('cached-in=4t','cached-in=13t')),null);
});
