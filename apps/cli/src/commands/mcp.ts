import { randomUUID } from 'node:crypto';
import type { AutomationRequest, AutomationResponse } from '@timenote/core';
import type { Command } from 'commander';
import { createDesktopClient } from '../lib/desktop-client.js';

/**
 * `timenote mcp serve` — thin MCP stdio adapter. Tools map 1:1 to the shared
 * automation contracts and reuse DesktopClient; no business logic lives here.
 *
 * stdout carries MCP protocol messages exclusively; diagnostics go to stderr.
 */

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, string>;
  // `never` param keeps concrete typed handlers assignable (contravariance);
  // the single call site casts the parsed args per tool.
  operation: (args: never) => AutomationRequest['operation'];
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'timenote_status',
    description:
      'Show TimeNote Desktop automation status (app version, open notebook runtimes). No parameters.',
    inputSchema: {},
    operation: () => ({ op: 'desktop.status' }) as const,
  },
  {
    name: 'timenote_list_notebooks',
    description:
      'List notebooks registered on this machine. Returns stable projectId values used by all other tools.',
    inputSchema: {},
    operation: () => ({ op: 'notebooks.list' }) as const,
  },
  {
    name: 'timenote_list_notes',
    description:
      'List notes in a notebook, newest first. Returns summaries without bodies; use timenote_get_note to read content and revision.',
    inputSchema: {
      projectId: 'notebook projectId from timenote_list_notebooks',
      limit: 'optional page size (default 50, max 200)',
      offset: 'optional page offset',
    },
    operation: (args: { projectId: string; limit?: number; offset?: number }) =>
      ({
        op: 'notes.list',
        projectId: args.projectId,
        limit: args.limit,
        offset: args.offset,
      }) as const,
  },
  {
    name: 'timenote_search_notes',
    description: 'Full-text/tag search within a notebook. Query syntax supports #tag filters.',
    inputSchema: {
      projectId: 'notebook projectId',
      query: 'search query',
      limit: 'optional result cap (default 50, max 200)',
    },
    operation: (args: { projectId: string; query: string; limit?: number }) =>
      ({
        op: 'notes.search',
        projectId: args.projectId,
        query: args.query,
        limit: args.limit,
      }) as const,
  },
  {
    name: 'timenote_get_note',
    description:
      'Read one note: body, tags, attachments and the current revision. The revision is required for update/delete (CAS).',
    inputSchema: {
      projectId: 'notebook projectId',
      noteId: 'note id',
    },
    operation: (args: { projectId: string; noteId: string }) =>
      ({ op: 'notes.get', projectId: args.projectId, noteId: args.noteId }) as const,
  },
  {
    name: 'timenote_create_note',
    description:
      'Create a note. Optionally pass operationId (uuid) to make retries idempotent; reuse the same operationId after timeouts, never generate a new one for the same logical write.',
    inputSchema: {
      projectId: 'notebook projectId',
      content: 'markdown body',
      operationId: 'optional idempotency key (uuid)',
    },
    operation: (args: { projectId: string; content: string; operationId?: string }) =>
      ({
        op: 'notes.create',
        projectId: args.projectId,
        content: args.content,
        operationId: args.operationId ?? `op-${randomUUID()}`,
      }) as const,
  },
  {
    name: 'timenote_update_note',
    description:
      'Update a note with optimistic concurrency: expectedRevision must be the revision from a previous timenote_get_note. Provide content (replace) or append. On REVISION_CONFLICT re-read the note first.',
    inputSchema: {
      projectId: 'notebook projectId',
      noteId: 'note id',
      expectedRevision: 'revision read via timenote_get_note',
      content: 'optional replacement body',
      append: 'optional text appended to the body',
      operationId: 'optional idempotency key (uuid)',
    },
    operation: (args: {
      projectId: string;
      noteId: string;
      expectedRevision: string;
      content?: string;
      append?: string;
      operationId?: string;
    }) =>
      ({
        op: 'notes.update',
        projectId: args.projectId,
        noteId: args.noteId,
        expectedRevision: args.expectedRevision,
        content: args.content,
        append: args.append,
        operationId: args.operationId ?? `op-${randomUUID()}`,
      }) as const,
  },
  {
    name: 'timenote_delete_note',
    description:
      'Delete a note with optimistic concurrency (expectedRevision required). Fails with NOTE_HAS_UNSAVED_CHANGES while the user has unsaved edits open.',
    inputSchema: {
      projectId: 'notebook projectId',
      noteId: 'note id',
      expectedRevision: 'revision read via timenote_get_note',
      operationId: 'optional idempotency key (uuid)',
    },
    operation: (args: {
      projectId: string;
      noteId: string;
      expectedRevision: string;
      operationId?: string;
    }) =>
      ({
        op: 'notes.delete',
        projectId: args.projectId,
        noteId: args.noteId,
        expectedRevision: args.expectedRevision,
        operationId: args.operationId ?? `op-${randomUUID()}`,
      }) as const,
  },
  {
    name: 'timenote_reveal_note',
    description:
      'Open a note in the TimeNote Desktop window (the only operation that focuses the app). Use after creating a summary the user should see.',
    inputSchema: {
      projectId: 'notebook projectId',
      noteId: 'note id',
    },
    operation: (args: { projectId: string; noteId: string }) =>
      ({ op: 'desktop.revealNote', projectId: args.projectId, noteId: args.noteId }) as const,
  },
];

