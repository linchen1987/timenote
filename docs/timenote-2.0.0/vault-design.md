# Timenote Vault 规范

> 代码即文档。各文件格式的 Zod Schema 和 Example 定义在 `packages/core/src/vault/spec/` 下，
> 本文档仅描述设计决策和总览，不重复 Schema 细节。

## 核心设计哲学

- timenote 是给个人使用的笔记应用，基于个人笔记考虑极简主义与性能平衡。
- 兼容文件系统
- 人类可读优先: 满足功能前提下，人类尽量基本可读
- 万物皆 markdown: 不直接处理图片或附件, 所有笔记均为 markdown 格式
- 结构化/白名单准入： 引擎仅识别符合正则规范的文件和路径，其余文件视为透明。

## 目录结构

```
/vault-root
  ├── .timenote/                        ← META_DIR
  │   ├── manifest.json                 ← core, syncable
  │   ├── menu.json                     ← core, syncable
  │   ├── delete-log.json               ← core, syncable
  │   └── sync-ledger.json              ← non-core, not syncable
  ├── {YYYY-MM}/                        ← Volume: ^[0-9]{4}-[0-9]{2}$
  │   └── {YYYYMMDD-HHmmss-SSSR}.md    ← Note: ^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$
  └── ...
```

> 常量定义和路径工具: [`spec/vault-layout.ts`](../../packages/core/src/vault/spec/vault-layout.ts)

## Core vs Non-Core

| 文件 | Core | Syncable | Schema 定义 |
|------|------|----------|-------------|
| `{volume}/{noteId}.md` | Yes | Yes (content) | [`spec/note.ts`](../../packages/core/src/vault/spec/note.ts) |
| `manifest.json` | Yes | Yes | [`spec/manifest.ts`](../../packages/core/src/vault/spec/manifest.ts) |
| `menu.json` | Yes | Yes | [`spec/menu.ts`](../../packages/core/src/vault/spec/menu.ts) |
| `delete-log.json` | Yes | Yes | [`spec/delete-log.ts`](../../packages/core/src/vault/spec/delete-log.ts) |
| `sync-ledger.json` | No (可重建) | No (各端独立写入) | [`spec/sync-ledger.ts`](../../packages/core/src/vault/spec/sync-ledger.ts) |

## 各文件设计要点

### manifest.json

- 项目唯一身份标识
- `config` / `extensions` 字段预留但暂不实现
- Schema: [`spec/manifest.ts`](../../packages/core/src/vault/spec/manifest.ts) — `ManifestSchema`

### menu.json

- 嵌套结构存储，运行时可用扁平结构
- 支持 10000 节点、1000 层级、拖拽
- Schema: [`spec/menu.ts`](../../packages/core/src/vault/spec/menu.ts) — `MenuDataSchema`
- 嵌套↔扁平转换: [`service/menu-transform.ts`](../../packages/core/src/vault/service/menu-transform.ts)

### delete-log.json

- 记录笔记删除时间戳
- sync 生成墓碑条目 (tombstone) 的来源
- Schema: [`spec/delete-log.ts`](../../packages/core/src/vault/spec/delete-log.ts) — `DeleteLogSchema`

### sync-ledger.json

- **entity key = 文件相对路径** (如 `"2026-04/20260425-112010-0457.md"`)
- 估算: 100k note × 150B = 15MB, gzip 后 ~1.5MB
- 1天写100条笔记，能支撑30年
- 不是核心数据，可通过核心数据重建
- Schema: [`spec/sync-ledger.ts`](../../packages/core/src/vault/spec/sync-ledger.ts) — `SyncLedgerSchema`

### 笔记文件 .md

- 物理文件 = Single Source of Truth
- Note ID 格式: `YYYYMMDD-HHmmss-SSSR` (4位随机数字后缀)
- Frontmatter 为 YAML，支持以下字段:

| 字段 | Required | 说明 |
|------|----------|------|
| `created_at` | Yes | ISO 8601 |
| `updated_at` | Yes | ISO 8601 |
| `_sync_u` | No | 覆盖 updatedAt |
| `tags` | No | `string \| string[]` |
| `title` / `titles` | No | `string \| string[]`，normalize 合并两者 |
| `aliases` / `alias` | No | 兼容 Obsidian |
| `type` / `types` | No | 默认 `markdown`，normalize 合并两者 |
| `deleted` | No | `boolean` |
| `[custom]` | No | passthrough |

- Schema: [`spec/note.ts`](../../packages/core/src/vault/spec/note.ts) — `NoteFrontmatterSchema`
- ID 生成: [`spec/note-id.ts`](../../packages/core/src/vault/spec/note-id.ts)

### Hold (暂不实现)

- `.timenote/cache/` — 缓存目录
- `.timenote/settings.json` — 设置
- `manifest.config` — 配置
- `manifest.extensions` — 插件系统
- sync-ledger 墓碑 30天过期自动清理

## Spec 总入口

[`spec/vault-spec.ts`](../../packages/core/src/vault/spec/vault-spec.ts) — re-exports 所有 Schema、类型、工具函数。

## Spec Utilities

| 文件 | 职责 |
|------|------|
| [`spec/note-id.ts`](../../packages/core/src/vault/spec/note-id.ts) | Note ID 生成 & 验证 |
| [`spec/project-id.ts`](../../packages/core/src/vault/spec/project-id.ts) | Project ID 生成 |
| [`spec/hash.ts`](../../packages/core/src/vault/spec/hash.ts) | 内容 Hash (MD5) |
| [`spec/vault-layout.ts`](../../packages/core/src/vault/spec/vault-layout.ts) | 目录结构、路径约定、文件分类 |
