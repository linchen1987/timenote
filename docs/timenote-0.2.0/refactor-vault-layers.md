# Vault 三层架构重构执行文档

> 目标：将 `packages/core/src/vault/` 拆分为 `spec/` → `provider/` → `service/` 三层，
> 实现规范与底层解耦，规范层完全可测试。

## 设计原则

- **spec/**: 纯函数/常量，零 I/O，零副作用，完全可测试。读起来如 `vault-design.md`。
- **provider/**: I/O 接口 + 实现，不知道 vault 语义，不知道目录结构规则。
- **service/**: 组装层。依赖 spec 的规则 + provider 的接口，对外暴露业务 API。
- **公共 API 兼容**: `vault/index.ts` 的 re-export 保持外部 `import` 不变。

## 重构后目录结构

```
packages/core/src/vault/
  spec/                              ← 纯函数/常量，零 I/O
    vault-layout.ts                  ← 新增
    sync-algorithm.ts                ← 新增
    search-query.ts                  ← 新增
    note-id.ts                       ← 迁移自 vault/note-id.ts
    schemas.ts                       ← 迁移+重命名自 vault/types.ts
    frontmatter.ts                   ← 迁移自 vault/frontmatter.ts
    menu-transform.ts                ← 迁移自 vault/menu-transform.ts
    hash.ts                          ← 迁移自 vault/hash.ts
    project-id.ts                    ← 迁移自 vault/project-id.ts

  provider/                          ← I/O 接口 + 实现
    fs-transport.ts                  ← 迁移自 ../fs/types.ts（FsTransport + FsStat + remove()）
    opfs-transport.ts                ← 迁移自 vault/opfs-transport.ts
    index-service.ts                 ← 迁移自 vault/index-service.ts
    search-provider.ts               ← 迁移自 vault/search-provider.ts

  service/                           ← 组装层
    vault-service.ts                 ← 重构自 vault/vault-service.ts
    note-service.ts                  ← 重构自 vault/note-service.ts
    sync-service.ts                  ← 重构自 vault/sync-service.ts
    import-service.ts                ← 重构自 vault/import-service.ts
    export-service.ts                ← 重构自 vault/export-service.ts
    migration-service.ts             ← 迁移自 vault/migration-service.ts
    menu-service.ts                  ← 迁移自 vault/menu-service.ts

  index.ts                           ← 更新 barrel export
```

---

## Phase 1: 迁移 spec/ 纯函数文件

直接迁移，仅更新 import 路径，不改逻辑。

### 1.1 创建目录

```
mkdir packages/core/src/vault/spec
mkdir packages/core/src/vault/provider
mkdir packages/core/src/vault/service
```

### 1.2 迁移文件

| # | 操作 | 原文件 | 目标文件 | 变化 |
|---|------|--------|----------|------|
| 1 | 迁移 | `vault/note-id.ts` | `spec/note-id.ts` | 保留全部，`notePath` 暂时保留（Phase 2 标记 deprecated） |
| 2 | 迁移 | `vault/types.ts` | `spec/schemas.ts` | 更新内部 import |
| 3 | 迁移 | `vault/frontmatter.ts` | `spec/frontmatter.ts` | 不变 |
| 4 | 迁移 | `vault/menu-transform.ts` | `spec/menu-transform.ts` | 更新 import |
| 5 | 迁移 | `vault/hash.ts` | `spec/hash.ts` | 不变 |
| 6 | 迁移 | `vault/project-id.ts` | `spec/project-id.ts` | 不变 |

### 1.3 更新内部 import 路径

迁移后这些文件之间的相互 import 需要更新：

- `spec/schemas.ts` 无内部 import（Zod 独立）
- `spec/note-id.ts` import `schemas.ts` 中的 `NoteIdSchema`, `VolumeNameSchema` → `../schemas`
- `spec/frontmatter.ts` import `schemas.ts` 中的类型 → `../schemas`
- `spec/menu-transform.ts` 无 vault 内部 import

### 1.4 验证

```bash
pnpm --filter @timenote/core exec tsc --noEmit
```

---

## Phase 2: 新增 spec 核心文件

### 2.1 `spec/vault-layout.ts`

目录结构的单一真相源。合并以下分散的常量/逻辑：

| 来源 | 提取内容 |
|------|----------|
| `vault-service.ts` L12-17 | `TIMENOTE_DIR`, `MANIFEST_FILE`, `MENU_FILE`, `DELETE_LOG_FILE`, `SYNC_LEDGER_FILE` |
| `import-service.ts` L7-16 | `TIMENOTE_DIR`, `MANIFEST_FILE`, `MENU_FILE`, `DELETE_LOG_FILE`, `VALID_META_FILES`, `MAX_ZIP_SIZE` |
| `export-service.ts` L4-5 | `SYNC_LEDGER_FILE`, `TIMENOTE_DIR` |
| `sync-service.ts` L38 | `META_KEYS` |
| `note-id.ts` | `notePath()` → 重命名为 `noteFilePath()` |
| `note-service.ts` L141,144 | `isValidVolumeName`/`isValidNoteFilename` 用法模式 → `isVolumeEntry`/`isNoteFileEntry` |

导出清单：

```typescript
// 常量
export const META_DIR = '.timenote';
export const META_FILES = { manifest, menu, deleteLog, syncLedger } as const;
export const SYNCABLE_META_FILES: readonly string[];
export const VOLUME_PATTERN: RegExp;
export const NOTE_FILE_PATTERN: RegExp;
export const MAX_ZIP_SIZE = 100 * 1024 * 1024;

// 路径构建
export function metaPath(name: keyof typeof META_FILES): string;
export function syncLedgerPath(): string;
export function noteFilePath(noteId: NoteId, ext?: string): string;

// 分类器
export function isVolume(name: string): boolean;
export function isNoteFile(filename: string): boolean;
export function isVolumeEntry(entry: FsStat): boolean;
export function isNoteFileEntry(entry: FsStat): boolean;
export function classifyEntry(path: string): 'meta' | 'manifest' | 'note' | 'syncLedger' | 'unrecognized';
```

### 2.2 `spec/sync-algorithm.ts`

从 `sync-service.ts` 提取纯算法：

| 提取来源 | 函数 |
|----------|------|
| `VaultSyncServiceImpl.compareEntities()` L260-321 | → 独立纯函数 `compareEntities()` |
| `VaultSyncServiceImpl.mergeEntities()` L323-354 | → 独立纯函数 `mergeEntities()` |

导出清单：

```typescript
export interface SyncPlan {
  toPull: string[];
  toPush: string[];
  toDeleteRemote: string[];
  toDeleteLocal: string[];
  conflicts: number;
}

export function compareEntities(
  localMap: Record<string, SyncEntity>,
  remoteMap: Record<string, SyncEntity>,
  direction: 'both' | 'pull' | 'push',
): SyncPlan;

export function mergeEntities(
  localMap: Record<string, SyncEntity>,
  remoteMap: Record<string, SyncEntity>,
  plan: SyncPlan,
): Record<string, SyncEntity>;
```

### 2.3 `spec/search-query.ts`

从 `note-service.ts` 提取纯函数：

| 提取来源 | 函数 |
|----------|------|
| `note-service.ts` L270-284 | `parseSearchQuery()` |
| `note-service.ts` L286-289 | `extractTagsFromBody()` |

### 2.4 验证

```bash
pnpm --filter @timenote/core exec tsc --noEmit
```

---

## Phase 3: 迁移 provider/ 层

### 3.1 `provider/fs-transport.ts`

从 `../fs/types.ts` 迁移 `FsTransport` 接口和 `FsStat` 类型。

**接口变化**: `FsTransport` 新增 `remove(path: string): Promise<void>` 方法。

需同步更新的实现：
- `apps/web/app/lib/web-transport.ts` — 添加 `remove()`
- `packages/core/src/fs/fs-service.ts` — 如有缓存逻辑需适配

### 3.2 迁移其他 provider 文件

| # | 原文件 | 目标文件 | 变化 |
|---|--------|----------|------|
| 1 | `vault/opfs-transport.ts` | `provider/opfs-transport.ts` | 更新 import 路径（`../fs/types` → `./fs-transport`） |
| 2 | `vault/index-service.ts` | `provider/index-service.ts` | 更新 import 路径（`./frontmatter` → `../spec/frontmatter`，`./types` → `../spec/schemas`） |
| 3 | `vault/search-provider.ts` | `provider/search-provider.ts` | 无内部 import 变化 |

### 3.3 更新 `../fs/types.ts`

原 `../fs/types.ts` 保留但改为从 `vault/provider/fs-transport.ts` re-export，保持外部兼容：

```typescript
export { type FsTransport, type FsStat } from '../vault/provider/fs-transport';
```

或：保留原文件不变，`provider/fs-transport.ts` 从中 import 并扩展。**推荐此方案**，改动最小。

### 3.4 验证

```bash
pnpm --filter @timenote/core exec tsc --noEmit
```

---

## Phase 4: 重构 service/ 层

### 4.1 `service/vault-service.ts`

| 变化 | Before | After |
|------|--------|-------|
| 常量 | 本地 `TIMENOTE_DIR`, `*_FILE` | `import { META_DIR, META_FILES, metaPath } from '../spec/vault-layout'` |
| 路径 | `${TIMENOTE_DIR}/${MANIFEST_FILE}` | `metaPath('manifest')` |
| Transport 类型 | `getOpfsTransport(): OpfsTransport` | `getTransport(): VaultTransport` (FsTransport + remove) |
| 依赖 | `import { createOpfsTransport, OpfsTransport } from './opfs-transport'` | `import { createOpfsTransport } from '../provider/opfs-transport'` |
| 接口 | `VaultService` 暴露 `OpfsTransport` | `VaultService` 暴露 `VaultTransport` 接口 |

新增类型：

```typescript
export interface VaultTransport extends FsTransport {
  remove(path: string): Promise<void>;
}
```

### 4.2 `service/note-service.ts`

| 变化 | Before | After |
|------|--------|-------|
| 路径 | `import { notePath } from './note-id'` | `import { noteFilePath } from '../spec/vault-layout'` |
| 搜索 | 本地 `parseSearchQuery`, `extractTagsFromBody` | `import from '../spec/search-query'` |
| 分类 | `isValidVolumeName(vol.basename)` + `isValidNoteFilename(item.basename)` | `isVolumeEntry(vol)` + `isNoteFileEntry(item)` |
| Transport | `OpfsTransport` | `VaultTransport` |

### 4.3 `service/sync-service.ts`

| 变化 | Before | After |
|------|--------|-------|
| 算法 | 类方法 `this.compareEntities()`, `this.mergeEntities()` | `import { compareEntities, mergeEntities } from '../spec/sync-algorithm'` |
| 常量 | 本地 `META_KEYS = ['manifest.json', ...]` | `import { SYNCABLE_META_FILES, metaPath, syncLedgerPath } from '../spec/vault-layout'` |
| 路径 | `.timenote/${mf}` 内联字符串 | `metaPath(...)` |
| 路径 | `.timenote/sync-ledger.json` 内联 | `syncLedgerPath()` |

### 4.4 `service/import-service.ts`

| 变化 | Before | After |
|------|--------|-------|
| 常量 | 本地 `TIMENOTE_DIR`, `MANIFEST_FILE`, `VALID_META_FILES`, `MAX_ZIP_SIZE` | `import from '../spec/vault-layout'` |
| 验证 | `parts.length === 2 && isValidVolumeName(parts[0]) && isValidNoteFilename(parts[1])` | `classifyEntry(relativePath) === 'note'` |
| Transport | `OpfsTransport` | `VaultTransport` |

### 4.5 `service/export-service.ts`

| 变化 | Before | After |
|------|--------|-------|
| 常量 | 本地 `SYNC_LEDGER_FILE`, `TIMENOTE_DIR` | `import { syncLedgerPath } from '../spec/vault-layout'` |
| skip | `${TIMENOTE_DIR}/${SYNC_LEDGER_FILE}` | `syncLedgerPath()` |
| Transport | `getOpfsTransport` | `getTransport` |

### 4.6 `service/migration-service.ts`

| 变化 | Before | After |
|------|--------|-------|
| import | `from './note-id'`, `from './frontmatter'`, `from './types'` | `from '../spec/note-id'`, `from '../spec/frontmatter'`, `from '../spec/schemas'` |
| 路径 | 内联 `.timenote/manifest.json` | `metaPath('manifest')` 等 |

### 4.7 `service/menu-service.ts`

更新 import 路径：`./menu-transform` → `../spec/menu-transform`，`./types` → `../spec/schemas`，`./vault-service` → `./vault-service`。

### 4.8 验证

```bash
pnpm --filter @timenote/core exec tsc --noEmit
```

---

## Phase 5: 测试迁移与新增

### 5.1 迁移现有测试

| 原文件 | 目标文件 | 变化 |
|--------|----------|------|
| `vault/note-id.test.ts` | `spec/note-id.test.ts` | 更新 import 路径 |
| `vault/types.test.ts` | `spec/schemas.test.ts` | 更新 import：`./types` → `./schemas` |
| `vault/frontmatter.test.ts` | `spec/frontmatter.test.ts` | 更新 import |
| `vault/menu-transform.test.ts` | `spec/menu-transform.test.ts` | 更新 import |
| `vault/search-provider.test.ts` | `provider/search-provider.test.ts` | 更新 import |
| `vault/export-import.test.ts` | `service/export-import.test.ts` | 更新 import + 使用 vault-layout |
| `vault/migration-service.test.ts` | `service/migration-service.test.ts` | 更新 import |
| `vault/note-service.test.ts` | `spec/search-query.test.ts` | 重命名，只测 `parseSearchQuery` |

### 5.2 新增测试

#### `spec/vault-layout.test.ts` (~12 用例)

测试内容：
- `metaPath('manifest')` → `'.timenote/manifest.json'`
- `metaPath('menu')` → `'.timenote/menu.json'`
- `syncLedgerPath()` → `'.timenote/sync-ledger.json'`
- `noteFilePath('20260425-121000-1234')` → `'2026-04/20260425-121000-1234.md'`
- `noteFilePath('20260425-121000-1234', 'png')` → `'2026-04/20260425-121000-1234.png'`
- `isVolume('2026-04')` → true
- `isVolume('2026-4')` → false
- `isNoteFile('20260425-121000-1234.md')` → true
- `isNoteFile('readme.md')` → false
- `isVolumeEntry({ type: 'directory', basename: '2026-04', ... })` → true
- `isNoteFileEntry({ type: 'file', basename: '20260425-121000-1234.md', ... })` → true
- `classifyEntry('.timenote/manifest.json')` → `'manifest'`
- `classifyEntry('.timenote/menu.json')` → `'meta'`
- `classifyEntry('2026-04/20260425-121000-1234.md')` → `'note'`
- `classifyEntry('.timenote/sync-ledger.json')` → `'syncLedger'`
- `classifyEntry('random.txt')` → `'unrecognized'`

#### `spec/sync-algorithm.test.ts` (~15 用例)

测试内容：
- 仅本地存在 → push
- 仅远端存在 → pull
- 双方相同 hash → 无操作
- 双方不同 hash → 新者优先（冲突+1）
- 本地存活 vs 远端墓碑 → 新者优先
- 本地墓碑 vs 远端存活 → 新者优先
- 仅 pull 模式 → 不 push
- 仅 push 模式 → 不 pull
- `mergeEntities` 正确合并

#### `spec/search-query.test.ts` (~8 用例)

从 `note-service.test.ts` 原样迁移，无逻辑变化。

### 5.3 验证

```bash
pnpm --filter @timenote/core exec vitest run
```

---

## Phase 6: 更新外部消费者

### 6.1 `apps/web/app/lib/web-transport.ts`

添加 `remove()` 方法实现。

### 6.2 `apps/web/app/lib/vault-store.ts`

- `VaultService.getOpfsTransport()` → `VaultService.getTransport()`
- 检查所有 `OpfsTransport` 类型引用

### 6.3 `packages/core/src/fs/types.ts`

保留原文件。`provider/fs-transport.ts` 从中导入 `FsStat` 并扩展 `FsTransport` 接口。

### 6.4 `packages/core/src/fs/fs-service.ts`

更新 import 路径（如有）。

### 6.5 `vault/index.ts`

更新所有 re-export 路径，保持公共 API 名称不变：

```typescript
// 向后兼容别名
export { noteFilePath as notePath } from './spec/vault-layout';
```

### 6.6 全量验证

```bash
pnpm --filter @timenote/core exec tsc --noEmit
pnpm --filter @timenote/core exec vitest run
pnpm lint
```

---

## 风险与注意事项

1. **Import 路径爆炸**: 文件迁移导致大量 import 路径更新。每步用 `tsc --noEmit` 验证。
2. **`FsTransport.remove()` 兼容**: web-transport 和其他 transport 实现需要补上 `remove()` 方法。
3. **测试 import 路径**: 测试文件也需要更新 import 路径。
4. **`../fs/types.ts` 双向依赖**: provider/fs-transport.ts 需要 FsStat 类型。避免循环依赖：provider 从 `../fs/types` import FsStat，扩展 FsTransport 接口。
5. **vitest.config.ts**: 测试文件匹配模式 `src/**/*.test.ts` 已经覆盖子目录，无需修改。
