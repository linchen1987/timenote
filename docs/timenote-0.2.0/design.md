# Timenote 0.2.0 重构设计文档

> 子文档: [索引与搜索](./design-index-search.md) | [同步](./design-sync.md) | [迁移与导入导出](./design-migration.md)

> vault 规范: [vault 规范](./vault-design.md)

## 1. 概述

### 1.1 目标

将 timenote 从 Dexie (IndexedDB) 单一存储架构，迁移到 **OPFS + IndexedDB** 双层架构，以 vault 规范作为 Single Source of Truth。

### 1.2 核心变更

| 维度 | 0.1.x (当前) | 0.2.0 (目标) |
|---|---|---|
| 存储 | Dexie (IndexedDB) | OPFS (文件系统) + IndexedDB (索引) |
| 数据格式 | Dexie tables | Markdown + YAML frontmatter + JSON |
| Note ID | `nanoid(12)` | `YYYYMMDD-HHmmss-SSSR` (基于时间戳) |
| 同步 | 全量快照 `data.json` | 文件级增量同步 + `sync-ledger.json` |
| 菜单 | 扁平 `menuItems` 表 | 嵌套 `menu.json` |
| 标签 | `tags` + `noteTags` 表 | YAML frontmatter + IndexedDB 索引 |
| 搜索 | IndexedDB 内存过滤 | 内存全文缓存 + 原生字符串匹配 |
| 导入导出 | JSON 文件 | ZIP (vault 目录结构) |
| Notebook | 内部概念，多 notebook 共存 | 每个 notebook 独立 vault |

### 1.3 支持平台

- Web (Cloudflare Workers SSR)
- Browser Extension (Chrome Side Panel)

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  Routes / Components / Hooks                             │
├─────────────────────────────────────────────────────────┤
│                    Service Layer                          │
│  VaultService  NoteService  MenuService  SyncService     │
├──────────────┬──────────────────────────┬───────────────┤
│  Index Layer │      File System Layer    │  Transport    │
│  IndexedDB + │          OPFS             │  WebDAV/S3    │
│  内存缓存    │  (vault 物理文件)          │  (远程同步)    │
└──────────────┴──────────────────────────┴───────────────┘
```

### 2.1 数据流原则

1. **OPFS 是真理**: 所有核心数据的写入先写 OPFS，再更新索引
2. **IndexedDB 是索引**: 仅用于搜索和查询加速，可从 OPFS 完全重建
3. **单 Vault 索引**: 同一时间只索引当前激活的 vault，切换 vault 时重建索引
4. **远程同步以文件为单位**: 基于 sync-ledger.json 的增量同步

---

## 3. OPFS 存储设计

### 3.1 目录结构

每个 notebook 对应一个独立 vault，存储在 OPFS 中：

```
OPFS Root/
  └── vaults/
      └── {project_id}/              # 一个 notebook = 一个 vault
          ├── .timenote/
          │   ├── manifest.json
          │   ├── menu.json
          │   ├── delete-log.json
          │   └── sync-ledger.json
          ├── 2026-04/
          │   ├── 20260425-121000-1110.md
          │   └── ...
          └── 2026-05/
```

### 3.2 OPFS Adapter

新增 `OpfsTransport` 实现 `FsTransport` 接口，基于 `navigator.storage.getDirectory()`:

```typescript
interface OpfsTransport extends FsTransport {
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
}
```

- `list(path)` -- `FileSystemDirectoryHandle.entries()`
- `read(path)` -- `FileSystemFileHandle.getFile()` → `.text()`
- `write(path, content)` -- 递归创建父目录 → `FileSystemDirectoryHandle.createFile()` → `.createWritable()`
- `exists(path)` -- `getFileHandle()` catch
- `ensureDir(path)` -- 递归 `getDirectoryHandle(..., { create: true })`

**注意**: OPFS 操作在主线程可能阻塞，高频写入应考虑在 Web Worker 中执行。初期可直接在主线程实现，后续优化时迁移。

### 3.3 VaultService

新增核心服务，管理 vault 的生命周期：

```typescript
interface VaultService {
  // Vault 生命周期
  createVault(name: string): Promise<string>;           // 创建 vault，生成 project_id，写 manifest.json
  deleteVault(projectId: string): Promise<void>;         // 删除整个 vault 目录
  listVaults(): Promise<VaultMeta[]>;                    // 列出所有 vault (读 manifest.json)

