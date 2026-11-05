// Local HTTP deadlines, response bounds and compatibility tests.
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { localModelFetch, LOCAL_RESPONSE_DEADLINE_MS, LOCAL_RESPONSE_MAX_BYTES, callLocalChat, runDedup } from '../packs/tools/local-llm/runner/local-llm.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function server(t, handler) {
  const app = http.createServer(handler);
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => { app.closeAllConnections(); app.close(); });
  return `http://127.0.0.1:${app.address().port}`;
}
test('waits for non-streaming response and exposes JSON/status without leaking content', async t => {
  const url = await server(t, (req, res) => {
    assert.equal(req.method, 'POST');
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => setTimeout(() => res.end(body), 30));
  });
  const response = await localModelFetch(url, { method: 'POST', body: '{"value":42}' });
  assert.equal(response.ok, true);
  assert.deepEqual(await response.json(), { value: 42 });
});
test('deadline terminates a stalled response', async t => {
  const url = await server(t, () => {});
  await assert.rejects(localModelFetch(url, {}, { deadlineMs: 20 }), /deadline/);
});
test('limits body size and supports cancellation', async t => {
  const url = await server(t, (_, res) => res.end('x'.repeat(100)));
  await assert.rejects(localModelFetch(url, {}, { maxBytes: 10 }), /size limit/);
  const stalled = await server(t, () => {});
  const controller = new AbortController();
  const request = localModelFetch(stalled, { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /aborted/);
});
test('rejects off-loopback and credentials; redirects never reach destination', async t => {
  for (const url of ['https://example.com', 'http://remote.localhost:1234', 'http://user:secret@127.0.0.1']) {
    await assert.rejects(localModelFetch(url), /literal loopback/);
  }
  let destinationCalls = 0;
  const destination = await server(t, (_, res) => { destinationCalls++; res.end('{}'); });
  const redirect = await server(t, (_, res) => res.writeHead(302, { location: destination }).end());
  assert.equal((await localModelFetch(redirect)).status, 302);
  assert.equal(destinationCalls, 0);
});
test('default deadline survives a five-minute delayed header response on controlled clock', async t => {
  assert.equal(LOCAL_RESPONSE_DEADLINE_MS, 900000);
  assert.equal(LOCAL_RESPONSE_MAX_BYTES, 262144);
  let receive;
  const received = new Promise(resolve => receive = resolve);
  const url = await server(t, (_, res) => receive(res));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = localModelFetch(url);
  const response = await received;
  t.mock.timers.tick(300001);
  response.end('{"complete":true}');
  assert.deepEqual(await (await pending).json(), { complete: true });
});
test('deadline includes a partial response body and closes the socket', async t => {
  let receive, closed;
  const received = new Promise(resolve => receive = resolve);
  const socketClosed = new Promise(resolve => closed = resolve);
  const url = await server(t, (req, res) => {
    req.socket.on('close', closed);
    res.writeHead(200); res.write('{'); receive();
  });
  const pending = localModelFetch(url, {}, { deadlineMs: 30 });
  const rejected = assert.rejects(pending, { code: 'LOCAL_RESPONSE_TIMEOUT' });
  await received;
  await rejected;
  await socketClosed;
});
test('chunked size limits and premature Content-Length fail without accepting partial data', async t => {
  const chunked = await server(t, (_, res) => { res.write('x'.repeat(8)); res.end('y'.repeat(8)); });
  await assert.rejects(localModelFetch(chunked, {}, { maxBytes: 10 }), { code: 'LOCAL_RESPONSE_SIZE' });
  const oversized = await server(t, (_, res) => { res.writeHead(200, { 'content-length': 20 }); res.flushHeaders(); });
  await assert.rejects(localModelFetch(oversized, {}, { maxBytes: 10 }), { code: 'LOCAL_RESPONSE_SIZE' });
  const partial = await server(t, (_, res) => { res.writeHead(200, { 'content-length': 20 }); res.end('short'); });
  await assert.rejects(localModelFetch(partial, {}, { deadlineMs: 50 }), /interrupted|deadline|aborted/);
});
test('localhost is safely pinned to loopback and default chat dispatch uses the bounded path', async t => {
  const url = await server(t, (_, res) => res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] })));
  assert.equal((await localModelFetch(url.replace('127.0.0.1', 'localhost'))).ok, true);
  assert.equal((await callLocalChat({ baseUrl: `${url}/v1`, messages: [] })).content, 'ok');
});
test('embeddings preserve response capacity above chat cap', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'embedding-capacity-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'a.md'), 'a');
  fs.writeFileSync(path.join(dir, 'b.md'), 'b');
  const payload = JSON.stringify({ data: [0, 1].map(index => ({ index, embedding: Array(70000).fill(1) })) });
  assert.ok(Buffer.byteLength(payload) > LOCAL_RESPONSE_MAX_BYTES);
  const url = await server(t, (req, res) => { assert.equal(req.url, '/v1/embeddings'); res.end(payload); });
  const result = await runDedup({ dir, baseUrl: `${url}/v1` });
  assert.equal(result.pairs.length, 1);
});
test('literal loopback never uses an environment proxy', async t => {
  let targetCalls = 0, proxyCalls = 0;
  const target = await server(t, (_, res) => { targetCalls++; res.end('target'); });
  const proxy = await server(t, (_, res) => { proxyCalls++; res.end('proxy'); });
  const moduleUrl = new URL('../packs/tools/local-llm/runner/local-llm.mjs', import.meta.url).href;
  const source = `import {localModelFetch} from ${JSON.stringify(moduleUrl)}; process.stdout.write(await (await localModelFetch(process.env.LOCAL_TEST_TARGET)).text());`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', HTTP_PROXY: proxy, HTTPS_PROXY: proxy,
      http_proxy: proxy, https_proxy: proxy, ALL_PROXY: proxy, all_proxy: proxy,
      NO_PROXY: '', no_proxy: '', LOCAL_TEST_TARGET: target },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', error = '';
  child.stdout.on('data', chunk => output += chunk);
  child.stderr.on('data', chunk => error += chunk);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  assert.equal(code, 0, error);
  assert.equal(output, 'target');
  assert.equal(targetCalls, 1);
  assert.equal(proxyCalls, 0);
});
