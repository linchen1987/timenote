# Note Attachment Support

## Overview

支持在笔记中附带图片或附件。附件不是嵌入 markdown 正文中，而是像邮件附件 / Twitter / 小红书 post 图片一样，附在 note 下方。Note 格式仍为 markdown。

## Requirements

- 附件与 md 正文分离，附在 note 上（类似邮件附件、Twitter 图片）
- Note 格式仍为 markdown，附件自包含在 note 的文件体系中
- 交互：手动上传 + 粘贴上传（类似 Twitter）
- 支持去重：不同 note 可引用同一附件（物理存储一份）
- 不改变现有 sync-ledger 同步方案的核心设计
- 编辑期间上传的文件不写入 vault，保存时一次性持久化，cancel 不污染 vault

## Architecture: Three Independent Layers

```
┌─────────────────────────────────────────────────┐
│ Layer 3: Sync Ledger                            │
│   跟踪 vault 中所有文件（note + attachment）       │
│   按 path 索引，不关心文件类型                      │
│   sync 算法对 attachment 透明                      │
├─────────────────────────────────────────────────┤
│ Layer 2: Note Attachment Config (Frontmatter)   │
│   每个 note 的 frontmatter 中声明附件引用          │
│   path 字段定位文件，metadata 字段提供展示信息       │
│   不关心文件物理存储在哪，只声明路径                  │
├─────────────────────────────────────────────────┤
│ Layer 1: Physical Storage                       │
│   文件在 OPFS / Remote 上的实际存储位置             │
│   支持多种存储策略（可共存）                        │
│   当前实现 assets（hash-based），未来可扩展          │
└─────────────────────────────────────────────────┘
```

三层的独立性：
- Physical storage 变化不影响 frontmatter 格式（只需更新 path 值）
- Frontmatter 格式变化不影响 sync ledger 结构
- Sync ledger 变化不影响 physical storage 布局

---

## Layer 1: Physical Storage

### Supported Storage Schemes

底层设计支持多种存储策略共存，通过 path 前缀区分：

| Scheme | Path Pattern | 特点 | Status |
|---|---|---|---|
| Hash-based centralized | `assets/{hash[:2]}/{hash}.{ext}` | 去重、跨 note 共享 | Phase 1 实现 |
| Per-note directory | `{volume}/{noteId}/{filename}` | 简单生命周期、无需 GC | 未来可选 |

两种策略可以在同一个 vault 中共存。`classifyEntry()` 通过 path 前缀和模式匹配识别。

### Hash-based Centralized Storage（Phase 1 实现）

```
vault-root/
  .timenote/
    manifest.json
    menu.json
    delete-log.json
    sync-ledger.json
  2026-04/
    20260425-121000-0457.md
    20260425-130000-0789.md
  assets/
    a1/                              # hash 前 2 字符分片（避免单目录膨胀）
      b2c3d4e5f6789...png            # {sha256-hash}.{ext}
    f7/
      g8h9i0j1k2abc...pdf
```

- 文件名 = 内容 SHA-256 hash + 扩展名
- 同一内容只存一份（去重）
- 写入前计算 hash，检查 `assets/{hash[:2]}/{hash}.{ext}` 是否已存在
- `name`, `mime`, `size` 等展示信息由 frontmatter 提供，不依赖文件名

### Per-note Directory Storage（未来可选）

```
vault-root/
  2026-04/
    20260425-121000-0457.md
    20260425-121000-0457/            # note 的附件子目录
      photo.png                      # 自定义文件名
      report.pdf
```

- 生命周期与 note 绑定（删 note = 删子目录）
- 无需 GC
- 不支持跨 note 去重

### classifyEntry 扩展

```typescript
type EntryType =
  | 'manifest'
  | 'syncLedger'
  | 'meta'
  | 'note'
  | 'attachment'       // NEW
  | 'unrecognized';
```

识别规则：
- `assets/` 前缀 → `attachment`（hash-based centralized）
- `{volume}/{noteId}/` 下非 note 文件 → `attachment`（per-note directory，未来）
- 其余规则不变

### Binary I/O

当前 `VaultFs` 接口仅有 `read(path): string` / `write(path, content: string)`。需要扩展：

```typescript
interface VaultFs {
  // existing
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  // new: binary support
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
  // existing
  remove(path: string): Promise<void>;
  list(path: string): Promise<FsStat[]>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
}
```

