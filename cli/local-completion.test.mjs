// Local completion and fenced-code regression tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { callLocalChat, extractFencedCode, verifyGatedTransform } from '../packs/tools/local-llm/runner/local-llm.mjs';

test('fences with trailing whitespace, language and CRLF contain executable code', () => {
  for (const open of ['``` ', '```js ', '```javascript\t', '```c++']) {
    assert.equal(extractFencedCode(`${open}\r\nexport const value = 42;\r\n\x60\x60\x60`).trim(), 'export const value = 42;');
  }
});
test('an unfinished opening fence is refused while plain code remains compatible', () => {
  assert.throws(() => extractFencedCode('```js\nexport const value = 42;'), /fenced/i);
  assert.equal(extractFencedCode('export const value = 42;'), 'export const value = 42;');
});
test('inline triple backticks in generated code do not close the outer fence', () => {
  const code = 'const pattern = /```/;\nexport const value = 42;';
  assert.equal(extractFencedCode(`\x60\x60\x60js\n${code}\n\x60\x60\x60`).trim(), code);
  assert.equal(extractFencedCode(`\x60\x60\x60\x60js\n${code}\n\x60\x60\x60\x60`).trim(), code);
});
test('a shorter closer cannot terminate a wider opener, even around nested fences', async t => {
  const malformed = [
    '````js\nexport const value = 42;\n```',
    '````js\n```js\nexport const value = 42;\n```',
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-fence-width-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'source.mjs');
  const original = 'export const before = 1;\nexport const value = 0;\nexport const after = 2;\n';
  fs.writeFileSync(file, original);
  for (const content of malformed) {
    assert.throws(() => extractFencedCode(content), /fenced/);
    let verified = false;
    await assert.rejects(verifyGatedTransform({
      filePath: file, lineRange: '2-2', instruction: 'one change', verifyCmd: 'independent',
      chatFn: async () => ({ content }),
      execFn: async () => { verified = true; return { status: 0 }; },
    }), /fenced/);
    assert.equal(verified, false);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  }
  assert.equal(extractFencedCode('````js\nexport const value = 42;\n`````').trim(), 'export const value = 42;');
});
test('truncation cannot apply an otherwise verifier-passing replacement', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-incomplete-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'source.mjs');
  const original = 'export const before = 1;\nexport const value = 0;\nexport const after = 2;\n';
  fs.writeFileSync(file, original);
  let verified = 0;
  await assert.rejects(verifyGatedTransform({
    filePath: file, lineRange: '2-2', instruction: 'Set value to42', verifyCmd: 'independent',
    chatFn: options => callLocalChat({ ...options, fetchImpl: async () => ({
      ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: 'export const value = 42;' } }] }),
    }) }),
    execFn: async () => { verified++; return { status: 0 }; },
  }), /output budget exhausted/);
  assert.equal(verified, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});
test('injected fetch remains authoritative, including explicit remote selection and legacy response compatibility', async () => {
  for (const baseUrl of ['http://127.0.0.1:1234/v1', 'https://api.example.com/v1']) {
    let called = 0;
    const reply = await callLocalChat({ baseUrl, allowRemote: true, messages: [], fetchImpl: async (url, init) => {
      called++;
      assert.equal(url, `${baseUrl}/chat/completions`);
      assert.equal(init.redirect, 'error');
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'complete legacy response' } }] }) };
    } });
    assert.equal(called, 1);
    assert.equal(reply.content, 'complete legacy response');
  }
});
test('completion refusals inside an adapter keep their category', async () => {
  await assert.rejects(callLocalChat({ messages: [], fetchImpl: async () => {
    throw Object.assign(new Error('Local generation incomplete; split the task'), { code: 'LOCAL_GENERATION_INCOMPLETE' });
  } }), error => /generation incomplete/.test(error.message) && !/transport failed/.test(error.message));
});
