import { describe, expect, it } from 'vitest';
import {
  type AutomationOperation,
  AutomationOperationError,
  isWriteOperation,
  makeErrorResponse,
  makeSuccessResponse,
  parseAutomationRequest,
} from './contracts';

describe('parseAutomationRequest', () => {
  it('accepts a valid notes.get request', () => {
    const result = parseAutomationRequest({
      protocolVersion: 1,
      requestId: 'req-abc123',
      operation: { op: 'notes.get', projectId: 'vAb12cd34ef', noteId: '20260521-143022-7891' },
    });
    expect(result.ok).toBe(true);
  });

  it('accepts projectIds without any prefix constraint', () => {
    for (const projectId of ['Bm1ic75uaq', 'notebook-42', 'my_vault_2026', 'whatever/id-free']) {
      const result = parseAutomationRequest({
        protocolVersion: 1,
        requestId: 'req-abc123',
        operation: { op: 'notes.list', projectId },
      });
      expect(result.ok).toBe(true);
    }
  });

  it('rejects invalid noteId', () => {
    const result = parseAutomationRequest({
      protocolVersion: 1,
      requestId: 'req-abc123',
      operation: { op: 'notes.get', projectId: 'vAb12cd34ef', noteId: '../../etc/passwd' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_ARGUMENT');
  });

  it('rejects wrong protocol version', () => {
    const result = parseAutomationRequest({
      protocolVersion: 99,
      requestId: 'req-abc123',
      operation: { op: 'desktop.status' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects update without content/append', () => {
    const result = parseAutomationRequest({
      protocolVersion: 1,
      requestId: 'req-abc123',
      operation: {
        op: 'notes.update',
        projectId: 'vAb12cd34ef',
        noteId: '20260521-143022-7891',
        expectedRevision: 'sha256:abcdef',
        operationId: 'op-12345678',
      },
    });
    expect(result.ok).toBe(false);
  });

  it('caps search query length and limit', () => {
    const long = 'x'.repeat(600);
    const result = parseAutomationRequest({
      protocolVersion: 1,
      requestId: 'req-abc123',
      operation: { op: 'notes.search', projectId: 'vAb12cd34ef', query: long },
    });
    expect(result.ok).toBe(false);

    const result2 = parseAutomationRequest({
      protocolVersion: 1,
      requestId: 'req-abc123',
      operation: { op: 'notes.list', projectId: 'vAb12cd34ef', limit: 10000 },
    });
    expect(result2.ok).toBe(false);
  });
});

describe('isWriteOperation', () => {
  it('classifies write ops', () => {
    const create: AutomationOperation = {
      op: 'notes.create',
      projectId: 'vAb12cd34ef',
      content: 'x',
      operationId: 'op-12345678',
    };
    const read: AutomationOperation = {
      op: 'notes.get',
      projectId: 'vAb12cd34ef',
      noteId: '20260521-143022-7891',
    };
    expect(isWriteOperation(create)).toBe(true);
    expect(isWriteOperation(read)).toBe(false);
  });
});

describe('response envelopes', () => {
  it('makes success and error envelopes', () => {
    const success = makeSuccessResponse('req-1', { op: 'desktop.revealNote', revealed: true });
    expect(success.ok).toBe(true);
    expect(success.requestId).toBe('req-1');

    const err = makeErrorResponse('req-2', 'REVISION_CONFLICT', 'stale revision', {
      details: { currentRevision: 'sha256:new' },
    });
    expect(err.ok).toBe(false);
    expect(err.error?.code).toBe('REVISION_CONFLICT');
    expect(err.error?.details).toEqual({ currentRevision: 'sha256:new' });
  });

  it('AutomationOperationError carries retryable flag', () => {
    const e = new AutomationOperationError('VAULT_BUSY', 'busy', { retryable: true });
    expect(e.retryable).toBe(true);
    expect(e.code).toBe('VAULT_BUSY');
  });
});
