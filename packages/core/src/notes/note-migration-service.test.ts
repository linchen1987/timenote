import { describe, expect, it } from 'vitest';
import type { FsClient } from '../fs/types';
import { serializeNote } from '../spec/note';
import { metaPath, noteFilePath } from '../spec/vault-layout';
import { createMemoryProvider } from '../test/memory-fs';
import { initVault } from '../vault/vault-ops';
import type { VaultMeta, VaultService } from '../vault/vault-service';
import { createVaultNoteMigrationService } from './note-migration-service';

const SOURCE_ID = '20260804-123456-7890';

async function createVaults(): Promise<{
  source: FsClient;
  target: FsClient;
  service: VaultService;
}> {
  const source = createMemoryProvider();
  const target = createMemoryProvider();
  await initVault(source, 'source', 'Source');
  await initVault(target, 'target', 'Target');
  const vaults: VaultMeta[] = [
    { projectId: 'source', name: 'Source' },
    { projectId: 'target', name: 'Target' },
  ];
  return {
    source,
    target,
    service: {
      createVault: async () => '',
      createVaultWithId: async () => {},
      deleteVault: async () => {},
      listVaults: async () => vaults,
      getLocalClient: async (projectId) => (projectId === 'source' ? source : target),
    },
  };
}

describe('VaultNoteMigrationService', () => {
  it('moves the raw note and its attachments without changing its content or dates', async () => {
    const { source, target, service } = await createVaults();
    const attachmentPath = 'assets/ab/abcdef.png';
    const raw = serializeNote(
      {
        created_at: '2024-01-02T03:04:05.000Z',
        updated_at: '2025-06-07T08:09:10.000Z',
        title: 'Original title',
        attachments: [{ path: attachmentPath, name: 'image.png' }],
      },
      'Original body',
    );
    await source.write(noteFilePath(SOURCE_ID), raw);
    await source.writeBinary(attachmentPath, new Uint8Array([1, 2, 3]).buffer);

    const result = await createVaultNoteMigrationService(service).migrateNote({
      sourceProjectId: 'source',
      targetProjectId: 'target',
      noteId: SOURCE_ID,
    });

    expect(result).toEqual({ status: 'completed', targetNoteId: SOURCE_ID });
    await expect(source.exists(noteFilePath(SOURCE_ID))).resolves.toBe(false);
    await expect(target.read(noteFilePath(SOURCE_ID))).resolves.toBe(raw);
    await expect(target.readBinary(attachmentPath)).resolves.toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
    await expect(source.exists(attachmentPath)).resolves.toBe(false);
    await expect(source.read(metaPath('deleteLog'))).resolves.toContain(SOURCE_ID);
  });

  it('allocates another random digit when the target note ID already exists', async () => {
    const { source, target, service } = await createVaults();
    const raw = serializeNote(
      { created_at: '2024-01-02T03:04:05.000Z', updated_at: '2025-06-07T08:09:10.000Z' },
      'Original body',
    );
    await source.write(noteFilePath(SOURCE_ID), raw);
    await target.write(noteFilePath(SOURCE_ID), raw);

    const result = await createVaultNoteMigrationService(service).migrateNote({
      sourceProjectId: 'source',
      targetProjectId: 'target',
      noteId: SOURCE_ID,
    });

    expect(result.status).toBe('completed');
    expect(result.targetNoteId).not.toBe(SOURCE_ID);
    expect(result.targetNoteId.slice(0, -1)).toBe(SOURCE_ID.slice(0, -1));
    await expect(target.read(noteFilePath(result.targetNoteId))).resolves.toBe(raw);
  });

  it('does not alter the source when no target ID is available', async () => {
    const { source, target, service } = await createVaults();
    const raw = serializeNote(
      { created_at: '2024-01-02T03:04:05.000Z', updated_at: '2025-06-07T08:09:10.000Z' },
      'Original body',
    );
    await source.write(noteFilePath(SOURCE_ID), raw);
    for (let digit = 0; digit < 10; digit += 1) {
      await target.write(noteFilePath(`${SOURCE_ID.slice(0, -1)}${digit}`), raw);
    }

    await expect(
      createVaultNoteMigrationService(service).migrateNote({
        sourceProjectId: 'source',
        targetProjectId: 'target',
        noteId: SOURCE_ID,
      }),
    ).rejects.toThrow('no available note ID');
    await expect(source.read(noteFilePath(SOURCE_ID))).resolves.toBe(raw);
  });
});
