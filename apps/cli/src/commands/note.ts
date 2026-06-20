import {
  appendDeleteLog,
  createFsClient,
  createNoteOp,
  deleteNoteOp,
  updateNoteOp,
} from '@timenote/core';
import type { Command } from 'commander';
import { type RemoteCredentialOptions, resolveRemoteClient } from '../lib/remote-resolver.js';
import { createNoteRemote, updateNoteRemote } from '../lib/remote-write.js';
import { resolveVaultDir } from '../lib/vault.js';

function addRemoteFlags(cmd: Command): Command {
  return cmd
    .option('--remote <url>', 'Operate directly on a remote vault (no local checkout)')
    .option('--access-key-id <id>', 'S3 access key id (overrides URL / stored credentials)')
    .option('--secret-access-key <key>', 'S3 secret access key')
    .option('--region <region>', 'S3 region')
    .option('--password <password>', 'WebDAV password');
}

export function registerNoteCommand(program: Command) {
  const note = program.command('note').description('Manage notes in a vault');

  const create = addRemoteFlags(note.command('create').description('Create a new note'))
    .option('--content <text>', 'Note content')
    .option('--file <path>', 'Read content from file')
    .option('--tag <tags...>', 'Tags to add')
    .option('--dir <dir>', 'Vault directory')
    .option('--json', 'Output as JSON');
  create.action(
    async (
      opts: {
        content?: string;
        file?: string;
        tag?: string[];
        dir?: string;
        json?: boolean;
      } & RemoteCredentialOptions,
    ) => {
      const content = await resolveContent(opts.content, opts.file, opts.tag);

      if (opts.remote) {
        const remote = await resolveRemoteClient(opts);
        const noteId = await createNoteRemote(remote, content);
        if (opts.json) {
          console.log(JSON.stringify({ id: noteId }));
        } else {
          console.log(noteId);
        }
        return;
      }

      const vaultDir = resolveVaultDir(opts.dir);
      const transport = createFsClient({ scheme: 'localfs', rootPath: vaultDir });
      const noteId = await createNoteOp(transport, content);

      if (opts.json) {
        console.log(JSON.stringify({ id: noteId }));
      } else {
        console.log(noteId);
      }
    },
  );

  const update = addRemoteFlags(note.command('update').description('Update an existing note'))
    .argument('<noteId>', 'Note ID')
    .option('--content <text>', 'Replace note body')
    .option('--file <path>', 'Read content from file')
    .option('--append <text>', 'Append to note body')
    .option('--dir <dir>', 'Vault directory');
  update.action(
    async (
      noteId: string,
      opts: {
        content?: string;
        file?: string;
        append?: string;
        dir?: string;
      } & RemoteCredentialOptions,
    ) => {
      const { content, mode } = await resolveUpdateContent(noteId, opts);

      if (opts.remote) {
        const remote = await resolveRemoteClient(opts);
        await updateNoteRemote(remote, noteId, content);
        console.log(`Updated (remote): ${noteId}`);
        return;
      }

      const vaultDir = resolveVaultDir(opts.dir);
      const transport = createFsClient({ scheme: 'localfs', rootPath: vaultDir });
      await updateNoteOp(transport, noteId, content);
      console.log(`${mode}: ${noteId}`);
    },
  );

  note
    .command('delete')
    .description('Delete a note')
    .argument('<noteId>', 'Note ID')
    .option('--dir <dir>', 'Vault directory')
    .action(async (noteId: string, opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const transport = createFsClient({ scheme: 'localfs', rootPath: vaultDir });
      await deleteNoteOp(transport, (id) => appendDeleteLog(transport, id), noteId);
      console.log(`Deleted: ${noteId}`);
    });
}

async function resolveContent(
  content?: string,
  filePath?: string,
  tags?: string[],
): Promise<string> {
  if (content) {
    return appendTags(content, tags);
  }
  if (filePath) {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(filePath, 'utf-8');
    return appendTags(raw, tags);
  }

  if (process.stdin.isTTY) {
    console.error('Provide --content, --file, or pipe content via stdin');
    process.exit(1);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return appendTags(Buffer.concat(chunks).toString('utf-8'), tags);
}

/**
 * Resolve the new body for an update. `--content`/`--file` replace the body;
 * `--append` (local only) appends to the existing body. Returns the resolved
 * content plus a label describing which mode was used.
 */
async function resolveUpdateContent(
  noteId: string,
  opts: { content?: string; file?: string; append?: string; dir?: string },
): Promise<{ content: string; mode: string }> {
  if (opts.content !== undefined) {
    return { content: opts.content, mode: 'Updated' };
  }
  if (opts.file) {
    const { readFile } = await import('node:fs/promises');
    return { content: await readFile(opts.file, 'utf-8'), mode: 'Updated' };
  }
  if (opts.append !== undefined) {
    const { readFileSync, existsSync } = await import('node:fs');
    const path = await import('node:path');
    const notePath = `${noteId.slice(0, 4)}-${noteId.slice(4, 6)}/${noteId}.md`;
    const fullPath = opts.dir ? path.join(opts.dir, notePath) : notePath;
    if (!existsSync(fullPath)) {
      console.error(`Note not found: ${noteId}`);
      process.exit(1);
    }
    const raw = readFileSync(fullPath, 'utf-8');
    const fmEnd = raw.indexOf('---', 3);
    const existingBody = fmEnd >= 0 ? raw.slice(fmEnd + 3).trimStart() : raw;
    return { content: `${existingBody}\n${opts.append}`, mode: 'Updated' };
  }
  console.error('Provide --content, --file, or --append');
  process.exit(1);
}

function appendTags(content: string, tags?: string[]): string {
  if (!tags || tags.length === 0) return content;
  const tagLine = tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  return `${content.trimEnd()}\n${tagLine}`;
}
