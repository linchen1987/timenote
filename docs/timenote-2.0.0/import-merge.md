# Import 合并到已有 Vault — 执行文档

## 背景

当前 `importVault` 仅支持创建全新 vault，遇到相同 `project_id` 时直接 throw。
需要支持将 ZIP 导入并合并到已有 vault，逻辑与 sync(pull) 一致。

## 核心思路

Import 合并 = 把 ZIP 当作 "远端"，复用 sync 的 ledger 对比算法。

- ZIP 作为只读远端（不需要 FsTransport 适配，直接读 JSZip 条目）
- 从 ZIP 文件内容构建 `SyncLedger`（类似 `buildLocalLedger`）
- 用 `compareEntities(local, zip, 'pull')` 生成同步计划
- 执行 pull 计划，写入本地 OPFS
- 合并 ledger + 重建索引

## 变更清单

### 1. `packages/core/src/vault/service/import-service.ts`

#### 1.1 新增 `parseManifest`

```ts
static async parseManifest(file: File): Promise<Manifest>
```

- 读取 ZIP 中的 `.timenote/manifest.json`
- 验证格式（ManifestSchema.parse）
- 不执行任何写入操作
- 用途：UI 层检测冲突

#### 1.2 新增 `importAndMerge`

```ts
async importAndMerge(projectId: string, file: File): Promise<ImportResult>
```

流程：

1. 解析 ZIP，验证 manifest
2. 安全校验：manifest.project_id 与目标 projectId 匹配（不匹配则 abort，防止误合并）
3. **构建 ZIP ledger**：
   - 遍历 ZIP 条目，筛选 note 文件（`classifyEntry === 'note'`）
   - 读取每个 note 的 frontmatter 获取 `updated_at`
   - 计算 content hash（`computeContentHash`）
   - 读取 ZIP 中的 `delete-log.json`，将 records 转为墓碑条目
   - 读取 ZIP 中的 meta files（menu.json, delete-log.json），计算 hash
   - 组装为 `SyncLedger`
4. **构建 local ledger**：调用 `syncService.buildLocalLedger(projectId)`
5. **比对**：`compareEntities(local.entities, zip.entities, 'pull')` + meta 比对
6. **执行 pull**：
   - `toPull`：从 ZIP 读取内容 → `transport.write(key, content)`
   - `toDeleteLocal`：`transport.remove(key)` + 更新本地 delete-log
   - meta toPull：从 ZIP 读取 → `transport.write(metaPath, content)`
7. **合并 ledger**：`mergeEntities` → `vaultService.writeSyncLedger`
8. **重建索引**：`noteService.rebuildIndex(projectId)`
9. 返回 `ImportResult`（扩展字段见下文）

#### 1.3 `ImportResult` 扩展

```ts
export interface ImportResult {
  projectId: string;
  vaultName: string;
  notesCount: number;
  merged: number;    // 新增：合并的文件数
  deleted: number;   // 新增：删除的本地文件数
  conflicts: number; // 新增：冲突数（已自动按 timestamp 解决）
  errors: string[];
}
```

保持向后兼容，新建 vault 时 `merged=0, deleted=0, conflicts=0`。

### 2. `packages/core/src/vault/service/sync-service.ts`

#### 2.1 `buildLocalLedger` 改为 public

当前已是 public（`VaultSyncService` interface 上的方法），无需改动。

### 3. `apps/web/app/lib/vault-store.ts`

#### 3.1 新增 `checkImportConflict`

```ts
async checkImportConflict(file: File): Promise<{
  needsMerge: boolean;
  existingProjectId?: string;
  manifest: { project_id: string; name: string };
}>
```

- 调用 `importService.parseManifest(file)`
- 对比 `vaults` 列表
- 返回是否需要合并 + 匹配的 projectId

#### 3.2 新增 `importAndMerge`

```ts
async importAndMerge(projectId: string, file: File): Promise<ImportResult>
```

- 透传给 `importService.importAndMerge(projectId, file)`
- 之后 `await get().listVaults()` 刷新列表

### 4. `apps/web/app/routes/notebooks.tsx`

#### 4.1 修改 `handleImport`

新流程：

