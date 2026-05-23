# Timenote CLI 设计文档

## 1. 概述

Timenote CLI 是一个命令行工具，供人类用户和 AI Agent 使用。复用 `@timenote/core` 的核心逻辑，将本地文件系统作为 vault 存储，通过 WebDAV/S3 远程 provider 进行 clone/sync。

设计哲学：**vault 即目录**，像 git repo 一样自包含。每个 vault 是一个独立目录，remote 配置存放在 vault 内部。

### 核心用例

- Clone notebook 到本地，管理 note（create/update/delete, sync）
- Agent 分析 notebookA 中的数据，生成结果写入 notebookB
- Agent 分析过往 note，生成新的 note

### 非目标（v1 不支持）

- Menu 管理、Attachment 管理、Import/Export ZIP、交互式 TUI
- note list / note read（用户可直接 `ls`/`cat`/`grep` 文件）

---

## 2. 架构

```
┌─────────────────────────────────────────────────────────┐
│  CLI Entry (apps/cli/)                                  │
│  commander commands → CliApp                            │
├─────────────────────────────────────────────────────────┤
│  CliApp (粘合层)                                        │
│  组合 NodeVaultService + SyncService + note-ops          │
├─────────────────────────────────────────────────────────┤
│  @timenote/core (复用)                                   │
│  spec/, note-ops, sync-algorithm, build-ledger,          │
│  execute-plan, note-id, vault-layout                     │
├─────────────────────────────────────────────────────────┤
│  Provider Adapters                                      │
│  NodeFsTransport (本地) + FsClient (WebDAV/S3)           │
│  FsClient 从 apps/web 提取到 core                        │
└─────────────────────────────────────────────────────────┘
```

### 2.1 core 层与浏览器耦合点及 CLI 替代

| 模块 | 浏览器依赖 | CLI 替代 |
|------|-----------|---------|
| `VaultService` | OPFS (`navigator.storage`) | `NodeVaultService` (Node.js `fs`) |
| `NoteService` (索引部分) | IndexedDB (Dexie) | 不使用索引 |
| `provider-registry` | `localStorage` | `~/.config/timenote/providers.json` |
| `notebook-remotes` | `localStorage` | `.timenote/remotes.json` (vault 内部) |
| `hash.ts` | `crypto.subtle` | Node.js 18+ 已原生支持 |

### 2.2 VaultStore 与 CLI 的关系

`VaultStore`（Zustand store, 677 行）是浏览器端的 UI 状态管理层。它将底层 services 编排在一起，加入了 React 状态、localStorage、sessionStorage、debounce auto-sync 等。

CLI 不使用 VaultStore，原因：
- 无 React、无 DOM、无 localStorage/sessionStorage
- 不需要 UI 状态管理

CLI 直接组合底层 services（VaultService、SyncService），编排逻辑（clone/sync 流程）在 CliApp 中实现。这些编排很薄（约 10-20 行/功能），不会与 VaultStore 产生显著代码重复。真正的业务逻辑在 sync-algorithm、build-ledger、execute-plan 等模块中，CLI 直接复用。

### 2.3 NoteService 的拆分

`NoteService`（`packages/core/src/service/note-service.ts`）包含两类逻辑：

**CRUD 业务逻辑**（平台无关，可复用）：
- `createNote`：generateNoteId → extractTagsFromBody → serializeNote → transport.write
- `updateNote`：read existing → parseNote → merge tags → serializeNote → transport.write
- `deleteNote`：read note → remove file → appendDeleteLog

**IndexedDB 索引管理**（浏览器专属）：
- `activateVault`：创建 IndexService，扫描文件，构建索引
- `listNotes`/`searchNotes`/`getNotesByTag`：基于索引查询
- CRUD 后更新索引的 side-effect

CLI 需要前者，不需要后者。做法：将 CRUD 业务逻辑提取为 core 中的纯函数 `packages/core/src/service/note-ops.ts`，接受 transport 作为参数。浏览器 NoteService 调用 note-ops + 更新索引，CLI 调用 note-ops 不更新索引。