  // Vault 访问
  getOpfsTransport(projectId: string): OpfsTransport;    // 获取该 vault 的 OPFS transport

  // 元数据读写
  readManifest(projectId: string): Promise<Manifest>;
  readMenu(projectId: string): Promise<MenuData>;
  writeMenu(projectId: string, menu: MenuData): Promise<void>;
  readDeleteLog(projectId: string): Promise<DeleteLog>;
  appendDeleteLog(projectId: string, noteId: string): Promise<void>;
  readSyncLedger(projectId: string): Promise<SyncLedger>;
  writeSyncLedger(projectId: string, ledger: SyncLedger): Promise<void>;
}
```

### 3.4 OPFS 跨平台适配

**Web 端**: 直接使用 `navigator.storage.getDirectory()`，需 HTTPS (localhost 除外)。

**Extension 端**: Side Panel 拥有完整 DOM API，可直接使用。Background Service Worker 也支持 (Chrome 86+)。

**统一抽象**: `OpfsTransport` 在 `packages/core` 中实现，Web 和 Extension 共用。

---

## 4. 数据模型

### 4.1 Note ID 格式

```
YYYYMMDD-HHmmss-SSSR

YYYY   : 年 (4位)
MM     : 月 (2位)
DD     : 日 (2位)
HH     : 时 (2位, 24h)
mm     : 分 (2位)
ss     : 秒 (2位)
SSS    : 毫秒 (3位)
R      : 随机数字 (1位, 0-9, 防冲突)
```

**生成规则**:
- 基于 `Date.now()` 生成时间戳部分
- 随机部分使用 `Math.floor(Math.random() * 10).toString()` (0-9)
- 同一毫秒内的冲突由随机位缓解
- 不需要全局唯一保证，OPFS 文件系统天然不会重名

**文件名示例**: `20260425-121000-1234.md`

**正则**: `/^[0-9]{8}-[0-9]{6}-[0-9]{4}\.md$/`


##### URL 映射规则

**noteId URL 格式**: URL 中去掉 `-`，使 URL 更紧凑。解析时兼容两种格式。

| 格式 | 示例 | 用途 |
|---|---|---|
| 文件名 / IndexedDB | `20260426-050010-7606` | OPFS 文件名、内部索引 |
| URL | `202604260500107606` | 路由参数，去掉所有 `-` |

**路由结构**:
- `/s/{notebookToken}` — vault timeline（如 `/s/Bm1ic75uaq_3wEow5j74dUyZ`）
- `/s/{notebookToken}/{noteId_no_dash}` — note detail（如 `/s/Bm1ic75uaq_3wEow5j74dUyZ/202604260500107606`）

**notebookToken**: 保持 `{projectId}_{base58(name)}` 格式不变。

**转换函数**:
- URL → 内部: 兼容 `202604260500107606` 和 `20260426-050010-7606`
- 内部 → URL: `noteId.replaceAll('-', '')`

### 4.2 Markdown + YAML Frontmatter

```markdown
---
created_at: "2026-04-25T12:10:00Z"
updated_at: "2026-04-25T12:10:00Z"
tags: ["架构", "Web"]
title: "深入理解 Local-First 架构"
---

