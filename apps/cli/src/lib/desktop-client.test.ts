import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AUTOMATION_PROTOCOL_VERSION } from '@timenote/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDesktopClient, DesktopCliError, responseToError } from './desktop-client.js';

let dir: string;

function writeDesktopFiles(endpoint: string): void {
  const automationDir = path.join(dir, 'automation');
  mkdirSync(automationDir, { recursive: true });
  writeFileSync(
    path.join(automationDir, 'descriptor.json'),
    JSON.stringify({ endpoint, instanceId: 'test-instance', protocolVersion: 1 }),
  );
  writeFileSync(
    path.join(automationDir, 'credentials.json'),
    JSON.stringify({ token: 'test-token-1234567890abcdef' }),
  );
}

interface FakeBroker {
  requests: unknown[];
  respondWith: (body: unknown) => unknown;
  operations: Map<string, unknown>;
  statusCalls: number;
  statusRespondWith?: () => unknown;
}

function startFakeBroker(): Promise<FakeBroker & { close(): Promise<void>; port: number }> {
  const state: FakeBroker = {
    requests: [],
    respondWith: () => {},
    operations: new Map(),
    statusCalls: 0,
  };

  const httpServer = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const auth = req.headers.authorization;
      if (auth !== 'Bearer test-token-1234567890abcdef') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: false,
            error: { code: 'UNAUTHORIZED', message: 'bad token', retryable: false },
          }),
        );
        return;
      }
      if (req.method === 'GET' && req.url === '/api/v1/status') {
        state.statusCalls++;
        const body = state.statusRespondWith
          ? state.statusRespondWith()
          : {
              protocolVersion: 1,
              requestId: '',
              ok: true,
              result: {
                op: 'desktop.status',
                appVersion: 'test',
                protocolVersion: 1,
                instanceId: 'test-instance',
                runtimes: [],
              },
            };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(typeof body === 'string' ? body : JSON.stringify(body));
        return;
      }
      if (req.method === 'POST' && req.url === '/api/v1/operations') {
        const parsed = JSON.parse(body) as {
          requestId: string;
          operation: { operationId?: string };
        };
        state.requests.push(parsed);
        const payload = state.respondWith(parsed);
        if (parsed.operation.operationId && payload && (payload as { ok?: boolean }).ok) {
          state.operations.set(parsed.operation.operationId, payload);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }
      const match = req.url?.match(/^\/api\/v1\/operations\/(.+)$/);
      if (req.method === 'GET' && match) {
        const stored = state.operations.get(decodeURIComponent(match[1]));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            stored ?? {
              ok: false,
              error: { code: 'OUTCOME_UNKNOWN', message: 'unknown', retryable: false },
            },
          ),
        );
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          error: { code: 'INVALID_ARGUMENT', message: 'route', retryable: false },
        }),
      );
    });
  });

  return new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const handle = state as FakeBroker & { close(): Promise<void>; port: number };
      handle.close = () => new Promise<void>((done) => httpServer.close(() => done()));
      handle.port = port;
      resolve(handle);
    });
  });
}

