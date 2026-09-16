import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  AUTOMATION_DEFAULT_LIMIT,
  AUTOMATION_PROTOCOL_VERSION,
  type AutomationRequest,
} from '@timenote/core';
import type { Command } from 'commander';
import {
  createDesktopClient,
  DesktopCliError,
  readDescriptor,
  responseToError,
} from '../lib/desktop-client.js';

function newRequestId(): string {
  return `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newOperationId(): string {
  return `op-${randomUUID()}`;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function resolveContent(
  content: string | undefined,
  file: string | undefined,
): Promise<string> {
  if (content !== undefined) return content;
  if (file === '-') return readStdin();
  if (file !== undefined) return readFileSync(file, 'utf-8');
  if (!process.stdin.isTTY) return readStdin();
  throw new DesktopCliError('CLI_ERROR', 'provide --content, --file <path> (or - for stdin)');
}

async function run(
  operation: AutomationRequest['operation'],
  opts: { json?: boolean },
): Promise<void> {
  const client = await createDesktopClient();
  const response = await client.execute({
    protocolVersion: AUTOMATION_PROTOCOL_VERSION,
    requestId: newRequestId(),
    operation,
  });
  if (!response.ok) {
    throw responseToError(response);
  }
  if (opts.json) {
    console.log(JSON.stringify(response.result ?? null, null, 2));
  } else if (response.result) {
    printHuman(response.result);
  }
}

function printHuman(result: unknown): void {
  const r = result as Record<string, unknown>;
  switch (r.op) {
    case 'desktop.status':
      console.log(`TimeNote Desktop v${r.appVersion} · protocol v${r.protocolVersion}`);
      for (const runtime of (r.runtimes ?? []) as Array<Record<string, unknown>>) {
        console.log(`  runtime ${runtime.runtimeId}${runtime.open ? ' (open)' : ''}`);
      }
      break;
    case 'notebooks.list':
      for (const nb of (r.notebooks ?? []) as Array<Record<string, unknown>>) {
        console.log(`${nb.projectId}  ${nb.open ? '[open]' : '      '}  ${nb.name}`);
      }
      break;
    case 'notes.list':
    case 'notes.search':
      for (const note of (r.notes ?? []) as Array<Record<string, unknown>>) {
        const tags =
          Array.isArray(note.tags) && note.tags.length > 0
            ? `  #${(note.tags as string[]).join(' #')}`
            : '';
        console.log(
          `${note.noteId}  ${String(note.updatedAt).slice(0, 19)}  ${note.title || '(untitled)'}${tags}`,
        );
      }
      if (r.op === 'notes.list')
        console.log(`total: ${r.total ?? (r.notes as unknown[])?.length ?? 0}`);
      break;
    case 'notes.get': {
      const note = r.note as Record<string, unknown> | null;
      if (!note) {
        console.log('(not found)');
        break;
      }
      console.log(`--- ${note.noteId} (revision ${note.revision}) ---`);
      console.log(String(note.body));
      break;
    }
    case 'notes.create':
      console.log(`created ${r.noteId} (revision ${r.revision})`);
      break;
    case 'notes.update':
      console.log(`updated ${r.noteId} (revision ${r.revision})`);
      break;
    case 'notes.delete':
      console.log(`deleted ${r.noteId}`);
      break;
    case 'desktop.revealNote':
      console.log(r.revealed ? 'revealed' : 'not revealed');
      break;
    default:
      console.log(JSON.stringify(result, null, 2));
  }
}