笔记正文内容...
```

**Frontmatter 规范**:
- `created_at`: ISO 8601, UTC (`Z` 结尾), required
- `updated_at`: ISO 8601, UTC, required
- `tags`: `string | string[]`, optional, 默认 `[]`
- `title`: `string | string[]`, optional
- 其他自定义字段: 保留但当前版本不处理

**解析库**: 使用 `gray-matter` (成熟稳定，支持 TypeScript)

### 4.3 manifest.json

```typescript
interface Manifest {
  project_id: string;
  name: string;
  version: string;
  created_at: string;
  updated_at: string;
}
```

- `project_id`: URL-safe 字符串，建议使用不含 `-` 和 `_` 的字母数字，推荐长度 8-16 位。
- `version`: 固定 `"1.0.0"`
- 每次修改 vault 元数据时更新 `updated_at`

### 4.4 menu.json

**持久化格式** (严格遵循 vault 规范，嵌套结构):

```typescript
interface MenuData {
  version: 1;
  items: MenuItem[];
}

interface MenuItem {
  title: string;
  type: 'note' | 'search';
  note_id?: string;       // type === 'note' 时必填
  search?: string;        // type === 'search' 时必填
  children?: MenuItem[];
}
```

**运行时格式** (扁平结构，兼容 TreeMenu 组件):

```typescript
interface RuntimeMenuItem {
  id: string;                  // 运行时生成的临时 ID (nanoid)
  parentId: string | null;     // 父节点 ID, 根节点为 null
  order: number;               // 同级排序
  title: string;
  type: 'note' | 'search';
  note_id?: string;
  search?: string;
}
```

**转换函数**:

```typescript
// 加载时: 嵌套 → 扁平
function flattenMenuItems(items: MenuItem[], parentId?: string): RuntimeMenuItem[];

// 保存时: 扁平 → 嵌套
function nestifyMenuItems(flatItems: RuntimeMenuItem[]): MenuItem[];
```

**设计说明**:
- 持久化用嵌套 (人类可读，符合 vault 规范)
- 运行时用扁平 (TreeMenu 组件需要 `{ id, parentId, order }`，拖拽排序逻辑成熟)
- `id` 仅运行时使用，不持久化。每次加载时生成。

### 4.5 delete-log.json

```typescript
interface DeleteLog {
  version: 1;
  records: Record<string, string>;  // noteId -> deletedAt (ISO 8601)
}
```

### 4.6 sync-ledger.json

```typescript
interface SyncLedger {
  version: 1;
  last_sync_time: string;
  entities: Record<string, SyncEntity>;
  meta_files: Record<string, SyncEntity>;
}

type SyncEntity =
  | { h: string; u: string }           // 存活: 内容 hash + 更新时间
  | { d: true; u: string };            // 墓碑: 已删除 + 删除时间
```

**设计说明**: 使用 TypeScript discriminated union 表达两种状态。JSON 序列化时 `d` 字段的有无天然区分两种情况，运行时通过 `'d' in entity` 判断。

---

## 5. 文件解析层

### 5.1 解析管道

```
OPFS 文件 → read(path) → parseFrontmatter(content) → { frontmatter, body }
                                                 ↓
                                           extractMetadata()
                                           ↓
                                    NoteIndex (IndexedDB)
                                           ↓
                                    contentCache.set(noteId, body)
```

### 5.2 核心解析函数

```typescript
interface NoteFrontmatter {
  created_at: string;
  updated_at: string;
  tags?: string | string[];
  title?: string | string[];
  [key: string]: unknown;
}

interface ParsedNote {
  frontmatter: NoteFrontmatter;
  body: string;
  raw: string;
}

function parseNote(rawContent: string): ParsedNote;
function serializeNote(frontmatter: NoteFrontmatter, body: string): string;
function normalizeTags(tags?: string | string[]): string[];
function normalizeTitle(title?: string | string[]): string[];
function noteIdFromFilename(filename: string): string;
function filenameFromNoteId(noteId: string): string;
function volumePathFromDate(isoDate: string): string;  // "2026-04-25T..." → "2026-04"
```

---

## 6. 服务层重构

### 6.1 NoteService (重构)

```typescript
interface NoteService {
  // CRUD
  createNote(projectId: string, content?: string): Promise<string>;
  getNote(projectId: string, noteId: string): Promise<{ frontmatter: NoteFrontmatter; body: string } | null>;
  updateNote(projectId: string, noteId: string, content: string): Promise<void>;
  deleteNote(projectId: string, noteId: string): Promise<void>;