```typescript
// packages/core/src/service/note-ops.ts (新增)

export async function createNoteOp(
  transport: { write(path: string, content: string): Promise<void> },
  content: string,
): Promise<string>;

export async function updateNoteOp(
  transport: {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  },
  noteId: string,
  content: string,
): Promise<void>;

export async function deleteNoteOp(
  transport: {
    read(path: string): Promise<string>;
    remove(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  },
  appendDeleteLog: (noteId: string) => Promise<void>,
  noteId: string,
): Promise<void>;
```

---

## 3. 目录结构

```
apps/cli/
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    main.ts
    commands/
      clone.ts
      pull.ts
      sync.ts
      note.ts              # create / update / delete
      config.ts            # add-provider / list-providers / remove-provider
      remote.ts            # set / remove
    lib/
      cli-app.ts
      node-vault-service.ts
      node-fs-transport.ts
      node-transport.ts    # FsClient → RemoteTransport 适配
      config-store.ts      # ~/.config/timenote/providers.json
```

---

## 4. 存储设计

### 4.1 Vault 目录结构

```
my-diary/                        # vault 根目录
  .timenote/                     # 类比 .git/
    manifest.json                # vault 身份 (syncable)
    menu.json                    # sidebar 菜单 (syncable)
    delete-log.json              # 删除记录 (syncable)
    sync-ledger.json             # 同步状态 (non-syncable, 可重建)
    remotes.json                 # remote 配置 (non-syncable)
  2026-05/                       # volume 目录
    20260521-143022-7891.md      # note 文件
  assets/                        # 附件
```

`.timenote/` 中的文件区分 syncable / non-syncable，sync 引擎只同步标记为 syncable 的文件。`sync-ledger.json` 已是 non-syncable，`remotes.json` 同理。在 `vault-layout.ts` 的 `META_FILES` 中添加：

```typescript
'remotes.json': { core: false, syncable: false },
```

### 4.2 全局配置

```
~/.config/timenote/
  providers.json                 # provider 列表 (WebDAV/S3 连接信息)
```

类比 git 的 `~/.gitconfig` 存储 credential，而 remote 地址在 repo 内。

### 4.3 Vault 内 remote 配置 (`.timenote/remotes.json`)

沿用 core 中 `RemoteEntry` 类型：

```typescript
interface RemoteEntry {
  providerId: string;
  path: string;
  enabled: boolean;
}
```

文件格式：

```json
{
  "origin": {
    "providerId": "webdav:user@https://dav.example.com",
    "path": "timenote/vaults/vA1b2c3d4e5",
    "enabled": true
  }
}
```

---

## 5. 核心模块设计

### 5.1 NodeFsTransport

基于 `node:fs/promises` 实现 `RemoteTransport` 接口：

```typescript
// src/lib/node-fs-transport.ts

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FsStat } from '@timenote/core';

export function createNodeFsTransport(rootDir: string) {
  const resolve = (p: string) => path.join(rootDir, p);

  return {
    async list(dirPath: string): Promise<FsStat[]> {
      const entries = await fs.readdir(resolve(dirPath), { withFileTypes: true });
      return entries.map((e) => ({
        filename: dirPath ? `${dirPath}/${e.name}` : e.name,
        basename: e.name,
        lastmod: new Date().toISOString(),
        size: 0,
        type: e.isDirectory() ? 'directory' as const : 'file' as const,
      }));
    },

    async read(filePath: string): Promise<string> {
      return fs.readFile(resolve(filePath), 'utf-8');
    },

    async write(filePath: string, content: string): Promise<void> {
      const full = resolve(filePath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, 'utf-8');
    },

    async readBinary(filePath: string): Promise<ArrayBuffer> {
      const buf = await fs.readFile(resolve(filePath));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },

    async writeBinary(filePath: string, data: ArrayBuffer): Promise<void> {
      const full = resolve(filePath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, Buffer.from(data));
    },

    async remove(filePath: string): Promise<void> {
      await fs.unlink(resolve(filePath)).catch(() => {});
    },

    async exists(filePath: string): Promise<boolean> {
      return fs.access(resolve(filePath)).then(() => true, () => false);
    },

    async ensureDir(dirPath: string): Promise<void> {
      await fs.mkdir(resolve(dirPath), { recursive: true });
    },

    isConfigured(): boolean {
      return true;
    },
  };
}
```

