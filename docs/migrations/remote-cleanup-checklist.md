# Remote 绑定迁移 — 代码清理清单

本文档列出迁移完成并稳定一个版本周期后，需要删除的代码和清理的数据。

## 前提条件

- 所有活跃用户已完成迁移（`@timenote/notebook_remotes_migrated_v2` 值为 `'3'`）
- `notebook-remotes.ts` 的所有消费者已迁移到 `RemoteConfigService`

## 一、删除的代码

### 1. 整个文件删除

| 文件 | 说明 |
|------|------|
| `packages/core/src/vault/notebook-remotes.ts` | 旧 localStorage 远程配置模块 |
| `packages/ui/src/lib/remote-config-migration.ts` | 一次性迁移 + 延迟清理脚本 |

### 2. `packages/core/src/index.ts` — 删除 deprecated 导出块

```typescript
// 删除以下整块
/**
 * @deprecated Use RemoteConfigService via config.local.json instead.
 * These functions read/write localStorage directly and will be removed.
 */
export {
  getAllRemotes,
  getDefaultRemotePath,
  getEnabledRemotes,
  getRemote,
  listAllRemotes,
  type NotebookRemoteConfig,
  type RemoteEntry,
  removeRemote,
  setRemote,
  updateProviderIdReferences,
} from './vault/notebook-remotes';
```

### 3. `packages/core/src/constants.ts` — 删除迁移相关 key

删除：
- `NOTEBOOK_REMOTES: '@timenote/notebook_remotes'`（旧数据源，迁移脚本延迟清理后不再需要）

保留（加注释）：
- `NOTEBOOK_REMOTES_MIGRATED_V2`：加注释说明 `// Tombstone: localStorage 值 '3' 表示迁移完成，数据保留不删除`

```typescript
/** @internal 迁移终态墓碑。值 '3' = 迁移完成+旧数据已清理。数据保留不删除。 */
NOTEBOOK_REMOTES_MIGRATED_V2: '@timenote/notebook_remotes_migrated_v2',
```

### 4. `packages/ui/src/stores/vault-store.ts` — 删除迁移调用

```typescript
// 删除 import
import { migrateRemotesFromLocalStorage } from '../lib/remote-config-migration';

// init() 中删除迁移调用
try {
  await migrateRemotesFromLocalStorage(...);
} catch (e) { ... }
```

### 5. 消费者代码改造

| 文件 | 当前 | 改为 |
|------|------|------|
| `packages/ui/src/components/pages/use-sync-button.tsx` | `getEnabledRemotes(projectId)` 直接调 localStorage | `await store.getState().getRemoteConfig(projectId)` 判断是否有 remote |
| `packages/ui/src/components/remote-config-card.tsx` | props 类型 `RemoteEntry`（`{ providerId, path, enabled }`） | 新结构（从 URL 解析 providerId + path + default） |
| `packages/ui/src/components/pages/notebook-settings-page.tsx` | 导入 `getDefaultRemotePath` | 内联常量 `timenote/vaults/${projectId}` 或提取到 utils |

## 二、localStorage 孤儿数据

| Key | 值 | 说明 |
|-----|------|------|
| `@timenote/notebook_remotes_migrated_v2` | `'3'` | 终态墓碑，无害，不删除 |
| `@timenote/notebook_remotes` | 已删除（迁移脚本延迟清理） | 用户跳过版本可能有残留 |

## 三、未来迁移规范

如果未来需要新的 localStorage 迁移：
1. 使用新版本号 key（如 `@timenote/notebook_remotes_migrated_v3`）
2. 旧版本号 key 作为终态墓碑保留，不影响新状态机
3. 参照本文档的清理流程，在稳定后删除迁移脚本和常量定义（数据保留）