  // 查询 (走索引)
  listNotes(options?: { limit?: number; offset?: number }): Promise<NoteIndex[]>;
  searchNotes(query: string): Promise<NoteIndex[]>;
  getNotesByTag(tag: string): Promise<NoteIndex[]>;

  // 标签
  getAllTags(): Promise<string[]>;
}
```

> 注意: 查询方法不再需要 `projectId` 参数，因为同一时间只有一个激活 vault 的索引。

**createNote 流程**:
1. 生成 note ID (`YYYYMMDD-HHmmss-SSSR`)
2. 构建 frontmatter (`created_at`, `updated_at`)
3. 写入 OPFS: `/YYYY-MM/{noteId}.md`
 4. 更新 IndexedDB 索引 + 内存缓存

**updateNote 流程**:
1. 解析现有 frontmatter
2. 合并更新内容，更新 `updated_at`
3. 从内容提取 tags
4. 写入 OPFS (覆盖)
 5. 更新 IndexedDB 索引 + 内存缓存

**deleteNote 流程**:
1. 从 OPFS 删除文件
2. 从 IndexedDB 删除索引
 3. 从内存缓存移除
4. 追加到 `delete-log.json`

### 6.2 MenuService (重构)

```typescript
interface MenuService {
  // 返回扁平结构的运行时数据 (直接传给 TreeMenu)
  getMenu(projectId: string): Promise<RuntimeMenuItem[]>;

  // 接收扁平结构，内部转换为嵌套后写入 menu.json
  saveMenu(projectId: string, items: RuntimeMenuItem[]): Promise<void>;
}
```

**设计说明**:
- `getMenu()`: 读 `menu.json` → `flattenMenuItems()` → 返回扁平列表
- `saveMenu()`: `nestifyMenuItems()` → 写入 `menu.json`
- TreeMenu 的 `onReorder` 回调直接调用 `saveMenu()`，无需额外转换
- 每次修改都是整体读写 `menu.json`

### 6.3 SyncService (重构)

```typescript
interface SyncService {
  init(): Promise<void>;
  sync(projectId: string): Promise<SyncResult>;
  pull(projectId: string): Promise<SyncResult>;
  push(projectId: string): Promise<SyncResult>;
  getSyncStatus(projectId: string): Promise<SyncStatus>;
  getRemoteVaults(): Promise<VaultMeta[]>;
}
```

> 详细同步流程见 [同步设计](./design-sync.md)。

---

## 7. 重构实施计划

### 实施策略: Core → Web → Adapter

所有业务逻辑在 `packages/core` 中实现。Web app 先跑通完整流程，Extension 和 WebDAV 作为 adapter 后续接入。

```
packages/core (数据 + 逻辑 + 抽象)
    │
    ├── OpfsTransport (本地 OPFS)
    ├── S3Transport   (远程同步, 实现 FsTransport)
    ├── WebDavTransport (远程同步, 实现 FsTransport)
    │
    ▼
apps/web (先跑通)
    │
    ▼