### 5.2 NodeVaultService

替代 OPFS 版本的 `VaultService`，接口一致但基于 `NodeFsTransport`。

接收 vault 根目录路径，直接操作该目录。核心方法：
- `initVault(rootDir, projectId, name)` → 创建 `.timenote/` 结构
- `getTransport(rootDir)` → `NodeFsTransport(rootDir)`
- `readManifest / readDeleteLog / appendDeleteLog` → 基于 transport 读写

### 5.3 NodeRemoteTransport

`FsClient` → `RemoteTransport` 适配。`FsClient`（需从 web app 提取到 core）的方法签名与 `RemoteTransport` 高度吻合，薄包装即可。

### 5.4 CliApp

```typescript
// src/lib/cli-app.ts

export class CliApp {
  // -- 定位 vault 目录 --

  static resolveVaultDir(explicitDir?: string): string;
  // 指定 dir → 使用它
  // 否则从 cwd 向上查找包含 .timenote/ 的目录（类似 git）

  // -- Vault 操作 --

  static async clone(providerId: string, remotePath: string, dirName?: string): Promise<void>;
  // 1. 从 providers.json 查找 provider
  // 2. 创建 RemoteTransport → 读取 manifest → 获取 projectId + name
  // 3. 创建本地目录 → initVault
  // 4. 写入 .timenote/remotes.json
  // 5. syncService.initFromSource() 拉取所有数据

  static async pull(vaultDir?: string): Promise<SyncResult>;
  // 读取 remotes.json → 创建 transport → direction=pull

  static async sync(vaultDir?: string): Promise<SyncResult>;
  // 读取 remotes.json → 创建 transport → direction=both

  // -- Note 操作 (委托 note-ops) --

  static async createNote(vaultDir: string, content: string): Promise<string>;
  static async updateNote(vaultDir: string, noteId: string, content: string): Promise<void>;
  static async deleteNote(vaultDir: string, noteId: string): Promise<void>;
}
```

### 5.5 ConfigStore

```typescript
// src/lib/config-store.ts

export class ConfigStore {
  static getConfigDir(): string;      // ~/.config/timenote/ (或 XDG_CONFIG_HOME)
  static listProviders(): ProviderConfig[];
  static getProvider(id: string): ProviderConfig | null;
  static saveProvider(config: ...): ProviderConfig;
  static deleteProvider(id: string): void;
}
```

---

## 6. 命令设计

### 6.1 `timenote config`

管理全局 provider 配置。

```
timenote config add-provider <type> [options]
timenote config list-providers
timenote config remove-provider <id>
```

```bash
timenote config add-provider webdav \
  --url https://dav.example.com --username user --password pass

timenote config add-provider s3 \
  --bucket my-bucket --endpoint s3.amazonaws.com \
  --access-key-id AKIA... --secret-access-key ...

timenote config list-providers
```

### 6.2 `timenote clone`

```
timenote clone <providerId>:<path> [dir-name]
```

```bash
timenote clone "webdav:user@dav.example.com:timenote/vaults/vA1b2c3d4e5" my-diary
timenote clone "s3:my-bucket@s3.amazonaws.com:timenote/vaults/vX9y8z7w6v5" reports
```

不指定 `dir-name` 时使用 manifest 中的 name。

### 6.3 `timenote remote`

```
timenote remote set <name> <providerId>:<path>
timenote remote remove <name>
```

需要在 vault 目录内执行（或 `--dir` 指定）。

```bash
cd my-diary
timenote remote set origin "webdav:user@dav.example.com:timenote/vaults/vA1b2c3d4e5"
timenote remote set backup "s3:my-bucket@s3.amazonaws.com:timenote/vaults/vA1b2c3d4e5"
timenote remote remove backup
```

### 6.4 `timenote pull`

```
timenote pull [--dir <vault-dir>]
```

从 remote 拉取更新。

```bash
cd my-diary && timenote pull
timenote pull --dir ~/notebooks/my-diary
```

### 6.5 `timenote sync`

```
timenote sync [--dir <vault-dir>]
```

双向同步。

### 6.6 `timenote note create`

```
timenote note create [options]
```

