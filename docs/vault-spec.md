# Timenote Vault 规范

> 代码即文档。各文件格式的 Zod Schema 和 Example 定义在 [`packages/core/src/spec/`](../packages/core/src/spec/) 下，
> 本文档仅描述设计决策和总览，不重复 Schema 细节。
> 总入口: [`vault-spec.ts`](../packages/core/src/spec/vault-spec.ts)

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
  │   └── sync-ledger.json              ← non-core, local only
  ├── {YYYY-MM}/                        ← Volume: ^[0-9]{4}-[0-9]{2}$
  │   └── {YYYYMMDD-HHmmss-SSSR}.md    ← Note: ^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$
  └── assets/                           ← Attachments: SHA-256 hash-based storage
      └── {hash[:2]}/                   ← Shard by first 2 hex chars
          └── {hash}.{ext}              ← Dedup: same hash = same file
```

> 路径常量和分类工具: [`vault-layout.ts`](../packages/core/src/spec/vault-layout.ts)

## Core vs Non-Core

**Core** (物理文件 = Single Source of Truth): 笔记 .md、assets 附件、manifest.json、menu.json、delete-log.json

**Non-Core** (可从核心数据重建): sync-ledger.json

| 文件 | 必须同步 |
|------|----------|
| `{volume}/{noteId}.md` | Yes (content) |
| `assets/{shard}/{hash}.{ext}` | Yes (binary) |
| `manifest.json` | Yes |
| `menu.json` | Yes |
| `delete-log.json` | Yes |
| `sync-ledger.json` | No (各端独立维护，可从核心数据重建) |

## 各文件规范

### manifest.json

项目唯一身份标识。定义: [`manifest.ts`](../packages/core/src/spec/manifest.ts)

### menu.json

- 嵌套结构持久化，运行时转换为扁平结构 (id/parentId/order)
- 支持 10000 节点、1000 层级、拖拽
- 定义: [`menu.ts`](../packages/core/src/spec/menu.ts)

### delete-log.json

记录笔记删除时间戳，sync 生成墓碑条目 (tombstone) 的来源。定义: [`delete-log.ts`](../packages/core/src/spec/delete-log.ts)

### sync-ledger.json

- entity key = 文件相对路径 (如 `"2026-04/20260425-112010-0457.md"`)
- 两个分区: `entities` (笔记和附件) + `meta_files` (manifest.json、menu.json 等)
- 估算容量: 100k note × 150B = 15MB raw, ~1.5MB gzipped
- 可从核心数据完全重建
- 定义: [`sync-ledger.ts`](../packages/core/src/spec/sync-ledger.ts)

### 笔记文件 .md

物理文件 = Single Source of Truth。

- Note ID 格式: `YYYYMMDD-HHmmss-SSSR`，后 4 位 = **3 位毫秒 + 1 位随机数字**
- Frontmatter 字段规范: [`note.ts`](../packages/core/src/spec/note.ts) — `NoteFrontmatterSchema`

### assets/ 附件

- 路径规则: `assets/{hash[:2]}/{hash}.{ext}`，前 2 位 hex 分片
- 内容寻址去重: 相同内容 = 相同 hash = 相同路径
- 笔记 frontmatter 的 `attachments` 字段记录引用

## 约定

### Hash 算法

全局使用 **SHA-256**，用于 sync-ledger 变更检测和 assets 路径生成。

### 时区规范

所有时间戳使用 **UTC** (强制 `Z` 后缀)，不使用时区偏移，如 `2026-04-25T12:00:00Z`。

## Hold (暂不实现)

- `.timenote/cache/` — 缓存目录
- `.timenote/settings.json` — 设置
- `manifest.config` — 配置
- `manifest.extensions` — 插件系统
- sync-ledger 墓碑 30天过期自动清理
