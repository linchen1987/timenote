# vault.md 编写指南

> 本指南说明 `docs/specs/vault.md` 的记录范围、粒度和决策原则。修改 vault.md 前请先阅读。

## vault.md 记录什么

vault.md 是 vault 的持久化格式规范，记录两个层面：

1. **vault 结构**——目录与文件布局。这是 vault 的结构性约定，变更影响 sync 扫描、import/export 及所有遍历 vault 的代码，成本高。
2. **vault 数据格式**——Core/Derived 数据的内部结构约束。这是跨设备兼容的契约，变更涉及同步兼容性、用户数据完整性及迁移，成本极高。

## vault.md 不记录什么

**不记录本地数据的内部格式。**

Local 文件的内部格式（如 config.local.json 的字段定义、logs.local/ 的行格式）仅作用于本端：变更无需迁移、不影响同步、可安全删除重建。这与 Core 数据格式（如 note 文件名 `YYYYMMDD-HHmmss-SSSR.md`）有本质区别——后者变更会破坏跨设备同步和用户数据，成本极高。

**不记录实现细节。** 架构设计、依赖注入、队列机制、装饰器模式等属于代码注释，不属于格式规范。

## 核心原则：代码即文档

vault.md 开篇声明：

> 代码即文档。各文件格式的 Zod Schema 和 Example 定义在 `packages/core/src/spec/` 下，本文档仅描述设计决策和总览，不重复 Schema 细节。

具体格式（字段名、JSON 结构、正则表达式）已定义在代码中。vault.md 只描述设计决策（文件用途、数据分类、同步策略），不重复代码已有的定义。

## 记录粒度——按分类区分

### Core（数据资产）

notes、assets、manifest.json、menu.json、delete-log.json。

- 记录：用途、设计决策、格式约束（正则/结构概要）、代码指向
- 不记录：完整 Zod schema（已定义在代码中）
- 变更成本：极高——涉及跨设备兼容与用户资产

### Derived（派生数据）

sync-ledger.json。

- 记录：用途、从 Core 重建的方式、容量估算、代码指向
- 不记录：完整 entity 结构细节
- 变更成本：高——影响同步行为，但可从 Core 重建

### Local（本端专属数据）

config.local.json、logs.local/。

- **记录**：目录/文件的存在（结构层面）、分类、同步策略
- **不记录**：内部数据格式（字段名、行格式、存储策略）
- 变更成本：低——仅影响本端，无需迁移，删除不影响 vault 行为

## 判断标准：是否应在 vault.md 中记录

### 记录结构 + 格式

满足全部条件：
- 属于 vault 目录结构
- 影响 vault 行为（sync、import/export、遍历逻辑需感知其存在）
- 格式变更需要跨设备协调或数据迁移

### 仅记录结构

满足全部条件：
- 属于 vault 目录结构（sync 引擎需跳过、import/export 需感知）
- 内部数据仅作用于本端，格式变更无需迁移

典型：config.local.json、logs.local/

### 不记录

- 纯实现细节（架构、DI、队列、装饰器等）
- 不存在于 vault 目录中的内容
- 缓存/临时文件（视情况列入 Hold 部分）

## 示例对比

### 正确

```markdown
### config.local.json

per-vault 本地配置。不同步，各端独立，不需要多端兼容。
```

```markdown
### logs.local/

本地诊断日志目录。各端独立，不同步。
```

### 错误

```markdown
### logs.local/activity.log

诊断日志（纯文本），用于排查 sync 异常。默认关闭，由 `config.local.json` 的 `logging.enabled` 控制。

- 格式: `<ISO_TS> [<LEVEL>] [<category>] <message> [<compact-json>]`，每行一条
- category 开放（sync / remote / system / 将来任意子系统）
- 追加写，最多保留最近 500 行
- 实现: log-service.ts

**架构**：通用 Logger（依赖注入），任何子系统通过同一个 logger.log() 记录...
```

错误原因：混入了本地数据格式（行格式、category 列表）和实现机制（DI、factory 等）。这些变更仅影响本端，不属于 vault 格式规范。

## 编写规范

### 目录结构树

- Core 文件：标注分类 + 格式约束（如 `← core — Volume: ^[0-9]{4}-[0-9]{2}$`）
- Derived 文件：标注分类（如 `← derived`）
- Local 文件/目录：仅标注分类（如 `← local`），不标注内部格式

### 同步策略表

- Core：Yes
- Derived：不必须（缺失可重建）
- Local：不能

说明列仅写 vault 层面的理由（"用户内容"、"各端独立"），不写实现细节（"纯文本追加写"、"最多 500 行"）。

### Hold 部分

记录暂未实现但已规划的结构性条目（如 `.timenote/cache/`）。这些是 vault 结构的未来规划，提前声明以避免冲突。与 Local 的区别：Hold 是尚未创建但计划添加的结构，Local 是已存在但不属于 vault 数据的本地文件。
