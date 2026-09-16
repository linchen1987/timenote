import { z } from 'zod';
import { NoteIdSchema } from '../spec/note';

/**
 * Automation contracts shared by the Desktop server, WebView runtime and CLI.
 * Pure data + zod schemas only: no React, Tauri or Node imports allowed here.
 */

export const AUTOMATION_PROTOCOL_VERSION = 1;

// No format constraint beyond non-empty/length: projectId is opaque and owned
// by the manifest, so automation must not invent its own rules for it.
export const ProjectIdSchema = z.string().min(1).max(128);

export const AUTOMATION_DEFAULT_LIMIT = 50;
export const AUTOMATION_MAX_LIMIT = 200;

// ─── Errors ─────────────────────────────────────────────────────

export const AUTOMATION_ERROR_CODES = [
  'INVALID_ARGUMENT',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOTEBOOK_NOT_FOUND',
  'NOTE_NOT_FOUND',
  'REVISION_CONFLICT',
  'NOTE_HAS_UNSAVED_CHANGES',
  'VAULT_BUSY',
  'DESKTOP_UNAVAILABLE',
  'RUNTIME_NOT_READY',
  'PROTOCOL_MISMATCH',
  'OPERATION_ID_REUSED',
  'OUTCOME_UNKNOWN',
  'INTERNAL_ERROR',
] as const;

export type AutomationErrorCode = (typeof AUTOMATION_ERROR_CODES)[number];