```
用户选择文件
  → checkImportConflict(file)
  → if needsMerge:
      弹出 AlertDialog: "笔记本 {name} 已存在，是否合并？"
      确认 → importAndMerge(existingProjectId, file)
      取消 → 中止
  → else:
      importVault(file)  // 原有逻辑
```

#### 4.2 UI 组件

使用 shadcn `AlertDialog` 作为确认对话框：

- 标题：「合并笔记本」
- 内容：「"{name}" 已存在。合并将把导入数据与已有数据对比，新增缺失的笔记，冲突时保留较新的版本。此操作不可撤销。」
- 确认按钮：「合并」
- 取消按钮：「取消」

需要引入 state 管理：

```ts
const [mergeDialog, setMergeDialog] = useState<{
  open: boolean;
  projectId?: string;
  manifest?: { project_id: string; name: string };
  file?: File;
}>({ open: false });
```

### 5. 导出改动

**不改动** `export-service.ts`。Export 仍不携带 `sync-ledger.json`。
合并时从 ZIP 文件内容重建 ledger，这是正确的——各端独立维护 ledger。

### 6. 不需要改动的文件

| 文件 | 原因 |
|------|------|
| `sync-algorithm.ts` | 完全复用，无需修改 |
| `vault-service.ts` | 复用 readSyncLedger / writeSyncLedger |
| `export-service.ts` | 仍不携带 sync-ledger |
| `vault-layout.ts` | 复用 classifyEntry / metaPath 等 |
| `sync-ledger.ts` | 复用 SyncLedger / SyncEntity schema |

## 执行顺序

1. `import-service.ts` — 新增 `parseManifest` + `importAndMerge`
2. `import-service.ts` — `importVault` 中补充 `merged/deleted/conflicts` 字段默认值
3. `vault-store.ts` — 新增 `checkImportConflict` + `importAndMerge`
4. `notebooks.tsx` — 修改 `handleImport` + AlertDialog
5. 测试 — 新增合并相关用例

## 测试用例

### `export-import.test.ts` 新增

| 用例 | 输入 | 预期 |
|------|------|------|
| 新文件合并 | ZIP 有 note A，本地无 note A | 合并后本地有 note A，merged=1 |
| 冲突-远端更新 | ZIP note A 更新，本地 note A 旧 | 本地 note A 被覆盖为 ZIP 版本 |
| 冲突-本地更新 | ZIP note A 旧，本地 note A 更新 | 保留本地版本，不做任何操作 |
| 删除传播 | ZIP delete-log 记录 note B 已删，本地有 note B | 本地 note B 被删除，deleted=1 |
| 本地独有文件 | 本地有 note C，ZIP 无 | note C 不受影响 |
| Meta 合并 | ZIP menu.json 更新 | 本地 menu.json 被覆盖 |
| project_id 不匹配 | manifest.project_id ≠ 目标 projectId | throw error |

## 边界情况

- ZIP 中没有 `delete-log.json` → 不处理删除，仅合并现有文件
- ZIP 中没有 `menu.json` → 跳过 meta 合并
- 空文件 → 正常处理（没有变更）
- ZIP 中包含 `sync-ledger.json` → 忽略（classifyEntry 返回 'syncLedger'，不参与合并）
- 合并过程中写入失败 → 记录 error，继续处理其他文件

## 数据流图

```
ZIP File
  │
  ├─ parseManifest() ──→ 检测冲突 ──→ UI 确认
  │
  └─ importAndMerge(projectId, file)
       │
       ├─ 扫描 ZIP entries
       │    ├─ note files → computeContentHash + parseNoteSafe → entities
       │    ├─ delete-log.json → tombstones
       │    └─ menu.json → meta_files
       │
       ├─ buildLocalLedger(projectId) → local ledger
       │
       ├─ compareEntities(local, zip, 'pull') → SyncPlan
       │
       ├─ 执行 SyncPlan
       │    ├─ toPull → ZIP.read → OPFS.write
       │    ├─ toDeleteLocal → OPFS.remove
       │    └─ meta toPull → ZIP.read → OPFS.write
       │
       ├─ mergeEntities → merged ledger
       ├─ writeSyncLedger(merged)
       └─ rebuildIndex()
```