describe('desktop client', () => {
  let broker: Awaited<ReturnType<typeof startFakeBroker>>;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'timenote-cli-test-'));
    process.env.TIMENOTE_DESKTOP_DIR = dir;
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.TIMENOTE_DESKTOP_DIR;
    return broker?.close();
  });

  it('fails with DESKTOP_UNAVAILABLE when no descriptor exists', async () => {
    const err = await createDesktopClient().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DesktopCliError);
    expect((err as DesktopCliError).code).toBe('DESKTOP_UNAVAILABLE');
    expect((err as DesktopCliError).exitCode).toBe(4);
  });

  it('executes operations against a running desktop', async () => {
    broker = await startFakeBroker();
    writeDesktopFiles(`http://127.0.0.1:${broker.port}`);
    broker.respondWith = () => ({
      protocolVersion: 1,
      requestId: 'x',
      ok: true,
      result: {
        op: 'notes.create',
        noteId: '20260521-143022-7891',
        revision: 'sha256:abc',
        status: { committed: true, indexStatus: 'indexed', uiApplied: true },
      },
    });

    const client = await createDesktopClient();
    const response = await client.execute({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: 'req-test-1',
      operation: {
        op: 'notes.create',
        projectId: 'vTest12345',
        content: 'hello',
        operationId: 'op-test-123456',
      },
    });

    expect(response.ok).toBe(true);
    expect(broker.requests.length).toBe(1);
    const sent = broker.requests[0] as { protocolVersion: number; requestId: string };
    expect(sent.protocolVersion).toBe(1);
    expect(sent.requestId).toBe('req-test-1');
  });

  it('rejects invalid auth from the server', async () => {
    // token in env dir is correct; simulate server rejecting instead
    broker.respondWith = () => ({
      protocolVersion: 1,
      requestId: 'x',
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'revoked', retryable: false },
    });
    const client = await createDesktopClient();
    const response = await client.execute({
      protocolVersion: 1,
      requestId: 'req-test-2',
      operation: { op: 'notes.list', projectId: 'vTest12345', limit: 10 },
    });
    const err = responseToError(response);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.exitCode).toBe(5);
  });

  it('maps conflict errors to exit code 3', async () => {
    broker.respondWith = () => ({
      protocolVersion: 1,
      requestId: 'x',
      ok: false,
      error: {
        code: 'REVISION_CONFLICT',
        message: 'stale',
        retryable: false,
        details: { currentRevision: 'sha256:new' },
      },
    });
    const client = await createDesktopClient();
    const response = await client.execute({
      protocolVersion: 1,
      requestId: 'req-test-3',
      operation: {
        op: 'notes.update',
        projectId: 'vTest12345',
        noteId: '20260521-143022-7891',
        content: 'x',
        expectedRevision: 'sha256:old',
        operationId: 'op-conflict-1',
      },
    });
    const err = responseToError(response);
    expect(err.code).toBe('REVISION_CONFLICT');
    expect(err.exitCode).toBe(3);
  });

  it('polls operations.get when a write times out with OUTCOME_UNKNOWN', async () => {
    let call = 0;
    broker.respondWith = (_req: unknown) => {
      call++;
      if (call === 1) {
        return {
          protocolVersion: 1,
          requestId: 'x',
          ok: false,
          error: { code: 'OUTCOME_UNKNOWN', message: 'timeout', retryable: false },
        };
      }
      throw new Error('only one operation expected');
    };
    // seed the recorded result the poll should find
    broker.operations.set('op-poll-1', {
      protocolVersion: 1,
      requestId: 'x',
      ok: true,
      result: {
        op: 'notes.create',
        noteId: '20260521-143022-7899',
        revision: 'sha256:def',
        status: { committed: true, indexStatus: 'indexed', uiApplied: true },
      },
    });

    const client = await createDesktopClient();
    const response = await client.execute({
      protocolVersion: 1,
      requestId: 'req-test-4',
      operation: {
        op: 'notes.create',
        projectId: 'vTest12345',
        content: 'later',
        operationId: 'op-poll-1',
      },
    });
    expect(response.ok).toBe(true);
    expect((response.result as { noteId: string }).noteId).toBe('20260521-143022-7899');
  });

  it('reports DESKTOP_UNAVAILABLE when the port is reused by a non-automation process', async () => {
    // app closed, another process took the port, responds with garbage
    broker.statusRespondWith = () => '<<<not json>>>';
    const err = await createDesktopClient().catch((e: unknown) => e);
    broker.statusRespondWith = undefined;
    expect(err).toBeInstanceOf(DesktopCliError);
    expect((err as DesktopCliError).code).toBe('DESKTOP_UNAVAILABLE');
    expect((err as DesktopCliError).exitCode).toBe(4);
    expect((err as DesktopCliError).message).toContain('not answering as the expected');
  });

  it('reports DESKTOP_UNAVAILABLE when the responder has a different instanceId', async () => {
    broker.statusRespondWith = () => ({
      protocolVersion: 1,
      requestId: '',
      ok: true,
      result: {
        op: 'desktop.status',
        appVersion: 'other',
        protocolVersion: 1,
        instanceId: 'someone-else',
        runtimes: [],
      },
    });
    const err = await createDesktopClient().catch((e: unknown) => e);
    broker.statusRespondWith = undefined;
    expect(err).toBeInstanceOf(DesktopCliError);
    expect((err as DesktopCliError).code).toBe('DESKTOP_UNAVAILABLE');
    expect((err as DesktopCliError).exitCode).toBe(4);
  });

  it('picks up a rewritten descriptor when the original endpoint went stale', async () => {
    // simulate a desktop restart: the read endpoint is an impostor, but the
    // descriptor gets rewritten (new port) while the handshake is in flight
    broker.respondWith = () => ({
      protocolVersion: 1,
      requestId: 'x',
      ok: true,
      result: { op: 'notes.list', notes: [], total: 0 },
    });
    const realPort = broker.port;
    let impostorHits = 0;
    const impostor = createServer((_req, res) => {
      impostorHits++;
      // the restarted desktop rewrites the descriptor mid-handshake
      writeDesktopFiles(`http://127.0.0.1:${realPort}`);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('i am not timenote');
    });
    await new Promise<void>((r) => impostor.listen(0, '127.0.0.1', r));
    const impostorPort = (impostor.address() as { port: number }).port;
    writeDesktopFiles(`http://127.0.0.1:${impostorPort}`);

    const client = await createDesktopClient();
    expect(impostorHits).toBe(1);
    const response = await client.execute({
      protocolVersion: 1,
      requestId: 'req-recover-1',
      operation: { op: 'notes.list', projectId: 'vTest12345', limit: 10 },
    });
    expect(response.ok).toBe(true);
    await new Promise<void>((r) => impostor.close(() => r()));
  });

  it('reports retryable DESKTOP_UNAVAILABLE when the app is closed (port refused)', async () => {
    // grab a port and free it so connections are refused instantly
    const throwaway = createServer();
    await new Promise<void>((r) => throwaway.listen(0, '127.0.0.1', r));
    const port = (throwaway.address() as { port: number }).port;
    await new Promise<void>((r) => throwaway.close(() => r()));
    writeDesktopFiles(`http://127.0.0.1:${port}`);

    const err = await createDesktopClient().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DesktopCliError);
    expect((err as DesktopCliError).code).toBe('DESKTOP_UNAVAILABLE');
    expect((err as DesktopCliError).exitCode).toBe(4);
    expect((err as DesktopCliError).retryable).toBe(true);
  });
});
