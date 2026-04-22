# Web/Extension 代码去重重构实施文档

## 目标

消除 `apps/web/` 和 `apps/extension/` 之间约 2,600 行重复代码，同时：
- 统一 `useLocalStorage` 接口，支持平台特定实现
- 将共享路由组件提取到 `@timenote/ui`
- Extension 统一使用 `chrome.storage.local` 替代 `localStorage`

## Phase 1: 统一存储接口

### 1.1 定义 `UseStorage` 接口

**文件**: `packages/core/src/hooks/use-storage.ts`

```typescript
export type UseStorage = (
  key: string,
  initialValue: string,
) => readonly [string, (value: string) => void];
```

### 1.2 重命名现有实现

**文件**: `packages/core/src/hooks/use-local-storage.ts`

- 保持现有实现不变（基于 `localStorage`）
- 作为 web app 的默认实现
- 导出 `UseStorage` 类型

### 1.3 创建 `useChromeStorage` 实现

**文件**: `apps/extension/src/lib/use-chrome-storage.ts`

基于 `chrome.storage.local` 的异步实现：

```typescript
import { useState, useEffect } from 'react';

export function useChromeStorage(key: string, initialValue: string) {
  const [value, setValue] = useState(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(key).then((result) => {
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
      setIsHydrated(true);
    });
  }, [key]);

  const set = (newValue: string) => {
    setValue(newValue);
    chrome.storage.local.set({ [key]: newValue });
  };

  return [value, set] as const;
}
```

### 1.4 涉及文件

| 操作 | 文件 |
|---|---|
| 新建 | `packages/core/src/hooks/use-storage.ts` |
| 修改 | `packages/core/src/hooks/use-local-storage.ts` (导出类型) |
| 修改 | `packages/core/src/index.ts` (导出新类型) |
| 新建 | `apps/extension/src/lib/use-chrome-storage.ts` |

## Phase 2: 提取共享配置表单组件

`settings.tsx` 和 `notebook-settings.tsx` 中的 Storage Configuration Card（WebDAV/S3 表单）完全相同，提取为共享组件。

### 2.1 `StorageConfigCard` 组件

**文件**: `packages/ui/src/components/storage-config-card.tsx`

**Props**:
```typescript
interface StorageConfigCardProps {
  storageType: string;
  onStorageTypeChange: (type: string) => void;
  url: string;
  onUrlChange: (value: string) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  s3Bucket: string;
  onS3BucketChange: (value: string) => void;
  s3Endpoint: string;
  onS3EndpointChange: (value: string) => void;
  s3AccessKeyId: string;
  onS3AccessKeyIdChange: (value: string) => void;
  s3SecretAccessKey: string;
  onS3SecretAccessKeyChange: (value: string) => void;
  s3Region: string;
  onS3RegionChange: (value: string) => void;
  connectionStatus: 'idle' | 'testing' | 'success' | 'error';
  onTestConnection: () => void;
}
```

**要点**:
- 将受控值和回调全部通过 props 传入
- 组件内部只管理 `showPassword` 状态
- 包含 RadioGroup（WebDAV/S3 切换）、表单字段、Test Connection 按钮、状态指示器

### 2.2 涉及文件

| 操作 | 文件 |
|---|---|
| 新建 | `packages/ui/src/components/storage-config-card.tsx` |
| 修改 | `packages/ui/src/index.ts` (导出) |
| 重写 | `apps/web/app/routes/settings.tsx` |
| 重写 | `apps/extension/src/sidepanel/routes/settings.tsx` |
| 重写 | `apps/web/app/routes/notebook-settings.tsx` |
| 重写 | `apps/extension/src/sidepanel/routes/notebook-settings.tsx` |

## Phase 3: 提取共享路由组件

### 3.1 `TagsView` 组件

**文件**: `packages/ui/src/components/tags-view.tsx`

**差异**: 仅 `prefetch="intent"`（web 有，extension 无）

**Props**:
```typescript
interface TagsViewProps {
  notebookToken: string;
  prefetch?: 'intent' | 'none';
}
```

**差异处理**: 通过 `prefetch` prop 控制 `<Link>` 的 prefetch 行为。

### 3.2 `NoteDetailView` 组件

**文件**: `packages/ui/src/components/note-detail-view.tsx`

**差异**: 仅 `prefetch="intent"` 和 import 路径

**Props**:
```typescript
interface NoteDetailViewProps {
  useSyncStore: () => { isSyncing: boolean; syncPush: (nbId: string) => Promise<void> };
  prefetch?: 'intent' | 'none';
}
```

**关键设计**: `useSyncStore` 通过 props 注入，因为 web 和 extension 各自有自己的 sync store 实例。

### 3.3 `NotebookTimeline` 组件

**文件**: `packages/ui/src/components/notebook-timeline.tsx`

**差异**:
- `max-w-[320px]` (web) vs `max-w-[280px]` (extension) — 通过 prop 控制
- `prefetch="intent"` — 通过 prop 控制
- import 路径 (`~/lib/sync-store` vs `../../lib/sync-store`) — 通过 props 注入

**Props**:
```typescript
interface NotebookTimelineProps {
  useSyncStore: () => SyncStoreHook;
  searchMaxWidth?: string;
  prefetch?: 'intent' | 'none';
}
```

### 3.4 涉及文件