OPFS transport 已有 `readBinary` / `writeBinary`，只需在 VaultFs 接口层声明。Remote transport（WebDAV/S3）需补充 binary 实现。

---

## Layer 2: Note Attachment Config (Frontmatter)

### Schema

```yaml
---
created_at: "2026-04-25T13:00:00Z"
updated_at: "2026-04-25T12:10:00Z"
tags: [tag1, tag2]
attachments:
  - path: "assets/a1/b2c3d4e5f6789.png"
  - path: "assets/f7/g8h9i0j1k2abc.pdf"
    name: "report.pdf"
    mime: "application/pdf"
    size: 98765
---
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | **Yes** | 附件文件路径，相对于 vault root。直接定位物理文件，也是 sync ledger 中的 key |
| `name` | `string` | No | 原始文件名，用于 UI 展示和下载。未提供时从 `path` 末尾提取 |
| `mime` | `string` | No | MIME type，用于前端预判展示方式（图片预览 vs 文件图标）。未提供时从扩展名推断 |
| `size` | `number` | No | 文件字节数，用于 UI 显示大小。未提供时可从文件系统读取 |

设计原则：
- **`path` 是唯一必填字段**，足以定位和同步附件
- 其他字段都是缓存性质的优化，缺失时可通过文件系统补全
- `path` 直接映射物理存储路径，不需要额外的解析或映射逻辑
- 不同存储策略通过 `path` 的格式自然区分

### Path 设计思路

`path` 采用 **vault-root-relative** 格式（相对于 vault root，无前导 `/`）。

**为什么不用 Protocol (xxx://)**：
- 当前所有附件都在 vault 内部，添加 protocol 层需要 resolver 做映射，增加复杂度但无当前收益
- `path` 的前缀天然区分存储策略（`assets/` vs `{volume}/{noteId}/`），起到类似 protocol 的路由作用，但无需额外解析层
- 如果未来需要引用 vault 外部资源（如外部 URL），扩展方式是 additive 的：可在 `path` 中直接使用 `https://` 前缀，或新增 `type` 字段区分，不破坏现有格式

**为什么不用绝对路径**：
- Vault 跨 OPFS / S3 / WebDAV 部署，没有跨后端有意义的绝对路径
- OPFS 物理路径 `vaults/{projectId}/...` 是 transport 实现细节，不应暴露到数据层
- 绝对路径会导致 frontmatter 不可移植（同一个 vault 导出到 ZIP 再导入，路径全部失效）

**为什么用 vault-root-relative**：
- 与现有体系一致：sync ledger 的 `entities` key 用这个约定（`2026-04/xxx.md`），VaultFs 的 read/write 基于这个约定
- 所有 transport（OPFS / S3 / WebDAV）内部处理 vault root 到实际存储的映射，`path` 层不感知
- 可移植：vault 导出/导入、ZIP 打包时路径不变
- 简单：`classifyEntry(path)` 用前缀和正则匹配即可分类，无需解析协议

### Dedup: Cross-Note Reference

两个 note 引用同一张图片（hash 相同 → 同一 path）：

```yaml
# Note A
attachments:
  - path: "assets/a1/b2c3d4e5f6789.png"
    name: "screenshot.png"

# Note B（引用同一文件）
attachments:
  - path: "assets/a1/b2c3d4e5f6789.png"
    name: "same-photo.png"
```

物理文件只存一份，`name` 可 per-note 不同。

`assets/` 目录说明：
- 行业通用命名（Hugo、Jekyll、Flutter 等都用 `assets/`）
- 无前缀 `_`，它不是隐藏目录，会被 sync、GC 扫描，开发时也会直接查看
- 与 `.timenote/`（隐藏的内部元数据目录）区分

### 数组顺序

`attachments` 数组顺序 = UI 展示顺序（类似 Twitter 图片排列）。

---

## Layer 3: Sync Ledger

### Ledger Structure（不改 schema，扩展 entities 内容）

```json
{
  "version": 1,
  "entities": {
    "2026-04/20260425-121000-0457.md": { "h": "abc123...", "u": "2026-04-25T12:10:00Z" },
    "assets/a1/b2c3d4e5f6789.png": { "h": "b2c3d4e5f6789...", "u": "2026-04-25T12:10:00Z" },
    "assets/f7/g8h9i0j1k2abc.pdf": { "h": "g8h9i0j1k2abc...", "u": "2026-04-25T14:30:00Z" }
  },
  "meta_files": {
    "manifest.json": { "h": "...", "u": "..." },
    "menu.json": { "h": "...", "u": "..." }
  }
}
```

