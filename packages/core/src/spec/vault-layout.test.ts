import { describe, expect, it } from 'vitest';
import {
  assetPath,
  classifyEntry,
  isAssetPath,
  isNoteFile,
  isNoteFileEntry,
  isVolume,
  isVolumeEntry,
  MAX_ZIP_SIZE,
  META_DIR,
  META_FILES,
  metaPath,
  noteFilePath,
  SYNCABLE_META_FILES,
  syncLedgerPath,
} from './vault-layout';

describe('vault-layout constants', () => {
  it('META_DIR is .timenote', () => {
    expect(META_DIR).toBe('.timenote');
  });

  it('META_FILES contains all expected files', () => {
    expect(META_FILES.manifest).toBe('manifest.json');
    expect(META_FILES.menu).toBe('menu.json');
    expect(META_FILES.deleteLog).toBe('delete-log.json');
    expect(META_FILES.syncLedger).toBe('sync-ledger.json');
  });

  it('SYNCABLE_META_FILES includes manifest, menu, deleteLog', () => {
    expect(SYNCABLE_META_FILES).toContain('manifest.json');
    expect(SYNCABLE_META_FILES).toContain('menu.json');
    expect(SYNCABLE_META_FILES).toContain('delete-log.json');
    expect(SYNCABLE_META_FILES).not.toContain('sync-ledger.json');
  });

  it('MAX_ZIP_SIZE is 100MB', () => {
    expect(MAX_ZIP_SIZE).toBe(100 * 1024 * 1024);
  });
});

describe('metaPath', () => {
  it('builds manifest path', () => {
    expect(metaPath('manifest')).toBe('.timenote/manifest.json');
  });

  it('builds menu path', () => {
    expect(metaPath('menu')).toBe('.timenote/menu.json');
  });

  it('builds deleteLog path', () => {
    expect(metaPath('deleteLog')).toBe('.timenote/delete-log.json');
  });

  it('builds syncLedger path', () => {
    expect(metaPath('syncLedger')).toBe('.timenote/sync-ledger.json');
  });
});

describe('syncLedgerPath', () => {
  it('returns correct path', () => {
    expect(syncLedgerPath()).toBe('.timenote/sync-ledger.json');
  });
});

describe('noteFilePath', () => {
  it('builds note path with default .md extension', () => {
    expect(noteFilePath('20260425-121000-1234')).toBe('2026-04/20260425-121000-1234.md');
  });

  it('builds note path with custom extension', () => {
    expect(noteFilePath('20260425-121000-1234', 'png')).toBe('2026-04/20260425-121000-1234.png');
  });

  it('builds path for January note', () => {
    expect(noteFilePath('20260115-090000-5678')).toBe('2026-01/20260115-090000-5678.md');
  });
});

describe('isVolume', () => {
  it('accepts valid volume name', () => {
    expect(isVolume('2026-04')).toBe(true);
  });

  it('rejects single-digit month', () => {
    expect(isVolume('2026-4')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isVolume('')).toBe(false);
  });

  it('rejects random string', () => {
    expect(isVolume('hello')).toBe(false);
  });
});

describe('isNoteFile', () => {
  it('accepts valid note filename', () => {
    expect(isNoteFile('20260425-121000-1234.md')).toBe(true);
  });

  it('rejects readme.md', () => {
    expect(isNoteFile('readme.md')).toBe(false);
  });

  it('accepts non-md extension', () => {
    expect(isNoteFile('20260425-121000-1234.txt')).toBe(true);
  });
});

describe('isVolumeEntry', () => {
  it('returns true for directory with valid volume name', () => {
    expect(isVolumeEntry({ type: 'directory', basename: '2026-04' })).toBe(true);
  });

  it('returns false for file with valid volume name', () => {
    expect(isVolumeEntry({ type: 'file', basename: '2026-04' })).toBe(false);
  });

  it('returns false for directory with invalid name', () => {
    expect(isVolumeEntry({ type: 'directory', basename: 'notes' })).toBe(false);
  });
});

describe('isNoteFileEntry', () => {
  it('returns true for file with valid note filename', () => {
    expect(isNoteFileEntry({ type: 'file', basename: '20260425-121000-1234.md' })).toBe(true);
  });

  it('returns false for directory with valid note filename', () => {
    expect(isNoteFileEntry({ type: 'directory', basename: '20260425-121000-1234.md' })).toBe(false);
  });
});

describe('classifyEntry', () => {
  it('classifies manifest', () => {
    expect(classifyEntry('.timenote/manifest.json')).toBe('manifest');
  });

  it('classifies menu as meta', () => {
    expect(classifyEntry('.timenote/menu.json')).toBe('meta');
  });

  it('classifies delete-log as meta', () => {
    expect(classifyEntry('.timenote/delete-log.json')).toBe('meta');
  });

  it('classifies sync ledger', () => {
    expect(classifyEntry('.timenote/sync-ledger.json')).toBe('syncLedger');
  });

  it('classifies note', () => {
    expect(classifyEntry('2026-04/20260425-121000-1234.md')).toBe('note');
  });

  it('classifies unrecognized file', () => {
    expect(classifyEntry('random.txt')).toBe('unrecognized');
  });

  it('classifies file in .timenote without known name as meta', () => {
    expect(classifyEntry('.timenote/other.json')).toBe('meta');
  });

  it('classifies deeply nested path as unrecognized', () => {
    expect(classifyEntry('a/b/c.txt')).toBe('unrecognized');
  });

  it('classifies asset file as attachment', () => {
    expect(classifyEntry('assets/a1/b2c3d4e5f6.png')).toBe('attachment');
  });

  it('classifies assets root directory as attachment', () => {
    expect(classifyEntry('assets')).toBe('attachment');
  });

  it('classifies assets shard directory as attachment', () => {
    expect(classifyEntry('assets/a1')).toBe('attachment');
  });
});

describe('assetPath', () => {
  it('builds asset path with hash sharding', () => {
    expect(assetPath('abcdef123456', 'png')).toBe('assets/ab/abcdef123456.png');
  });

  it('handles short hash', () => {
    expect(assetPath('ab', 'pdf')).toBe('assets/ab/ab.pdf');
  });
});

describe('isAssetPath', () => {
  it('returns true for assets path', () => {
    expect(isAssetPath('assets/a1/b2c3d4.png')).toBe(true);
  });

  it('returns false for non-assets path', () => {
    expect(isAssetPath('2026-04/note.md')).toBe(false);
  });

  it('returns true for assets directory itself', () => {
    expect(isAssetPath('assets')).toBe(true);
  });
});