选项：`--content <text>`、`--file <path>`、`--tag <tag>`（可多次）、`--dir <vault-dir>`、`--json`。不提供内容时从 stdin 读取。

```bash
echo "# Hello" | timenote note create
timenote note create --file ./report.md
timenote note create --content "# Quick note" --tag daily --json
timenote note create --dir ~/notebooks/reports --content "report"
```

### 6.7 `timenote note update`

```
timenote note update <noteId> [options]
```

选项：`--content <text>`、`--file <path>`、`--append <text>`、`--dir <vault-dir>`。

```bash
timenote note update 20260521-143022-7891 --content "# Updated"
timenote note update 20260521-143022-7891 --append "\n## New section"
```

### 6.8 `timenote note delete`

```
timenote note delete <noteId> [--dir <vault-dir>]
```

---

## 7. 核心复用策略

### 7.1 直接复用（无需修改）

| 模块 | 路径 |
|------|------|
| Zod schemas | `spec/*` |
| note-id 生成 | `spec/note-id.ts` |
| note 解析/序列化 | `spec/note.ts` |
| vault-layout | `spec/vault-layout.ts` |
| hash 计算 | `spec/hash.ts` |
| sync-algorithm | `vault/sync-algorithm.ts` |
| build-ledger | `vault/build-ledger.ts` |
| execute-plan | `vault/execute-plan.ts` |
| write-ledger | `vault/write-ledger.ts` |
| search-query | `service/search-query.ts` |

### 7.2 需要新增到 core 的代码

| 新增 | 说明 |
|------|------|
| `service/note-ops.ts` | 从 NoteService 提取 CRUD 纯函数 |
| `provider/fs-client.ts` | 从 `apps/web/app/services/fs-client.ts` 提取 FsClient |
| `vault-layout.ts` 新增 `remotes.json` 条目 | `{ core: false, syncable: false }` |

### 7.3 CLI 中替换实现

| 模块 | 替代 |
|------|------|
| `VaultService` | `NodeVaultService` (Node.js `fs`) |
| `VaultSyncService` | 组合 `NodeVaultService` |
| `provider-registry` | `~/.config/timenote/providers.json` |
| `notebook-remotes` | `.timenote/remotes.json` |
| RemoteTransport | `FsClient` 适配 |

---

## 8. 依赖

```json
{
  "dependencies": {
    "@timenote/core": "workspace:*",
    "commander": "^13.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.8.0"
  }
}
```

`webdav` 和 `@bradenmacdonald/s3-lite-client` 在提取 `FsClient` 到 core 后成为 core 的依赖。

---

## 9. 实施计划

### Phase 1: core 层变更

1. 提取 `FsClient` 到 `packages/core/src/provider/fs-client.ts`
2. 提取 `note-ops.ts` 到 `packages/core/src/service/note-ops.ts`
3. `vault-layout.ts` 新增 `remotes.json` non-syncable 条目

### Phase 2: CLI 基础设施

4. 创建 `apps/cli/` 目录结构
5. 实现 `NodeFsTransport`
6. 实现 `ConfigStore`
7. 实现 `NodeVaultService`
8. 实现 `CliApp`

### Phase 3: 命令实现

9. `timenote config` — provider 管理
10. `timenote clone`
11. `timenote remote` — set / remove
12. `timenote pull` / `timenote sync`
13. `timenote note create / update / delete`

### Phase 4: 打磨

14. 错误处理
15. 测试
16. README

---

## 10. Agent 使用示例

```bash
# 配置 provider
timenote config add-provider webdav \
  --url https://dav.example.com --username bot --password $PASS

# Clone 两个 vault
mkdir -p ~/work && cd ~/work
timenote clone "webdav:bot@dav.example.com:timenote/vaults/vA1b2c3d4e5" source
timenote clone "webdav:bot@dav.example.com:timenote/vaults/vX9y8z7w6v5" output

# 读文件（直接用 Unix 工具）
cat source/2026-05/20260521-143022-7891.md
grep -r "关键词" source/

# 写入 output vault
timenote note create --dir output \
  --content "# Report\n\n$(date)" --tag report --json

# 同步
timenote sync --dir output
```
