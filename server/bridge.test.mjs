import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BAD_TOKEN, CLOSED, Link, dataDir, errorReply, messages } from './bridge.mjs';

const INIT = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}';
const LIST = '{"jsonrpc":"2.0","id":2,"method":"tools/list"}';

/** A fake Cord server: one session per port, forgotten when the port changes. */
function fakeCord() {
  const sessions = new Map(); // port -> session id
  const calls = [];
  let n = 0;
  const fetchImpl = async (url, { headers, body }) => {
    const port = Number(new URL(url).port);
    const method = JSON.parse(body).method;
    calls.push({ port, method, session: headers['mcp-session-id'] ?? null });
    if (headers.authorization !== 'Bearer good') return reply(401, '');
    if (method === 'initialize') {
      const id = `s${++n}`;
      sessions.set(port, id);
      return reply(200, '{"jsonrpc":"2.0","id":1,"result":{}}', { 'mcp-session-id': id });
    }
    if (headers['mcp-session-id'] !== sessions.get(port)) return reply(404, 'no session');
    if (method === 'notifications/initialized') return reply(202, '');
    return reply(200, 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[]}}\n\n', { 'content-type': 'text/event-stream' });
  };
  return { fetchImpl, calls, sessions };
}

function reply(status, body, headers = {}) {
  return { status, headers: new Map(Object.entries({ 'content-type': 'application/json', ...headers })), text: async () => body };
}

function portFile(port) {
  const file = join(mkdtempSync(join(tmpdir(), 'cord-mcp-')), 'mcp.json');
  if (port) writeFileSync(file, JSON.stringify({ port }));
  return file;
}

test('finds the data folder like Cord does', () => {
  assert.equal(dataDir({ CORD_DATA_DIR: '/x' }, 'linux', '/h'), '/x');
  assert.equal(dataDir({}, 'win32', 'C:\\Users\\a'), join('C:\\Users\\a', '.cord'));
  assert.equal(dataDir({ XDG_DATA_HOME: '/d' }, 'linux', '/h'), join('/d', 'cord'));
  assert.equal(dataDir({ XDG_DATA_HOME: 'rel' }, 'linux', '/h'), join('/h', '.local', 'share', 'cord'));
});

test('reads JSON and event-stream replies', () => {
  assert.deepEqual(messages('application/json', '{"id":1}'), ['{"id":1}']);
  assert.deepEqual(messages('text/event-stream', 'data: {"id":1}\n\ndata: {"id":2}\n'), ['{"id":1}', '{"id":2}']);
  assert.deepEqual(messages('application/json', ''), []);
});

test('answers requests with an error, notifications with nothing', () => {
  assert.equal(JSON.parse(errorReply(LIST, CLOSED)).error.message, CLOSED);
  assert.equal(errorReply('{"jsonrpc":"2.0","method":"notifications/initialized"}', CLOSED), null);
});

test('relays a session', async () => {
  const cord = fakeCord();
  const link = new Link(portFile(5001), 'good', cord.fetchImpl);
  assert.match((await link.forward(INIT))[0], /result/);
  assert.match((await link.forward(LIST))[0], /tools/);
  assert.equal(cord.calls.at(-1).session, 's1');
});

test('says Cord is closed when there is no port file', async () => {
  const link = new Link(portFile(null), 'good', fakeCord().fetchImpl);
  await assert.rejects(link.forward(LIST), { message: CLOSED });
});

test('says the token was refused', async () => {
  const link = new Link(portFile(5001), 'wrong', fakeCord().fetchImpl);
  await assert.rejects(link.forward(INIT), { message: BAD_TOKEN });
  const broken = new Link(portFile(5001), 'go\nod', fakeCord().fetchImpl);
  await assert.rejects(broken.forward(INIT), { message: BAD_TOKEN });
});

test('survives Cord restarting its server on a new port', async () => {
  const cord = fakeCord();
  const file = portFile(5001);
  const link = new Link(file, 'good', cord.fetchImpl);
  await link.forward(INIT);
  writeFileSync(file, JSON.stringify({ port: 5002 }));
  assert.match((await link.forward(LIST))[0], /tools/);
  assert.deepEqual(cord.calls.slice(-3).map((c) => [c.port, c.method]), [
    [5002, 'initialize'], [5002, 'notifications/initialized'], [5002, 'tools/list'],
  ]);
});

test('starts a new session when the server forgot it', async () => {
  const cord = fakeCord();
  const link = new Link(portFile(5001), 'good', cord.fetchImpl);
  await link.forward(INIT);
  cord.sessions.clear(); // Same port, but the server restarted.
  assert.match((await link.forward(LIST))[0], /tools/);
});