| 操作 | 文件 |
|---|---|
| 新建 | `packages/ui/src/components/tags-view.tsx` (注意与已有 `note-tags-view.tsx` 区分) |
| 新建 | `packages/ui/src/components/note-detail-view.tsx` |
| 新建 | `packages/ui/src/components/notebook-timeline.tsx` |
| 修改 | `packages/ui/src/index.ts` (导出) |
| 重写 | `apps/web/app/routes/tags.tsx` |
| 重写 | `apps/extension/src/sidepanel/routes/tags.tsx` |
| 重写 | `apps/web/app/routes/notebook-notedetail.tsx` |
| 重写 | `apps/extension/src/sidepanel/routes/note-detail.tsx` |
| 重写 | `apps/web/app/routes/notebook-notes.tsx` |
| 重写 | `apps/extension/src/sidepanel/routes/notebook-notes.tsx` |

## Phase 4: `NotebookLayout` 统一

**差异**:
- Web: PWA manifest 管理 + `usePWA()` hook
- Extension: `LAST_NOTEBOOK_TOKEN` 管理 + `isPWA={false}` 硬编码

**策略**: 提取核心布局为 `NotebookLayoutInner`，通过 props 注入差异部分。

**文件**: `packages/ui/src/components/notebook-layout.tsx`

**Props**:
```typescript
interface NotebookLayoutProps {
  isPWA: boolean;
  onSaveLastNotebook?: (token: string) => void;
  extraEffects?: (notebookToken: string) => void;
}
```

### 涉及文件

| 操作 | 文件 |
|---|---|
| 新建 | `packages/ui/src/components/notebook-layout.tsx` |
| 修改 | `packages/ui/src/index.ts` |
| 重写 | `apps/web/app/routes/notebook-layout.tsx` |
| 重写 | `apps/extension/src/sidepanel/layout/notebook-layout.tsx` |

## Phase 5: `NotebooksList` — 不提取

`notebooks.tsx` 的布局差异最大（web 有 hero/footer，extension 紧凑），业务逻辑虽然相同但 UI 完全不同。**不提取为共享组件**，保持各自独立实现。

Extension 的 `notebooks.tsx` 中 `useLocalStorage` 替换为 `useChromeStorage`，保留 `localStorage.removeItem(STORAGE_KEYS.LAST_NOTEBOOK_TOKEN)` 逻辑（这个用 localStorage 即可，因为它只在 sidepanel 内部使用）。

## Phase 6: 清理

### 6.1 Extension settings 统一使用 `useChromeStorage`

将 extension 的 `settings.tsx` 和 `notebook-settings.tsx` 中的 `useLocalStorage` 全部替换为 `useChromeStorage`。

同时删除之前添加的 `syncSettingsToChromeStorage` 和 `syncField` 相关代码。

### 6.2 Extension `fs-service.ts` 简化

当前 `setStorageType` 仍手动调用 `chrome.storage.local.set()`，改用 `useChromeStorage` 后自动同步，`setStorageType` 方法可简化或移除。

### 6.3 清理不再需要的代码

- 删除 extension 中的 `syncField` / `syncSettingsToChromeStorage`
- 删除之前 session 添加的 `ExtensionStorage` import（settings 中）

## 实施顺序

1. **Phase 1** — 存储接口（无 UI 变化，风险低）
2. **Phase 2** — StorageConfigCard（影响 settings × 4 文件）
3. **Phase 3** — TagsView → NoteDetailView → NotebookTimeline（从简单到复杂）
4. **Phase 4** — NotebookLayout（中等复杂度）
5. **Phase 5** — Extension notebooks.tsx 改用 useChromeStorage
6. **Phase 6** — 清理 + lint

每个 Phase 完成后运行 `pnpm lint` 验证。

## 架构图

```
packages/core/
  hooks/
    use-storage.ts        # UseStorage 类型定义
    use-local-storage.ts  # localStorage 实现 (web 使用)

packages/ui/
  components/
    storage-config-card.tsx   # WebDAV/S3 配置表单
    notebook-timeline.tsx     # 笔记时间线
    note-detail-view.tsx      # 笔记详情
    tags-view.tsx             # 标签列表
    notebook-layout.tsx       # 笔记本布局

apps/web/
  routes/
    settings.tsx           → 使用 StorageConfigCard + useLocalStorage
    notebook-settings.tsx  → 使用 StorageConfigCard + useLocalStorage
    tags.tsx               → 使用 TagsView
    notebook-notedetail.tsx → 使用 NoteDetailView
    notebook-notes.tsx      → 使用 NotebookTimeline
    notebook-layout.tsx     → 使用 NotebookLayout (isPWA=true)

apps/extension/
  lib/
    use-chrome-storage.ts  # chrome.storage.local 实现
  routes/
    settings.tsx           → 使用 StorageConfigCard + useChromeStorage
    notebook-settings.tsx  → 使用 StorageConfigCard + useChromeStorage
    tags.tsx               → 使用 TagsView
    note-detail.tsx        → 使用 NoteDetailView
    notebook-notes.tsx      → 使用 NotebookTimeline
    notebook-layout.tsx     → 使用 NotebookLayout (isPWA=false)
```

## Props 注入 vs Context 方案

**选择 Props 注入**，原因：
- 共享组件只在 2 个 app 中使用，props 注入更直观
- 避免 Context 导致的隐式依赖
- 组件的依赖关系在调用处一目了然
- 不需要额外的 Provider 包裹

**`useSyncStore` 注入方式**:

```typescript
// web app
<NotebookTimeline useSyncStore={useSyncStore} prefetch="intent" />

// extension
<NotebookTimeline useSyncStore={useSyncStore} searchMaxWidth="280px" />
```

每个 app 各自创建自己的 `useSyncStore` 实例（通过 `createSyncStore`），通过 props 传入共享组件。