export async function createMcpServer(): Promise<
  InstanceType<typeof import('@modelcontextprotocol/sdk/server/mcp.js')['McpServer']>
> {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { z } = await import('zod');

  const server = new McpServer({ name: 'timenote', version: '0.1.0' });
  let cachedClient: Awaited<ReturnType<typeof createDesktopClient>> | null = null;

  async function getClient() {
    // recreate when the desktop restarts (new descriptor/instance)
    if (!cachedClient) {
      cachedClient = await createDesktopClient();
    }
    return cachedClient;
  }

  function invalidateClient() {
    cachedClient = null;
  }

  for (const tool of TOOL_DEFINITIONS) {
    const schema: Record<string, import('zod').ZodTypeAny> = {};
    for (const [key, description] of Object.entries(tool.inputSchema)) {
      const optional = description.startsWith('optional');
      schema[key] = optional
        ? z.string().optional().describe(description)
        : z.string().describe(description);
    }
    // numeric fields stay numeric on the wire
    if ('limit' in schema)
      schema.limit = z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe(tool.inputSchema.limit ?? '');
    if ('offset' in schema)
      schema.offset = z.number().int().min(0).optional().describe('page offset');

    const buildOperation = tool.operation;
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: schema },
      async (args: Record<string, unknown>) => {
        const request: AutomationRequest = {
          protocolVersion: 1,
          requestId: `mcp-${randomUUID()}`,
          operation: buildOperation(args as never) as AutomationRequest['operation'],
        };
        let response: AutomationResponse;
        try {
          const client = await getClient();
          response = await client.execute(request);
        } catch (e) {
          invalidateClient();
          const message = e instanceof Error ? e.message : String(e);
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  ok: false,
                  error: { code: 'DESKTOP_UNAVAILABLE', message },
                }),
              },
            ],
          };
        }
        if (!response.ok) {
          // desktop restarts invalidate the cached client; drop it for the next call
          if (
            response.error?.code === 'DESKTOP_UNAVAILABLE' ||
            response.error?.code === 'PROTOCOL_MISMATCH'
          ) {
            invalidateClient();
          }
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ ok: false, error: response.error }),
              },
            ],
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(response.result ?? null) }],
        };
      },
    );
  }

  return server;
}

export async function runMcpServe(): Promise<void> {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[timenote-mcp] serving on stdio');
}

export function registerMcpCommand(program: Command) {
  const mcp = program.command('mcp').description('MCP stdio adapter for AI agent clients');
  mcp
    .command('serve')
    .description('Run the MCP stdio server (protocol on stdout, logs on stderr)')
    .action(async () => {
      await runMcpServe();
    });
}
