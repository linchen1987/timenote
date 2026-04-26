# 数据迁移与导入导出设计

> 主文档: [design.md](./design.md)

---

## 1. 数据迁移

### 1.1 迁移策略

**优先级**: in-browser 数据迁移 (0.1.x Dexie → 0.2.0 OPFS)

```
┌──────────────┐                    ┌──────────────┐
│   Dexie DB   │   ─── 迁移 ───→   │   OPFS +      │
│  (0.1.x)     │                    │   IndexedDB   │
│              │                    │  (0.2.0)      │
└──────────────┘                    └──────────────┘
```

### 1.2 MigrationService

```typescript
interface MigrationService {
  needsMigration(): Promise<boolean>;
  migrate(onProgress?: (progress: MigrationProgress) => void): Promise<MigrationResult>;
}

interface MigrationProgress {
  phase: 'reading' | 'writing' | 'indexing';
  current: number;
  total: number;
  currentNotebook: string;
}

interface MigrationResult {
  notebooks: number;
  notes: number;
  errors: string[];
}
```

### 1.3 迁移步骤 (Dexie → ZIP)

> 注意: 迁移不直接写入 OPFS，而是导出为 ZIP 文件。用户通过 ImportService 导入为 vault。
> 好处: 可重复迁移、方便调试、旧数据完全不修改。

1. **检测**: 检查 Dexie 中是否有数据 (`db.notebooks.count() > 0`)

2. **读取**: 逐个 notebook 读取所有数据
   - notebooks → manifest
   - notes → markdown 文件 (构建 frontmatter)
   - menuItems → menu.json (扁平 → 嵌套转换)
   - tags/noteTags → 合入 frontmatter

3. **生成 ZIP**: 对每个 notebook:
   a. 构建 `manifest.json` (保留原 notebook ID 作为 project_id)
   b. 构建 `menu.json` (嵌套结构, oldId → newId 替换)
   c. 逐条生成笔记文件:
      - 从 `createdAt` 生成时间戳 ID，若冲突追加随机位
      - 构建 YAML frontmatter (含 tags)
      - 路径: `/YYYY-MM/{noteId}.md`
   d. 构建 `delete-log.json` (空)
   e. 用 JSZip 打包为 Blob → 触发浏览器下载

4. **导入**: 用户通过已有的 ImportService 导入 ZIP 为新 vault

### 1.4 ID 映射

0.1.x 的 note ID (`nanoid(12)`) 需要映射到 0.2.0 的时间戳 ID:

```
旧: "V1StGXR8_Z5J" (nanoid)
新: "20260425-121000-1234" (从 createdAt 生成)
```

**映射策略**: 不维护持久映射表。迁移时在内存中建立临时映射 `{ oldId → newId }`，用于更新 menu.json 中的引用。

### 1.5 MenuItems 扁平 → 嵌套转换

```typescript
function flatToNested(items: OldMenuItem[]): MenuItem[] {
  // 1. 按 parentId 分组
  // 2. 递归构建树 (parentId === null 为根)
  // 3. 按 order 字段排序
  // 4. 旧 target (noteId) 替换为新 ID
}
```

### 1.6 迁移保护

- 迁移在后台执行，不阻塞 UI (使用进度条)
- 迁移失败不删除旧数据，可重试
- **不写入完成标记**: 不修改 localStorage，不标记旧数据，可反复迁移
- **不修改旧数据**: 迁移只读取 Dexie，不做任何写入
- 旧 Dexie 数据迁移后保留，通过迁移页面的"清除旧数据"按钮手动删除
- 提供独立迁移页面 (`/migration`)，Phase 8 清理时可直接删除

### 1.7 Export 数据迁移 (Hold)

暂不实现。0.2.0 的导出数据 (ZIP) 可在未来提供迁移脚本。

---

## 2. 导出

### 2.1 格式

将 vault 目录结构打包为 ZIP，与 OPFS 中的物理结构**完全一致**:

```
{vault-name}.zip
  ├── .timenote/
  │   ├── manifest.json
  │   ├── menu.json
  │   └── delete-log.json
  ├── 2026-04/
  │   └── *.md
  └── 2026-05/
      └── *.md
```

### 2.2 ExportService

```typescript
interface ExportService {
  exportVault(projectId: string): Promise<Blob>;   // 返回 ZIP Blob
  downloadVault(projectId: string): Promise<void>; // 导出并触发下载
}
```

**实现**: 使用 `JSZip` 库:
1. 遍历 OPFS vault 目录
2. 逐文件添加到 JSZip (保持相对路径)
3. 生成 Blob 触发下载

**排除文件**: `sync-ledger.json` (本地同步状态，不应导出)

---

## 3. 导入

### 3.1 ImportService

```typescript
interface ImportService {
  importVault(file: File): Promise<string>;  // 返回 project_id
}
```

**实现**:
1. 使用 `JSZip` 解析 ZIP
2. 验证 `.timenote/manifest.json` 存在且格式正确
3. 验证笔记文件名符合正则 `/^[0-9]{8}-[0-9]{6}-[0-9]{4}\.md$/`
4. 保留原 `project_id` (若本地已存在相同 ID 则拒绝导入，提示冲突)
5. 写入 OPFS
6. 更新 vault 注册信息 (vault list)
7. 重建 IndexedDB 索引

### 3.2 安全考虑

- 验证 ZIP 大小限制 (防止解压炸弹，建议上限 100MB)
- 验证文件路径无 `..` (防止路径穿越)
- 仅接受符合正则的 `.md` 文件和 `.timenote/` 下的 JSON 文件，其余跳过
