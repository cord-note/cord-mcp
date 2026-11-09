#!/usr/bin/env node
// Connects an MCP client (Claude Code, Claude Desktop, ...) to the Cord app.
// It relays JSON-RPC lines between stdin/stdout and Cord's local server, adding
// the token from CORD_MCP_TOKEN. Cord writes its port to <data dir>/mcp.json
// while agents are allowed and you are signed in. No dependencies; Node 18+.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export const CLOSED = 'Cord is locked or closed. Open and unlock it, then try again.';
export const BAD_TOKEN = 'Cord refused the token. Copy a fresh one from the Agents tab in Cord.';
const INITIALIZED = '{"jsonrpc":"2.0","method":"notifications/initialized"}';

/** Cord's data folder, by the same rule the app uses. */
export function dataDir(env = process.env, platform = process.platform, home = homedir()) {
  if (env.CORD_DATA_DIR) return env.CORD_DATA_DIR;
  if (platform !== 'linux') return join(home, '.cord');
  const xdg = env.XDG_DATA_HOME;
  return xdg && isAbsolute(xdg) ? join(xdg, 'cord') : join(home, '.local', 'share', 'cord');
}

export function readPort(file) {
  try {
    const port = JSON.parse(readFileSync(file, 'utf8')).port;
    return Number.isInteger(port) ? port : null;
  } catch {
    return null;
  }
}

/** The JSON-RPC messages in one HTTP reply: a JSON body, or SSE `data:` lines. */
export function messages(contentType, body) {
  if (!body.trim()) return [];
  if (contentType.startsWith('text/event-stream')) {
    return body.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean);
  }
  return [body.trim()];
}

/** A JSON-RPC error for a request; notifications (no id) get none. */
export function errorReply(line, message) {
  try {
    const msg = JSON.parse(line);
    if (msg.id === undefined) return null;
    return JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message } });
  } catch {
    return null;
  }
}

class Failure extends Error {}

/**
 * One client's connection to Cord. Locking and unlocking Cord restarts its
 * server on a new port, which forgets the session; the link then replays the
 * client's `initialize`, so the client never notices.
 */
export class Link {
  constructor(portFile, token, fetchImpl = fetch) {
    this.portFile = portFile;
    this.token = (token ?? '').trim();
    this.fetch = fetchImpl;
    this.port = null;
    this.session = null;
    this.init = null;
  }

  async forward(line) {
    let method;
    try { method = JSON.parse(line).method; } catch { method = undefined; }
    const isInit = method === 'initialize';
    if (isInit) { this.init = line; this.session = null; }
    const port = readPort(this.portFile);
    if (port === null) throw new Failure(CLOSED);
    if (this.port !== null && this.port !== port && !isInit) await this.reconnect(port);
    this.port = port;
    let sent = await this.send(port, line);
    if (sent === 'lost' && !isInit && this.init) {
      await this.reconnect(port);
      sent = await this.send(port, line);
    }
    if (sent === 'lost') throw new Failure(CLOSED);
    return sent;
  }

  async reconnect(port) {
    this.session = null;
    if (!this.init) return;
    await this.send(port, this.init);
    await this.send(port, INITIALIZED);
  }

  async send(port, line) {
    if (/[\r\n]/.test(this.token)) throw new Failure(BAD_TOKEN);
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${this.token}`,
    };
    if (this.session) headers['mcp-session-id'] = this.session;
    let res;
    try {
      res = await this.fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers, body: line });
    } catch (e) {
      process.stderr.write(`cord-mcp: ${e?.cause?.code ?? e}\n`); // Clients keep stderr in their logs.
      throw new Failure(CLOSED);
    }
    if (res.status === 401) throw new Failure(BAD_TOKEN);
    if (this.session && (res.status === 400 || res.status === 404)) return 'lost';
    const id = res.headers.get('mcp-session-id');
    if (id) this.session = id;
    return messages(res.headers.get('content-type') ?? '', await res.text());
  }
}

/** Relays stdin to Cord until stdin closes. */
export async function run(input = process.stdin, output = process.stdout, env = process.env) {
  const link = new Link(join(dataDir(env), 'mcp.json'), env.CORD_MCP_TOKEN);
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let replies;
    try {
      replies = await link.forward(line);
    } catch (e) {
      if (!(e instanceof Failure)) process.stderr.write(`cord-mcp: ${e?.stack ?? e}\n`);
      const reply = errorReply(line, e instanceof Failure ? e.message : CLOSED);
      replies = reply ? [reply] : [];
    }
    for (const r of replies) output.write(`${r}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run().catch((e) => { process.stderr.write(`cord-mcp: ${e?.stack ?? e}\n`); process.exit(1); });
}
