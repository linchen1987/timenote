import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMcpServer } from './mcp.js';

let dir: string;

function writeDesktopFiles(endpoint: string): void {
  const automationDir = path.join(dir, 'automation');
  mkdirSync(automationDir, { recursive: true });
  writeFileSync(
    path.join(automationDir, 'descriptor.json'),
    JSON.stringify({ endpoint, instanceId: 'mcp-test', protocolVersion: 1 }),
  );
  writeFileSync(
    path.join(automationDir, 'credentials.json'),
    JSON.stringify({ token: 'mcp-token-1234567890abcdef' }),
  );
}

interface CallToolResult {
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
}

interface Harness {
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
  close(): Promise<void>;
}

async function startHarness(): Promise<
  Harness & { requests: unknown[]; respondWith: (r: unknown) => void; port: number }
> {
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');

  const requests: unknown[] = [];
  let respondWith: (r: unknown) => void = () => {};

  const httpServer = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', () => {
      if (req.headers.authorization !== 'Bearer mcp-token-1234567890abcdef') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            error: { code: 'UNAUTHORIZED', message: 'bad', retryable: false },
          }),
        );
        return;
      }
      if (req.method === 'GET' && req.url === '/api/v1/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            protocolVersion: 1,
            requestId: '',
            ok: true,
            result: {
              op: 'desktop.status',
              appVersion: 'test',
              protocolVersion: 1,
              instanceId: 'mcp-test',
              runtimes: [],
            },
          }),
        );
        return;
      }
      if (req.method === 'POST' && req.url === '/api/v1/operations') {
        const parsed = JSON.parse(body) as unknown;
        requests.push(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(respondWith(parsed)));
        return;
      }
      res.writeHead(404);
      res.end('{}');
    });
  });

  const port = await new Promise<number>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });

  writeDesktopFiles(`http://127.0.0.1:${port}`);

  const server = await createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);

  return {
    requests,
    respondWith: (r: unknown) => {
      respondWith = () => r;
    },
    port,
    callTool: (name, args) => client.callTool({ name, arguments: args }) as Promise<CallToolResult>,
    close: async () => {
      await client.close();
      await server.close();
      await new Promise<void>((done) => httpServer.close(() => done()));
    },
  };
}

describe('mcp server tools', () => {
  let harness: Awaited<ReturnType<typeof startHarness>>;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'timenote-mcp-test-'));
    process.env.TIMENOTE_DESKTOP_DIR = dir;
  });

  afterAll(async () => {
    delete process.env.TIMENOTE_DESKTOP_DIR;
    await harness?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('exposes tools with schemas', async () => {
    harness = await startHarness();
    harness.respondWith({
      protocolVersion: 1,
      requestId: 'x',
      ok: true,
      result: {
        op: 'desktop.status',
        appVersion: '1.0.0',
        protocolVersion: 1,
        instanceId: 'i',
        runtimes: [],
      },
    });
    const result = await harness.callTool('timenote_status', {});
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content?.[0]?.text ?? '{}')).toMatchObject({ op: 'desktop.status' });
  });

  it('creates notes through the desktop client', async () => {
    harness.respondWith({
      protocolVersion: 1,
      requestId: 'x',
      ok: true,
      result: {
        op: 'notes.create',
        noteId: '20260521-143022-7891',
        revision: 'sha256:aa',
        status: { committed: true, indexStatus: 'indexed', uiApplied: true },
      },
    });
    const result = await harness.callTool('timenote_create_note', {
      projectId: 'vMcp1',
      content: '# from mcp',
    });
    const sent = harness.requests[harness.requests.length - 1] as {
      operation: { op: string; projectId: string; operationId: string };
    };
    expect(sent.operation.op).toBe('notes.create');
    expect(sent.operation.projectId).toBe('vMcp1');
    expect(sent.operation.operationId).toMatch(/^op-/);
    expect(JSON.parse(result.content?.[0]?.text ?? '{}')).toMatchObject({
      noteId: '20260521-143022-7891',
    });
  });

  it('marks tool errors without throwing', async () => {
    harness.respondWith({
      protocolVersion: 1,
      requestId: 'x',
      ok: false,
      error: { code: 'REVISION_CONFLICT', message: 'stale revision', retryable: false },
    });
    const result = await harness.callTool('timenote_update_note', {
      projectId: 'vMcp1',
      noteId: '20260521-143022-7891',
      expectedRevision: 'sha256:old',
      content: 'new body',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content?.[0]?.text ?? '{}').error.code).toBe('REVISION_CONFLICT');
  });

  it('rejects missing required fields via schema', async () => {
    const result = await harness
      .callTool('timenote_get_note', { projectId: 'vMcp1' })
      .catch((e: unknown) => e);
    // zod validation failures surface as tool errors, not crashes
    const isError = (result as CallToolResult)?.isError === true || result instanceof Error;
    expect(isError).toBe(true);
  });
});
