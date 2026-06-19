# Timenote Vault 规范

> 代码即文档。各文件格式的 Zod Schema 和 Example 定义在 [`packages/core/src/spec/`](packages/core/src/spec/) 下，
> 本文档仅描述设计决策和总览，不重复 Schema 细节。
> 总入口: [`vault-spec.ts`](packages/core/src/spec/vault-spec.ts)

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
  │   ├── manifest.json                 ← core
  │   ├── menu.json                     ← core
  │   ├── delete-log.json               ← core
  │   ├── sync-ledger.json              ← derived
  │   ├── config.local.json             ← local
  │   └── logs.local/                   ← local
  ├── {YYYY-MM}/                        ← core — Volume: ^[0-9]{4}-[0-9]{2}$
  │   └── {YYYYMMDD-HHmmss-SSSR}.md    ← Note: ^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$
  └── assets/                           ← core — Attachments: SHA-256 hash-based storage
      └── {hash[:2]}/                   ← Shard by first 2 hex chars
          └── {hash}.{ext}              ← Dedup: same hash = same file
```

> 路径常量和分类工具: [`vault-layout.ts`](packages/core/src/spec/vault-layout.ts)

## 数据分类

| 类别 | 定义 | 特征 | 示例 |
|------|------|------|------|
| **Core** | 数据资产，vault 的 truth | 用户创造，不可重建，丢了就没了 | 笔记 .md、assets、manifest.json、menu.json、delete-log.json |
| **Derived** | 从 core 可重建的派生数据 | 缓存性质，缺失时可从 core 完全重建 | sync-ledger.json |
| **Local** | 本端专属数据 | 各端独立，不可同步，不可重建 | config.local.json、logs.local/ |

### 同步策略

| 文件 | 同步 | 说明 |
|------|------|------|
| `{volume}/{noteId}.md` | Yes | 用户内容 |
| `assets/{shard}/{hash}.{ext}` | Yes | 用户附件 |
| `manifest.json` | Yes | vault 身份 |
| `menu.json` | Yes | 目录结构 |
| `delete-log.json` | Yes | 删除记录 |
| `sync-ledger.json` | 不必须 | 同步后写双端做缓存优化；缺失时从物理文件重建 |
| `config.local.json` | 不能 | 本端配置，各端独立 |
| `logs.local/` | 不能 | 本地诊断数据，各端独立 |

## 各文件规范

### manifest.json

项目唯一身份标识。定义: [`manifest.ts`](packages/core/src/spec/manifest.ts)

### menu.json

- 嵌套结构持久化，运行时转换为扁平结构 (id/parentId/order)
- 支持 10000 节点、1000 层级、拖拽
- 定义: [`menu.ts`](packages/core/src/spec/menu.ts)

### delete-log.json

记录笔记删除时间戳，sync 生成墓碑条目 (tombstone) 的来源。定义: [`delete-log.ts`](packages/core/src/spec/delete-log.ts)

### sync-ledger.json

- entity key = 文件相对路径 (如 `"2026-04/20260425-112010-0457.md"`)
- 两个分区: `entities` (笔记和附件) + `meta_files` (manifest.json、menu.json 等)
- 估算容量: 100k note × 150B = 15MB raw, ~1.5MB gzipped
- 可从核心数据完全重建
- 定义: [`sync-ledger.ts`](packages/core/src/spec/sync-ledger.ts)

### config.local.json

per-vault 本地配置。不同步，各端独立，不需要多端兼容。

### logs.local/

本地诊断日志目录。各端独立，不同步。

### 笔记文件 .md

物理文件 = Single Source of Truth。

- Note ID 格式: `YYYYMMDD-HHmmss-SSSR`，后 4 位 = **3 位毫秒 + 1 位随机数字**
- Frontmatter 字段规范: [`note.ts`](packages/core/src/spec/note.ts) — `NoteFrontmatterSchema`

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
- `.timenote/config.json` — 可同步的用户偏好
- `manifest.extensions` — 插件系统
- sync-ledger 墓碑 30天过期自动清理
