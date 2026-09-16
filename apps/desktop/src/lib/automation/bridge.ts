import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { NoteIndex, OperationStatus } from '@timenote/core';
import {
  AUTOMATION_DEFAULT_LIMIT,
  AutomationOperationError,
  type AutomationResponse,
  draftRegistry,
  errorFromUnknown,
  generateNoteId,
  makeErrorResponse,
  makeSuccessResponse,
  type NoteSummary,
  parseAutomationRequest,
} from '@timenote/core';
import { getCurrentNotebookToken } from '../notebook-window';
import { useVaultStore } from '../vault-store';

/**
 * WebView-side automation runtime. Registers this window as the owner of one
 * notebook (or the shared "list" runtime), then serves broker requests by
 * executing them against the same note service the UI uses — writes flow
 * through the guarded (revision CAS) path and notifyNoteChange keeps lists,
 * search and editors in sync.
 */

let pumping = false;

export async function initAutomationBridge(projectId: string | null): Promise<void> {
  try {
    await invoke('automation_register_runtime', { projectId });
  } catch (e) {
    console.warn('[automation] register runtime failed:', e);
    return;
  }

  await listen('automation://wake', () => {
    void pump();
  });

  await listen<{ noteId: string }>('automation://reveal', (event) => {
    const token = getCurrentNotebookToken();
    if (token) {
      window.location.hash = `#/s/${token}/${event.payload.noteId}`;
    }
  });

  await listen<{ projectId: string; noteIds: string[] }>('automation://fs-changed', (event) => {
    void handleFsChanged(event.payload);
  });

  // Notebook windows reconcile once after activation so edits made while the
  // window was closed become visible (index + search + UI).
  if (projectId) {
    void waitForActivation(projectId, 120_000).then(async (active) => {
      if (!active) return;
      try {
        const changed = await useVaultStore.getState().getNoteService().reconcileVault(projectId);
        for (const noteId of changed) {
          const indexed = await useVaultStore.getState().getNoteService().getNoteIndex(noteId);
          const action = indexed ? 'update' : 'delete';
          useVaultStore.getState().notifyNoteChange(projectId, noteId, action);
        }
      } catch (e) {
        console.warn('[automation] reconcile failed:', e);
      }
    });
  }

  void pump();
}

async function handleFsChanged(payload: { projectId: string; noteIds: string[] }): Promise<void> {
  const { projectId, noteIds } = payload;
  if (useVaultStore.getState().activeProjectId !== projectId) return;
  // A huge burst usually means the vault directory was unmounted/moved, not
  // dozens of deliberate edits — skip auto-apply; the next activation
  // reconcile handles genuine state.
  if (noteIds.length > 32) {
    console.warn(
      `[automation] fs burst of ${noteIds.length} notes skipped (suspected directory event)`,
    );
    return;
  }
  const svc = useVaultStore.getState().getNoteService();
  for (const noteId of noteIds) {
    try {
      const outcome = await svc.applyExternalChange(projectId, noteId);
      if (outcome === 'changed') {
        useVaultStore.getState().notifyNoteChange(projectId, noteId, 'update');
      } else if (outcome === 'deleted') {
        useVaultStore.getState().notifyNoteChange(projectId, noteId, 'delete');
      }
    } catch (e) {
      console.warn(`[automation] external change ${noteId} failed:`, e);
    }
  }
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    let entries = await invoke<
      Array<{ kind: string; requestId?: string; request?: unknown; noteId?: string }>
    >('automation_claim_requests');
    while (entries.length > 0) {
      for (const entry of entries) {
        if (entry.kind === 'reveal' && entry.noteId) {
          const token = getCurrentNotebookToken();
          if (token) window.location.hash = `#/s/${token}/${entry.noteId}`;
          continue;
        }
        if (entry.kind === 'operation' && entry.requestId && entry.request) {
          const response = await execute(entry.request);
          try {
            await invoke('automation_complete_request', {
              requestId: entry.requestId,
              response,
            });
          } catch (e) {
            console.warn('[automation] complete request failed:', e);
          }
        }
      }
      entries = await invoke<
        Array<{ kind: string; requestId?: string; request?: unknown; noteId?: string }>
      >('automation_claim_requests');
    }
  } catch (e) {
    console.warn('[automation] pump failed:', e);
  } finally {
    pumping = false;
  }
}

