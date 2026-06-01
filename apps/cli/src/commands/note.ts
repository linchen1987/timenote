import { appendDeleteLog, createNoteOp, deleteNoteOp, updateNoteOp } from '@timenote/core';
import { createNodeFsClient } from '@timenote/core/fs/providers/fs/node';
import type { Command } from 'commander';
import { resolveVaultDir } from '../lib/vault.js';

export function registerNoteCommand(program: Command) {
  const note = program.command('note').description('Manage notes in a vault');

  note
    .command('create')
    .description('Create a new note')
    .option('--content <text>', 'Note content')
    .option('--file <path>', 'Read content from file')
    .option('--tag <tags...>', 'Tags to add')
    .option('--dir <dir>', 'Vault directory')
    .option('--json', 'Output as JSON')
    .action(
      async (opts: {
        content?: string;
        file?: string;
        tag?: string[];
        dir?: string;
        json?: boolean;
      }) => {
        const vaultDir = resolveVaultDir(opts.dir);
        const content = await resolveContent(opts.content, opts.file, opts.tag);
        const transport = createNodeFsClient(vaultDir);
        const noteId = await createNoteOp(transport, content);

        if (opts.json) {
          console.log(JSON.stringify({ id: noteId }));
        } else {
          console.log(noteId);
        }
      },
    );

  note
    .command('update')
    .description('Update an existing note')
    .argument('<noteId>', 'Note ID')
    .option('--content <text>', 'Replace note body')
    .option('--file <path>', 'Read content from file')
    .option('--append <text>', 'Append to note body')
    .option('--dir <dir>', 'Vault directory')
    .action(
      async (
        noteId: string,
        opts: { content?: string; file?: string; append?: string; dir?: string },
      ) => {
        const vaultDir = resolveVaultDir(opts.dir);
        const transport = createNodeFsClient(vaultDir);

        if (opts.content !== undefined) {
          await updateNoteOp(transport, noteId, opts.content);
        } else if (opts.file) {
          const { readFile } = await import('node:fs/promises');
          const content = await readFile(opts.file, 'utf-8');
          await updateNoteOp(transport, noteId, content);
        } else if (opts.append !== undefined) {
          const { readFileSync, existsSync } = await import('node:fs');
          const path = await import('node:path');
          const notePath = `${noteId.slice(0, 4)}-${noteId.slice(4, 6)}/${noteId}.md`;
          const fullPath = path.join(vaultDir, notePath);
          if (!existsSync(fullPath)) {
            console.error(`Note not found: ${noteId}`);
            process.exit(1);
          }
          const raw = readFileSync(fullPath, 'utf-8');
          const fmEnd = raw.indexOf('---', 3);
          const existingBody = fmEnd >= 0 ? raw.slice(fmEnd + 3).trimStart() : raw;
          await updateNoteOp(transport, noteId, existingBody + '\n' + opts.append);
        } else {
          console.error('Provide --content, --file, or --append');
          process.exit(1);
        }

        console.log(`Updated: ${noteId}`);
      },
    );

  note
    .command('delete')
    .description('Delete a note')
    .argument('<noteId>', 'Note ID')
    .option('--dir <dir>', 'Vault directory')
    .action(async (noteId: string, opts: { dir?: string }) => {
      const vaultDir = resolveVaultDir(opts.dir);
      const transport = createNodeFsClient(vaultDir);
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

function appendTags(content: string, tags?: string[]): string {
  if (!tags || tags.length === 0) return content;
  const tagLine = tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  return content.trimEnd() + '\n' + tagLine;
}