apps/extension (接入 core 即可, 大量重复代码可消除)
```

**关键原则**:
- `packages/core` 包含所有 Service、解析器、同步逻辑
- `FsTransport` 是唯一的 IO 抽象点，S3/WebDAV 都是 Transport 实现
- Extension 的 background fs-handler 重复代码可通过直接引用 core 消除

### 前提: 新旧数据共存

- OPFS 与旧 Dexie 使用完全不同的存储空间，天然不冲突
- 新 IndexedDB 数据库名 (`TimenoteVaultIndex`) 独立于旧 `TimenoteDB`，索引可随时重建
- **旧数据永不删除**: localStorage (S3 provider 配置等)、旧 `TimenoteDB` (IndexedDB) 始终保留
- **旧数据不阻塞新代码**: 新 service 不依赖旧 Dexie 表，旧 `TimenoteDB` 的存在不影响新逻辑
- **开发期间旧笔记本不可用**: 可以直接禁用旧功能 (如 sync)，无需保证旧笔记本正常运行

### 新旧代码共存原则

- **原有 UI 组件不改动**: `@timenote/ui` 中的组件保持不变
- **只改实现，不改界面**: 在 route handler 层切换数据源 (Dexie → Vault)，组件接口不变
- **未实现的功能报错或忽略**: 如 Phase 2 没有 sync/menu/import-export，对应按钮可 no-op 或显示 "coming soon"
- **每个 Phase 独立可体验**: 新功能视为从零开发，逐步叠加，不依赖前一 Phase 以外的功能

### 测试策略

- **不在 /playground 测试**: `/playground/opfs` 仅用于 Phase 1 基础设施验证
- **在原有路由中测试**: 新 service 通过 `/s/list`、`/s/:notebookToken`、`/s/:notebookToken/:noteId` 等原有路由体验
- **Route handler 是切换点**: 通过条件判断或 store 决定使用新/旧 service，组件层无需感知

---

### Phase 1: OPFS 基础设施 (core) ✅ 已完成

1. 新增类型定义 (`types.ts` 扩展)
2. 实现 `OpfsTransport`
3. 实现 `VaultService`
4. 实现 Markdown 解析/序列化 (frontmatter)
5. 在 `/playground/opfs` 添加验证页面 (后续可手动移除):
   - 创建/删除 vault 目录
   - 读写 .md 文件
   - 解析/序列化 frontmatter

> 交付: playground 页面中可创建 vault、写入笔记文件、读取并解析 frontmatter

### Phase 2: 本地 CRUD (core + web) ✅ 已完成

**core 层**:

6. 实现 `VaultNoteService` (基于 OPFS 的 CRUD + activate/deactivate vault)
7. 实现 `IndexService` (Dexie `TimenoteVaultIndex` 数据库，NoteIndex 索引)
8. 实现 `SearchProvider` (SimpleSearchProvider 内存全文缓存 + parseSearchQuery)
9. 在 `/playground/opfs` 增强验证页面 (已更新为使用 VaultNoteService)

**web 层**:

10. 改造 `/s/list` route handler: 展示 vault 列表 (来自 `VaultService.listVaults()`)，创建 vault 入口
11. 改造 `/s/:notebookToken` route handler: 通过 notebookToken 解析 projectId → `VaultNoteService.activateVault()` → timeline 展示
12. 改造 `/s/:notebookToken/:noteId` route handler: 通过 `VaultNoteService.getNote/updateNote` 读写笔记
13. 搜索集成: `/s/:notebookToken` 中的搜索框调用 `VaultNoteService.searchNotes()`

**本 Phase 不实现**:

- Sync: 同步按钮 disabled 或隐藏，不调用旧 SyncService
- Menu: 侧边栏不显示菜单项 (空状态即可)
- Import/Export: 导入导出按钮 disabled

> 交付: 通过原有路由 `/s/` 可创建新 vault、新建笔记、编辑内容、Timeline 列表展示、全文搜索

### Phase 2.1: ID 格式优化 (core + web) ← 美化 URL

当前 `projectId` 格式 `v-Bm-1ic75uaq` 包含 `-`，导致 URL 不够紧凑。`noteId` 在 URL 中也包含 `-`。

**变更内容**:

14. **projectId 去特殊字符**: 生成时使用不含 `-` 和 `_` 的字母数字，去掉 `v-` 前缀
    - 旧格式: `v-Bm-1ic75uaq` → URL: `v-Bm-1ic75uaq_3CQ2BA6C8UwTEF9uB`
    - 新格式: `Bm1ic75uaq` → URL: `Bm1ic75uaq_3CQ2BA6C8UwTEF9uB`
    - `notebookToken` 的 `{projectId}_{base58(name)}` 格式不变
15. **noteId URL 格式**: URL 中去掉所有 `-`，解析时兼容两种格式
    - 内部格式 (文件名、IndexedDB) 保持 `YYYYMMDD-HHmmss-SSSR` 不变
    - URL 格式: `202604260500107606` (优先)
    - 兼容旧格式: `20260426-050010-7606` 仍可解析
16. **兼容已有 vault**: 旧的 `v-` 前缀 projectId 仍可正常工作，`listVaults()` 不依赖 ID 格式

**影响范围**:
- `packages/core/src/vault/note-id.ts` — `generateProjectId()` 去掉 `v-` 前缀和特殊字符
- `packages/core/src/vault/note-id.ts` — 新增 `noteIdToUrl()` / `noteIdFromUrl()` 转换函数
- 路由 URL 生成 — note detail 链接使用去 `-` 格式
- 路由参数解析 — noteId 参数兼容两种格式

> 交付: URL 从 `v-Bm-1ic75uaq_3CQ2BA6C8UwTEF9uB/20260426-050010-7606` 变为 `Bm1ic75uaq_3CQ2BA6C8UwTEF9uB/202604260500107606`

### Phase 3: Menu (core + web) ← 可体验: 侧边栏菜单完整可用

14. 实现 `MenuService` (嵌套↔扁平转换，读写 `menu.json`)
15. 改造侧边栏 route handler: 使用 `MenuService.getMenu()` 展示菜单
16. 适配 TreeMenu 组件: `onReorder`/`onCreate`/`onDelete` 回调连接 `MenuService`

**本 Phase 不实现**:

- Sync: 同步按钮仍 disabled

> 交付: 侧边栏菜单完整可用 (创建/删除/拖拽排序/搜索项)

### Phase 4: S3 同步 (core + web) ← 可体验: 新 vault 同步到 S3

17. 实现 `S3Transport` (基于现有 S3 client, 实现 `FsTransport`)
18. 重写 `SyncService` (增量同步 + sync-ledger)
19. 改造同步 UI: 同步按钮连接新 `SyncService`，显示同步状态

> 交付: Web 中新创建的 vault 可双向同步到 S3，多设备验证

### Phase 5: 导入导出 (core + web)

20. 实现 `ExportService` (ZIP)
21. 实现 `ImportService` (ZIP)
22. 改造导入导出 UI

> 交付: vault 可导出为 ZIP，ZIP 可导入为新 vault

### Phase 6: 迁移 (core + web) ← 可体验: 旧笔记本迁移到新架构

23. 实现 `MigrationService` (Dexie → ZIP，不直接写 OPFS)
24. 迁移 UI (检测入口 + 独立迁移页面 + 清除旧数据功能)

> 交付: 浏览器中可将旧笔记本批量导出为 ZIP，通过导入功能成为新 vault

#### Phase 6 设计方案

**核心策略: Dexie → ZIP，不直接写 OPFS**

迁移不直接写入 OPFS vault，而是将每个旧 notebook 导出为 ZIP 文件。用户可多次迁移、反复测试。ZIP 文件通过已有的 ImportService 导入为 vault。

优势:
- 迁移可重复执行，方便调试
- 旧数据完全不修改、不删除
- 复用已有的 ImportService，无需额外的 OPFS 写入逻辑

**数据转换**:

| 旧 (Dexie `TimenoteDB`) | 新 (ZIP → vault) |
|---|---|
| `notebooks.id` (nanoid) | `manifest.json` 的 `project_id` (保留原 ID) |
| `notebooks.name` | `manifest.json` 的 `name` |
| `notes.content` + `createdAt`/`updatedAt` | `/YYYY-MM/YYYYMMDD-HHmmss-SSSR.md` + YAML frontmatter |
| `tags` + `noteTags` | frontmatter `tags` 字段 |
| `menuItems` (flat) | `menu.json` (nested, oldId → newId 替换) |

**ID 映射**: `nanoid(12)` → `YYYYMMDD-HHmmss-SSSR` (从 `createdAt` 生成)。迁移时内存中建立 `{ oldId → newId }` 映射，用于更新 menu.json 中的引用。

#### Phase 6 UI 方案

**页面结构**:

1. **笔记本列表页** (`/s/list`) — 仅做入口:
   - 顶部蓝色提示横幅 (Alert): "发现 X 个旧版笔记本"
   - 一个按钮: "前往迁移" → `<Link to="/migration">`
   - 横幅始终显示（只要旧数据存在），不写入 localStorage 标记

2. **迁移页面** (`/migration`) — 独立路由，Phase 8 可直接删除:
   - **迁移区域**: 列出所有旧 notebook（名称 + 笔记数量），点击"导出 ZIP"逐个下载
   - **批量导出**: "全部导出" 按钮，逐个生成 ZIP 并下载
   - **进度显示**: 当前 notebook 名称 + 进度条
   - **清除旧数据区域**: "清除本地旧数据" 按钮 (red/destructive)
     - 二次确认 Dialog: "确定要删除所有旧数据吗？此操作不可恢复。"
     - 确认后清空 `TimenoteDB` 所有表 (`notebooks`, `notes`, `tags`, `noteTags`, `menuItems`, `syncEvents`)
     - 清除后页面刷新，横幅消失

**路由**: 新增 `/migration` (在 `apps/web/app/routes/migration.tsx`)

**Store 扩展** (`vault-store.ts`):
```
legacyNotebooks: LegacyNotebookInfo[]  // { id, name, noteCount }
legacyLoaded: boolean