- 附件文件加入 `entities` map，key = path（与 frontmatter 中 `path` 一致）
- Sync 算法零改动——只比较 hash 和 timestamp，不关心文件类型
- 天然高效：hash-based storage 下，hash 即文件名，两端 hash 匹配则跳过传输

### Required Sync Changes

| Component | Change |
|---|---|
| `vault-layout.ts` `classifyEntry()` | 新增 `assets/` 识别 → `attachment` 类型 |
| `build-ledger.ts` | 扫描 `assets/` 子目录，binary hash，加入 `entities` |
| `execute-plan.ts` | 根据路径或扩展名判断 binary 文件，使用 `readBinary` / `writeBinary` |
| `VaultFs` | 添加 `readBinary` / `writeBinary` |
| `RemoteTransport` | WebDAV/S3 adapter 补充 binary read/write |
| sync 算法 | **不改** |
| sync-ledger schema | **不改** |
| delete-log | **不改** |

### Delete Cascading

删除 note 时：
1. 删除 `.md` 文件（现有逻辑不变）
2. 记录 delete-log（现有逻辑不变）
3. 对被删 note 的每个 attachment path，在 ledger builder 中创建 tombstone
4. GC 检查：扫描其他 note frontmatter，如无引用则删除物理文件

Ledger builder 在构建时：
- 扫描 delete-log，为已删除 note 的附件路径也创建 tombstone
- 与 note 的 tombstone 逻辑一致，只是路径不同

---

## Edit-Time Staging（编辑期间的附件管理）

**原则：编辑期间上传的文件不写入 vault，保存时一次性持久化。Cancel 不产生任何副作用。**

### State Model

```
EditingState {
  body: string                         // markdown 正文（内存中）
  attachments: StagedAttachment[]      // 附件列表（内存中）
  removedPaths: string[]               // 本次编辑中移除的已有附件 path
}

StagedAttachment =
  | { type: 'existing', path: string, ...meta }    // vault 中已存在的附件
  | { type: 'pending', file: File, path: string }   // 新上传尚未持久化的附件
```

### Lifecycle

```
开始编辑
  → 从 vault 加载 note + attachments 到 EditingState
  → 现有附件标记为 type: 'existing'

上传新文件
  → 文件保留在内存（File/Blob 对象）
  → 预计算 hash，生成 path（如 assets/a1/b2c3d4e5f6...png）
  → 添加到 attachments，标记 type: 'pending'
  → 不写入 vault

删除已有附件
  → 从 attachments 移除
  → path 加入 removedPaths
  → 不删除 vault 文件

保存 (Save)
  → 1. 写入 pending 文件到 vault（readBinary from File → writeBinary to vault）
  → 2. 写入更新后的 note .md（包含最新 attachments frontmatter）
  → 3. 删除 removedPaths 中的文件（带 GC 检查）
  → 4. 标记 sync dirty

取消 (Cancel)
  → 丢弃 EditingState
  → vault 无任何变化
```

### 去重与 Staging

上传文件时计算 hash：
- hash 已存在于 vault `assets/` 中 → `path` 指向已有文件，`type: 'pending'` 但无需写文件（save 时跳过）
- hash 不存在 → save 时写入新文件

这避免了重复上传相同内容。

### 粘贴上传

粘贴事件处理：
1. 检测 `clipboardData.files`
2. 对每个 file 执行与手动上传相同的 staging 流程
3. 不直接写入 vault

---

## Garbage Collection

去重存储需要 GC，但实现简单。

### 时机

- 删除 note 时即时检查
- vault activation 时可做一次全量 GC（懒回收）

### 方法

```
fullGC():
  referenced = 扫描所有 note frontmatter 中的 attachment path → Set<string>
  stored = 列出 assets/ 下所有文件 path → Set<string>
  orphan = stored - referenced
  for each path in orphan: delete file
```

即时 GC（删除 note 时）：
```
deleteNoteWithGC(noteId):
  note = read note frontmatter
  deleteNote(noteId)                    // 现有逻辑
  for each attachment in note.attachments:
    if no other note references attachment.path:
      delete file at attachment.path
```

开销低：frontmatter 解析轻量，个人 vault 规模有限。

---

## UI/UX Design

### Upload Interactions