export interface AutomationErrorOptions {
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export class AutomationOperationError extends Error {
  readonly code: AutomationErrorCode;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: AutomationErrorCode, message: string, options?: AutomationErrorOptions) {
    super(message);
    this.name = 'AutomationOperationError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface AutomationErrorBody {
  code: AutomationErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// ─── Operation requests ─────────────────────────────────────────

const LimitSchema = z.number().int().min(1).max(AUTOMATION_MAX_LIMIT).optional();

export const WriteOperationIdSchema = z.string().min(8).max(128);

export const DesktopStatusOperationSchema = z.object({ op: z.literal('desktop.status') });

export const NotebooksListOperationSchema = z.object({ op: z.literal('notebooks.list') });

export const NotesListOperationSchema = z.object({
  op: z.literal('notes.list'),
  projectId: ProjectIdSchema,
  limit: LimitSchema,
  offset: z.number().int().min(0).optional(),
});

export const NotesSearchOperationSchema = z.object({
  op: z.literal('notes.search'),
  projectId: ProjectIdSchema,
  query: z.string().min(1).max(512),
  limit: LimitSchema,
  offset: z.number().int().min(0).optional(),
});

export const NotesGetOperationSchema = z.object({
  op: z.literal('notes.get'),
  projectId: ProjectIdSchema,
  noteId: NoteIdSchema,
});

export const NotesCreateOperationSchema = z.object({
  op: z.literal('notes.create'),
  projectId: ProjectIdSchema,
  content: z.string().max(2_000_000),
  operationId: WriteOperationIdSchema,
  /** Server-set: pre-allocated noteId from the prepare journal (crash-safe
   * idempotent replay). Never set by clients. */
  allocatedNoteId: NoteIdSchema.optional(),
  /** Server-set: operation fingerprint the runtime persists in the prepare
   * journal before first write. Never set by clients. */
  fingerprint: z.string().max(64).optional(),
});

export const NotesUpdateOperationSchema = z
  .object({
    op: z.literal('notes.update'),
    projectId: ProjectIdSchema,
    noteId: NoteIdSchema,
    content: z.string().max(2_000_000).optional(),
    append: z.string().max(2_000_000).optional(),
    expectedRevision: z.string().min(7).max(120),
    operationId: WriteOperationIdSchema,
  })
  .refine((v) => v.content !== undefined || v.append !== undefined, {
    message: 'one of content or append is required',
  });

export const NotesDeleteOperationSchema = z.object({
  op: z.literal('notes.delete'),
  projectId: ProjectIdSchema,
  noteId: NoteIdSchema,
  expectedRevision: z.string().min(7).max(120),
  operationId: WriteOperationIdSchema,
});

export const DesktopRevealNoteOperationSchema = z.object({
  op: z.literal('desktop.revealNote'),
  projectId: ProjectIdSchema,
  noteId: NoteIdSchema,
});

export const AutomationOperationSchema = z.discriminatedUnion('op', [
  DesktopStatusOperationSchema,
  NotebooksListOperationSchema,
  NotesListOperationSchema,
  NotesSearchOperationSchema,
  NotesGetOperationSchema,
  NotesCreateOperationSchema,
  NotesUpdateOperationSchema,
  NotesDeleteOperationSchema,
  DesktopRevealNoteOperationSchema,
]);

export type AutomationOperation = z.infer<typeof AutomationOperationSchema>;

export type WriteOperation = Extract<
  AutomationOperation,
  { op: 'notes.create' | 'notes.update' | 'notes.delete' }
>;

export function isWriteOperation(op: AutomationOperation): op is WriteOperation {
  return op.op === 'notes.create' || op.op === 'notes.update' || op.op === 'notes.delete';
}

export const AutomationRequestSchema = z.object({
  protocolVersion: z.literal(AUTOMATION_PROTOCOL_VERSION),
  requestId: z.string().min(6).max(128),
  operation: AutomationOperationSchema,
});

export type AutomationRequest = z.infer<typeof AutomationRequestSchema>;

// ─── Operation results ──────────────────────────────────────────

export interface OperationStatus {
  committed: boolean;
  indexStatus: 'indexed' | 'pending' | 'not_applicable';
  uiApplied: boolean;
}

export interface NoteAttachmentRef {
  path: string;
  name?: string;
  mime?: string;
  size?: number;
}

export interface NoteSummary {
  noteId: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteContent extends NoteSummary {
  body: string;
  revision: string;
  attachments: NoteAttachmentRef[];
}

export interface NotebookInfo {
  projectId: string;
  name: string;
  open: boolean;
}

export type AutomationResult =
  | {
      op: 'desktop.status';
      appVersion: string;
      protocolVersion: number;
      instanceId: string;
      runtimes: { runtimeId: string; projectId: string | null; open: boolean }[];
    }
  | { op: 'notebooks.list'; notebooks: NotebookInfo[] }
  | { op: 'notes.list'; notes: NoteSummary[]; total: number }
  | { op: 'notes.search'; notes: NoteSummary[] }
  | { op: 'notes.get'; note: NoteContent | null }
  | { op: 'notes.create'; noteId: string; revision: string; status: OperationStatus }
  | { op: 'notes.update'; noteId: string; revision: string; status: OperationStatus }
  | { op: 'notes.delete'; noteId: string; status: OperationStatus }
  | { op: 'desktop.revealNote'; revealed: boolean };

// ─── Response envelope ──────────────────────────────────────────

const AutomationErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const AutomationResponseSchema = z.object({
  protocolVersion: z.number(),
  requestId: z.string(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: AutomationErrorBodySchema.optional(),
});

export interface AutomationResponse {
  protocolVersion: number;
  requestId: string;
  ok: boolean;
  result?: AutomationResult;
  error?: AutomationErrorBody;
}

export function makeSuccessResponse(
  requestId: string,
  result: AutomationResult,
): AutomationResponse {
  return { protocolVersion: AUTOMATION_PROTOCOL_VERSION, requestId, ok: true, result };
}

export function makeErrorResponse(
  requestId: string,
  code: AutomationErrorCode,
  message: string,
  options?: AutomationErrorOptions,
): AutomationResponse {
  return {
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId,
    ok: false,
    error: {
      code,
      message,
      retryable: options?.retryable ?? false,
      ...(options?.details ? { details: options.details } : {}),
    },
  };
}

export function errorFromUnknown(e: unknown): AutomationOperationError {
  if (e instanceof AutomationOperationError) return e;
  const message = e instanceof Error ? e.message : String(e);
  return new AutomationOperationError('INTERNAL_ERROR', message);
}

// ─── Wire helpers (JSON string variants for CLI validation) ─────

export function parseAutomationRequest(
  data: unknown,
): { ok: true; request: AutomationRequest } | { ok: false; error: AutomationErrorBody } {
  const parsed = AutomationRequestSchema.safeParse(data);
  if (parsed.success) return { ok: true, request: parsed.data };
  const message = parsed.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  return {
    ok: false,
    error: {
      code: 'INVALID_ARGUMENT',
      message,
      retryable: false,
    },
  };
}