checkLegacy()         -> db.notebooks.count() > 0
listLegacyNotebooks() -> 读取旧 notebook + noteCount
migrateLegacy(id)     -> MigrationService.exportNotebook(id) → 触发下载
migrateAllLegacy()    -> 逐个调用 migrateLegacy
clearLegacyData()     -> db.delete() 清空 TimenoteDB
```

**MigrationService** (`packages/core/src/vault/migration-service.ts`):
```
needsMigration()           -> db.notebooks.count() > 0
listNotebooks()            -> db.notebooks.toArray() + 统计 noteCount
exportNotebook(id, onProgress?) -> 读取旧数据 → 构建 ZIP → 返回 Blob
```

### Phase 7: Adapter 接入

25. `WebDavTransport` (实现 `FsTransport`)，验证 WebDAV 同步
26. Extension 端适配 (复用 core Service，消除 background fs-handler 重复代码)

### Phase 8: 清理

27. 移除旧 Dexie schema (保留迁移检测)
28. 移除旧 Service 代码
29. 清理无用依赖
30. 移除 `/playground/opfs` 验证页面

---

## 8. 风险与注意事项

### 8.1 OPFS 限制

- **浏览器支持**: Chrome 86+, Firefox 111+, Safari 15.2+。考虑降级方案。
- **配额限制**: 浏览器可能限制存储配额。需监听 `navigator.storage.estimate()`。
- **性能**: OPFS 同步 API 在主线程可能阻塞。高频操作考虑 Web Worker。
- **隐私模式**: 部分浏览器在隐私模式下不支持 OPFS。

### 8.2 数据安全

- **旧数据永不删除**: 开发全过程中旧 Dexie 数据 (`TimenoteDB`)、localStorage (S3 配置等) 始终保留
- **新旧存储隔离**: OPFS (新) vs IndexedDB `TimenoteDB` (旧) 完全独立，互不影响
- **新索引可重建**: `TimenoteVaultIndex` 随时可从 OPFS 完全重建，不需要备份
- **fail-safe 写入**: 所有写操作先写 OPFS 文件再更新索引
- **sync-ledger 可重建**: 作为辅助数据，可从核心数据重建

### 8.3 性能考量

- `menu.json` 整体读写: 10000 节点约 200KB，读写性能可接受
- `sync-ledger.json`: 100k 条目约 15MB，gzip 后 1.5MB。考虑只在同步时加载
- IndexedDB 索引重建: 10000 笔记约 2-5 秒，显示进度条
- 内存缓存加载: 10000 笔记约 3-5 秒 (与 IndexedDB 重建同步进行)