function waitForActivation(
  projectId: string,
  // Must stay comfortably below the broker's READ_TIMEOUT (30s) so the
  // runtime answers (or errors) before the HTTP side gives up on the request.
  timeoutMs = 25_000,
): Promise<boolean> {
  const store = useVaultStore.getState();
  if (store.activeProjectId === projectId) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
    const unsubscribe = useVaultStore.subscribe((state) => {
      if (state.activeProjectId === projectId) {
        clearTimeout(timer);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

async function execute(request: unknown): Promise<AutomationResponse> {
  const parsed = parseAutomationRequest(request);
  if (!parsed.ok) {
    return makeErrorResponse('', 'INVALID_ARGUMENT', parsed.error.message, {
      retryable: false,
    });
  }
  const { request: req } = parsed;
  const op = req.operation;

  try {
    switch (op.op) {
      case 'notes.list': {
        if (!(await waitForActivation(op.projectId))) {
          return makeErrorResponse(
            req.requestId,
            'RUNTIME_NOT_READY',
            'vault not activated in time',
            {
              retryable: true,
            },
          );
        }
        const svc = useVaultStore.getState().getNoteService();
        const limit = op.limit ?? AUTOMATION_DEFAULT_LIMIT;
        const notes = await svc.listNotes({ limit, offset: op.offset ?? 0 });
        const total = await svc.countNotes();
        return makeSuccessResponse(req.requestId, {
          op: 'notes.list',
          notes: notes.map(indexToSummary),
          total,
        });
      }
      case 'notes.search': {
        if (!(await waitForActivation(op.projectId))) {
          return makeErrorResponse(
            req.requestId,
            'RUNTIME_NOT_READY',
            'vault not activated in time',
            {
              retryable: true,
            },
          );
        }
        const svc = useVaultStore.getState().getNoteService();
        const results = await svc.searchNotes(op.query);
        const offset = op.offset ?? 0;
        const limit = op.limit ?? AUTOMATION_DEFAULT_LIMIT;
        return makeSuccessResponse(req.requestId, {
          op: 'notes.search',
          notes: results.slice(offset, offset + limit).map(indexToSummary),
        });
      }
      case 'notes.get': {
        if (!(await waitForActivation(op.projectId))) {
          return makeErrorResponse(
            req.requestId,
            'RUNTIME_NOT_READY',
            'vault not activated in time',
            {
              retryable: true,
            },
          );
        }
        const svc = useVaultStore.getState().getNoteService();
        const snapshot = await svc.getNoteSnapshot(op.projectId, op.noteId);
        if (!snapshot) {
          return makeErrorResponse(req.requestId, 'NOTE_NOT_FOUND', `note not found: ${op.noteId}`);
        }
        return makeSuccessResponse(req.requestId, {
          op: 'notes.get',
          note: {
            noteId: snapshot.noteId,
            title: snapshot.title,
            tags: snapshot.tags,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            body: snapshot.body,
            revision: snapshot.revision,
            attachments: snapshot.attachments.map((a) => ({
              path: a.path,
              ...(a.name ? { name: a.name } : {}),
              ...(a.mime ? { mime: a.mime } : {}),
              ...(a.size != null ? { size: a.size } : {}),
            })),
          },
        });
      }
      case 'notes.create': {
        await ensureActiveForWrite(op.projectId);
        const svc = useVaultStore.getState().getNoteService();
        const enriched = op as typeof op & {
          allocatedNoteId?: string;
          fingerprint?: string;
        };
        let noteId: string | undefined;
        let idempotent = false;
        if (enriched.allocatedNoteId) {
          // retry after a crash: reuse the pre-allocated id; an existing file
          // at that id is this operation's own committed write
          noteId = enriched.allocatedNoteId;
          idempotent = true;
        } else {
          // fresh create: allocate an unused id and persist the prepare
          // record BEFORE any data modification (fail-closed on journal error)
          noteId = generateNoteId();
          let attempts = 0;
          while ((await svc.getNoteSnapshot(op.projectId, noteId)) !== null) {
            noteId = generateNoteId();
            if (++attempts > 8) {
              return makeErrorResponse(req.requestId, 'INTERNAL_ERROR', 'cannot allocate note id');
            }
          }
          if (enriched.fingerprint) {
            try {
              await invoke('automation_prepare_operation', {
                operationId: op.operationId,
                projectId: op.projectId,
                noteId,
                fingerprint: enriched.fingerprint,
              });
            } catch (e) {
              return makeErrorResponse(
                req.requestId,
                'INTERNAL_ERROR',
                `prepare journal failed: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        }
        const created = await svc.createNoteGuarded(op.projectId, op.content, {
          noteId,
          idempotent,
        });
        useVaultStore.getState().notifyNoteChange(op.projectId, created.noteId, 'create');
        return makeSuccessResponse(req.requestId, {
          op: 'notes.create',
          noteId: created.noteId,
          revision: created.revision,
          status: committedStatus(),
        });
      }
      case 'notes.update': {
        await ensureActiveForWrite(op.projectId);
        if (draftRegistry.hasDirtyDraft(op.projectId, op.noteId)) {
          return makeErrorResponse(
            req.requestId,
            'NOTE_HAS_UNSAVED_CHANGES',
            `note ${op.noteId} has unsaved edits in the desktop editor; save or discard them first`,
          );
        }
        const svc = useVaultStore.getState().getNoteService();
        const result = await svc.updateNoteGuarded(
          op.projectId,
          op.noteId,
          { content: op.content, append: op.append },
          op.expectedRevision,
        );
        useVaultStore.getState().notifyNoteChange(op.projectId, op.noteId, 'update');
        return makeSuccessResponse(req.requestId, {
          op: 'notes.update',
          noteId: op.noteId,
          revision: result.revision,
          status: committedStatus(),
        });
      }
      case 'notes.delete': {
        await ensureActiveForWrite(op.projectId);
        if (draftRegistry.hasDirtyDraft(op.projectId, op.noteId)) {
          return makeErrorResponse(
            req.requestId,
            'NOTE_HAS_UNSAVED_CHANGES',
            `note ${op.noteId} has unsaved edits in the desktop editor; save or discard them first`,
          );
        }
        const svc = useVaultStore.getState().getNoteService();
        await svc.deleteNoteGuarded(op.projectId, op.noteId, op.expectedRevision);
        useVaultStore.getState().notifyNoteChange(op.projectId, op.noteId, 'delete');
        return makeSuccessResponse(req.requestId, {
          op: 'notes.delete',
          noteId: op.noteId,
          status: committedStatus(),
        });
      }
      default:
        return makeErrorResponse(
          req.requestId,
          'INVALID_ARGUMENT',
          `op not handled by runtime: ${(op as { op: string }).op}`,
        );
    }
  } catch (e) {
    const err = errorFromUnknown(e);
    return makeErrorResponse(req.requestId, err.code, err.message, {
      retryable: err.retryable,
      details: err.details,
    });
  }
}

async function ensureActiveForWrite(projectId: string): Promise<void> {
  if (!(await waitForActivation(projectId))) {
    throw new AutomationOperationError('RUNTIME_NOT_READY', 'vault not activated in time', {
      retryable: true,
    });
  }
}

function indexToSummary(n: NoteIndex): NoteSummary {
  return {
    noteId: n.id,
    title: n.title,
    tags: n.tags,
    createdAt: new Date(n.created_at).toISOString(),
    updatedAt: new Date(n.updated_at).toISOString(),
  };
}

/** The index refresh and the notifyNoteChange store update both complete
 * before the response is returned; React rendering follows asynchronously. */
function committedStatus(): OperationStatus {
  return { committed: true, indexStatus: 'indexed', uiApplied: true };
}
