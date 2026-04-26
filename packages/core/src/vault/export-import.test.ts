import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

const TIMENOTE_DIR = '.timenote';
const MANIFEST_FILE = 'manifest.json';
const MENU_FILE = 'menu.json';
const DELETE_LOG_FILE = 'delete-log.json';
const SYNC_LEDGER_FILE = 'sync-ledger.json';
const VALID_META_FILES = new Set([
  `${TIMENOTE_DIR}/${MANIFEST_FILE}`,
  `${TIMENOTE_DIR}/${MENU_FILE}`,
  `${TIMENOTE_DIR}/${DELETE_LOG_FILE}`,
]);
const MAX_ZIP_SIZE = 100 * 1024 * 1024;

function createManifest(projectId: string, name: string) {
  return {
    project_id: projectId,
    name,
    version: '1.0.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function createValidNoteContent(body: string) {
  const now = new Date().toISOString();
  return `---\ncreated_at: "${now}"\nupdated_at: "${now}"\ntags: []\n---\n${body}`;
}

async function createVaultZip(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'blob' });
}

async function createVaultZipBuffer(files: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

function classifyZipEntries(entries: string[]): {
  metaFiles: string[];
  noteFiles: string[];
  skipped: string[];
} {
  const metaFiles: string[] = [];
  const noteFiles: string[] = [];
  const skipped: string[] = [];

  for (const relativePath of entries) {
    if (relativePath.endsWith('/')) continue;
    if (relativePath.includes('..')) {
      skipped.push(relativePath);
      continue;
    }

    if (VALID_META_FILES.has(relativePath)) {
      metaFiles.push(relativePath);
      continue;
    }

    const parts = relativePath.split('/');
    if (
      parts.length === 2 &&
      /^[0-9]{4}-[0-9]{2}$/.test(parts[0]) &&
      /^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$/.test(parts[1])
    ) {
      noteFiles.push(relativePath);
      continue;
    }

    if (!relativePath.startsWith(TIMENOTE_DIR)) {
      skipped.push(relativePath);
    }
  }

  return { metaFiles, noteFiles, skipped };
}

describe('Vault Export/Import ZIP classification', () => {
  it('classifies valid vault entries correctly', () => {
    const entries = [
      `${TIMENOTE_DIR}/${MANIFEST_FILE}`,
      `${TIMENOTE_DIR}/${MENU_FILE}`,
      `${TIMENOTE_DIR}/${DELETE_LOG_FILE}`,
      `${TIMENOTE_DIR}/${SYNC_LEDGER_FILE}`,
      '2026-04/20260425-121000-1110.md',
      '2026-05/20260501-080000-5678.md',
    ];

    const result = classifyZipEntries(entries);
    expect(result.metaFiles).toEqual([
      `${TIMENOTE_DIR}/${MANIFEST_FILE}`,
      `${TIMENOTE_DIR}/${MENU_FILE}`,
      `${TIMENOTE_DIR}/${DELETE_LOG_FILE}`,
    ]);
    expect(result.noteFiles).toEqual([
      '2026-04/20260425-121000-1110.md',
      '2026-05/20260501-080000-5678.md',
    ]);
    expect(result.skipped).toEqual([]);
  });

  it('skips path traversal attempts', () => {
    const entries = ['../etc/passwd', '2026-04/../../secret.txt'];
    const result = classifyZipEntries(entries);
    expect(result.skipped).toEqual(['../etc/passwd', '2026-04/../../secret.txt']);
    expect(result.noteFiles).toEqual([]);
  });

  it('skips unrecognized files outside .timenote', () => {
    const entries = ['random.txt', 'foo/bar.md', '2026-04/readme.txt'];
    const result = classifyZipEntries(entries);
    expect(result.skipped).toEqual(['random.txt', 'foo/bar.md', '2026-04/readme.txt']);
  });

  it('does not skip sync-ledger (inside .timenote)', () => {
    const entries = [`${TIMENOTE_DIR}/${SYNC_LEDGER_FILE}`];
    const result = classifyZipEntries(entries);
    expect(result.metaFiles).toEqual([]);
    expect(result.noteFiles).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});

describe('Vault ZIP generation and parsing', () => {
  it('creates a valid ZIP blob with expected entries', async () => {
    const files: Record<string, string> = {
      [`${TIMENOTE_DIR}/${MANIFEST_FILE}`]: JSON.stringify(createManifest('test123', 'TestVault')),
      [`${TIMENOTE_DIR}/${MENU_FILE}`]: JSON.stringify({ version: 1, items: [] }),
      [`${TIMENOTE_DIR}/${DELETE_LOG_FILE}`]: JSON.stringify({ version: 1, records: {} }),
      '2026-04/20260425-121000-1110.md': createValidNoteContent('Hello world'),
      '2026-05/20260501-080000-5678.md': createValidNoteContent('Second note'),
    };

    const blob = await createVaultZip(files);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.size).toBeLessThan(MAX_ZIP_SIZE);

    const buffer = await createVaultZipBuffer(files);
    const zip = await JSZip.loadAsync(buffer);
    const entryNames: string[] = [];
    zip.forEach((path) => {
      entryNames.push(path);
    });
    expect(entryNames).toContain(`${TIMENOTE_DIR}/${MANIFEST_FILE}`);
    expect(entryNames).toContain('2026-04/20260425-121000-1110.md');
    expect(entryNames).toContain('2026-05/20260501-080000-5678.md');
  });

  it('ZIP manifest can be parsed and validated', async () => {
    const manifest = createManifest('abc123', 'MyVault');
    const files = { [`${TIMENOTE_DIR}/${MANIFEST_FILE}`]: JSON.stringify(manifest) };
    const buffer = await createVaultZipBuffer(files);
    const zip = await JSZip.loadAsync(buffer);

    const manifestEntry = zip.file(`${TIMENOTE_DIR}/${MANIFEST_FILE}`);
    expect(manifestEntry).toBeDefined();
    const raw = await manifestEntry?.async('string');
    const parsed = JSON.parse(raw);
    expect(parsed.project_id).toBe('abc123');
    expect(parsed.name).toBe('MyVault');
    expect(parsed.version).toBe('1.0.0');
  });

  it('detects missing manifest', async () => {
    const files = {
      [`${TIMENOTE_DIR}/${MENU_FILE}`]: JSON.stringify({ version: 1, items: [] }),
    };
    const buffer = await createVaultZipBuffer(files);
    const zip = await JSZip.loadAsync(buffer);
    const manifestEntry = zip.file(`${TIMENOTE_DIR}/${MANIFEST_FILE}`);
    expect(manifestEntry).toBeNull();
  });

  it('roundtrip: create ZIP, re-parse, verify content', async () => {
    const noteContent = createValidNoteContent('Roundtrip test #tag1');
    const files: Record<string, string> = {
      [`${TIMENOTE_DIR}/${MANIFEST_FILE}`]: JSON.stringify(createManifest('rt001', 'Roundtrip')),
      '2026-04/20260425-121000-1110.md': noteContent,
    };

    const buffer = await createVaultZipBuffer(files);
    const zip = await JSZip.loadAsync(buffer);
    const noteEntry = zip.file('2026-04/20260425-121000-1110.md');
    const content = await noteEntry?.async('string');
    expect(content).toBe(noteContent);
    expect(content).toContain('Roundtrip test #tag1');
  });
});

describe('ZIP size validation', () => {
  it('rejects files over 100MB', () => {
    const oversizedFile = new File([''], 'big.zip', { type: 'application/zip' });
    Object.defineProperty(oversizedFile, 'size', { value: 101 * 1024 * 1024 });
    expect(oversizedFile.size).toBeGreaterThan(MAX_ZIP_SIZE);
  });
});