export function registerDesktopCommand(program: Command) {
  const desktop = program
    .command('desktop')
    .description('Control a running TimeNote Desktop instance');

  desktop
    .command('status')
    .description('Show desktop automation status')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      if (!readDescriptor()) {
        const message =
          'TimeNote Desktop is not reachable. Start the app and enable "Agent 连接" in Settings.';
        if (opts.json) {
          console.log(
            JSON.stringify({ ok: false, error: { code: 'DESKTOP_UNAVAILABLE', message } }, null, 2),
          );
        } else {
          console.error(message);
        }
        process.exitCode = 4;
        return;
      }
      await run({ op: 'desktop.status' }, opts);
    });

  const notebooks = desktop.command('notebooks').description('List notebooks');
  notebooks
    .command('list')
    .description('List notebooks registered on this machine')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      await run({ op: 'notebooks.list' }, opts);
    });

  const note = desktop
    .command('note')
    .description('Note operations against a running desktop (agent-safe, revision-guarded)');

  note
    .command('list')
    .description('List notes in a notebook')
    .requiredOption('--notebook <projectId>', 'Notebook projectId (see desktop notebooks list)')
    .option('--limit <n>', 'Page size', String(AUTOMATION_DEFAULT_LIMIT))
    .option('--offset <n>', 'Page offset', '0')
    .option('--json', 'Output as JSON')
    .action(async (opts: { notebook: string; limit?: string; offset?: string; json?: boolean }) => {
      await run(
        {
          op: 'notes.list',
          projectId: opts.notebook,
          limit: Math.min(Number(opts.limit) || AUTOMATION_DEFAULT_LIMIT, 200),
          offset: Number(opts.offset) || 0,
        },
        opts,
      );
    });

  note
    .command('search')
    .description('Search notes')
    .requiredOption('--notebook <projectId>', 'Notebook projectId')
    .requiredOption('--query <query>', 'Search query')
    .option('--limit <n>', 'Page size', String(AUTOMATION_DEFAULT_LIMIT))
    .option('--json', 'Output as JSON')
    .action(async (opts: { notebook: string; query: string; limit?: string; json?: boolean }) => {
      await run(
        {
          op: 'notes.search',
          projectId: opts.notebook,
          query: opts.query,
          limit: Math.min(Number(opts.limit) || AUTOMATION_DEFAULT_LIMIT, 200),
        },
        opts,
      );
    });

  note
    .command('get <noteId>')
    .description('Read a note with its revision')
    .requiredOption('--notebook <projectId>', 'Notebook projectId')
    .option('--json', 'Output as JSON')
    .action(async (noteId: string, opts: { notebook: string; json?: boolean }) => {
      await run({ op: 'notes.get', projectId: opts.notebook, noteId }, opts);
    });

  note
    .command('create')
    .description('Create a note (content via --content, --file or stdin)')
    .requiredOption('--notebook <projectId>', 'Notebook projectId')
    .option('--content <text>', 'Note content')
    .option('--file <path>', 'Read content from file ("-" for stdin)')
    .option('--operation-id <id>', 'Stable operation id for safe retries')
    .option('--json', 'Output as JSON')
    .action(
      async (opts: {
        notebook: string;
        content?: string;
        file?: string;
        operationId?: string;
        json?: boolean;
      }) => {
        const content = await resolveContent(opts.content, opts.file);
        await run(
          {
            op: 'notes.create',
            projectId: opts.notebook,
            content,
            operationId: opts.operationId ?? newOperationId(),
          },
          opts,
        );
      },
    );

  note
    .command('update <noteId>')
    .description('Update a note (CAS: requires the revision from `note get`)')
    .requiredOption('--notebook <projectId>', 'Notebook projectId')
    .requiredOption('--if-revision <revision>', 'Revision previously read via note get')
    .option('--content <text>', 'Replace note body')
    .option('--append <text>', 'Append to note body')
    .option('--file <path>', 'Replace body with file content ("-" for stdin)')
    .option('--operation-id <id>', 'Stable operation id for safe retries')
    .option('--json', 'Output as JSON')
    .action(
      async (
        noteId: string,
        opts: {
          notebook: string;
          ifRevision: string;
          content?: string;
          append?: string;
          file?: string;
          operationId?: string;
          json?: boolean;
        },
      ) => {
        if (opts.file !== undefined && (opts.content !== undefined || opts.append !== undefined)) {
          throw new DesktopCliError(
            'CLI_ERROR',
            '--file cannot be combined with --content/--append',
          );
        }
        const operation: AutomationRequest['operation'] = {
          op: 'notes.update',
          projectId: opts.notebook,
          noteId,
          expectedRevision: opts.ifRevision,
          operationId: opts.operationId ?? newOperationId(),
          ...(opts.file !== undefined
            ? { content: await resolveContent(undefined, opts.file) }
            : {}),
          ...(opts.content !== undefined ? { content: opts.content } : {}),
          ...(opts.append !== undefined ? { append: opts.append } : {}),
        };
        await run(operation, opts);
      },
    );

  note
    .command('delete <noteId>')
    .description('Delete a note (CAS: requires the revision from `note get`)')
    .requiredOption('--notebook <projectId>', 'Notebook projectId')
    .requiredOption('--if-revision <revision>', 'Revision previously read via note get')
    .option('--operation-id <id>', 'Stable operation id for safe retries')
    .option('--json', 'Output as JSON')
    .action(
      async (
        noteId: string,
        opts: { notebook: string; ifRevision: string; operationId?: string; json?: boolean },
      ) => {
        await run(
          {
            op: 'notes.delete',
            projectId: opts.notebook,
            noteId,
            expectedRevision: opts.ifRevision,
            operationId: opts.operationId ?? newOperationId(),
          },
          opts,
        );
      },
    );

  note
    .command('reveal <noteId>')
    .description('Open the note in the desktop app (focuses the window)')
    .requiredOption('--notebook <projectId>', 'Notebook projectId')
    .option('--json', 'Output as JSON')
    .action(async (noteId: string, opts: { notebook: string; json?: boolean }) => {
      await run({ op: 'desktop.revealNote', projectId: opts.notebook, noteId }, opts);
    });

  const operationCmd = desktop.command('operation').description('Query operation results');
  operationCmd
    .command('get <operationId>')
    .description('Fetch the recorded result of a previous write operation')
    .option('--json', 'Output as JSON')
    .action(async (operationId: string, opts: { json?: boolean }) => {
      const client = await createDesktopClient();
      const response = await client.getOperation(operationId);
      if (!response.ok) {
        throw responseToError(response);
      }
      if (opts.json) {
        console.log(JSON.stringify(response.result ?? null, null, 2));
      } else {
        printHuman(response.result);
      }
    });
}

export { DesktopCliError };