| Action | Behavior |
|---|---|
| 点击上传按钮 | File picker，多选，限制类型（image/*, application/pdf 等） |
| 粘贴 (Ctrl+V) | 检测 `clipboardData.files`，支持多文件 |
| 拖拽 | `onDrop` handler |

所有上传操作都走 staging，不立即写入 vault。

### Display

```
┌─────────────────────────────────┐
│ #tag1  #tag2          12:10     │  ← existing note header
│                                 │
│ Markdown 正文内容...             │  ← existing editor area
│                                 │
│ ┌─────┐ ┌─────┐ ┌─────┐       │  ← attachment zone
│ │ img │ │ img │ │ pdf │       │     类似 Twitter / 小红书
│ │  0  │ │  1  │ │  2  │       │     图片 grid，PDF 图标+文件名
│ └─────┘ └─────┘ └─────┘       │
│                     ✕ ✕ ✕     │  ← 编辑态可删除
└─────────────────────────────────┘
```

- 图片：缩略图 grid（自适应列数），点击放大预览
- 非图片：图标 + 文件名，点击下载
- 编辑态和只读态都可见附件
- TipTap editor 不改，附件区域是独立组件 `<AttachmentZone>`

### Attachment Preview（图片查看）

已有附件：从 vault `readBinary(path)` → `URL.createObjectURL()` → `<img>`。
新上传但未保存的附件：直接用 `File` / `Blob` 对象 → `URL.createObjectURL()` → `<img>`。

---

## Service Layer

### AttachmentService

```
writeAttachmentFile(path, data: ArrayBuffer)
  → 检查文件是否已存在（去重：hash-based path 已存在则跳过）
  → 不存在则 writeBinary(path, data)

readAttachmentFile(path)
  → readBinary(path) → ArrayBuffer

deleteAttachmentFile(path)
  → remove(path)

findExistingPath(file: File)
  → 计算 hash，生成 path（`assets/{hash[:2]}/{hash}.{ext}`）
  → 检查 exists(path)
  → 返回 path 或 null

gcCheckAndDelete(path)
  → 扫描其他 note frontmatter，检查是否有引用此 path
  → 无引用则 deleteAttachmentFile(path)
```

### NoteService 扩展

```
saveNoteWithAttachments(projectId, noteId, body, stagedAttachments, removedPaths)
  → 1. for each pending attachment: writeAttachmentFile(path, data)
  → 2. serializeNote(frontmatter + body) → write .md
  → 3. for each removedPath: gcCheckAndDelete(path)
  → 4. notifyNoteChange() → sync dirty

deleteNote(projectId, noteId)   // 现有逻辑扩展
  → 读取 frontmatter 获取 attachment paths
  → 删除 .md（现有）
  → 记录 delete-log（现有）
  → 对每个 attachment: gcCheckAndDelete(path)
```

### Dedup Flow

```
用户上传 file
  → computeHash(file) → hash
  → path = `assets/${hash[:2]}/${hash}.${ext}`
  → if exists(path): 复用，staging 标记无需写文件
  → else: staging 保存 file 对象，save 时写入
```

---

## Impact Summary

| Layer | Effort | Description |
|---|---|---|
| `spec/` | Small | attachment frontmatter schema + classifyEntry 扩展 |
| `provider/` | Small | VaultFs binary 接口声明（OPFS 已有实现） |
| `core/` (sync) | Medium | build-ledger 附件扫描、execute-plan binary、级联 tombstone |
| `service/` | Medium | AttachmentService、NoteService save/delete 扩展、GC |
| `ui/` | Medium | AttachmentZone、staging state、上传/粘贴/拖拽、图片预览 |
| `web/routes` | Small | 接入 AttachmentService |

**不需要改的**：sync 算法核心、sync-ledger schema 结构、delete-log 格式、menu 结构。

## Implementation Phases

1. **Phase 1 - Data Model + Storage**: spec 定义（attachment frontmatter schema + classifyEntry）、VaultFs binary 接口、AttachmentService 基础文件操作
2. **Phase 2 - Service + Edit Staging**: saveNoteWithAttachments、staging state 管理、GC 逻辑
3. **Phase 3 - Sync**: build-ledger 附件扫描、execute-plan binary 支持、级联 tombstone
4. **Phase 4 - UI**: AttachmentZone 组件、上传/粘贴/拖拽、图片预览、Timeline + NoteDetail 集成
