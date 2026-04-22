# TimeNote Web + 浏览器插件 设计文档

```
(PRE)IDEA:
我想同时支持 web 版和浏览器插件版本。
- 项目结构如何改造
- 哪些可以复用，如何复用
- 为了复用如何改造
- 浏览器插件架构设计(high level)
```

## 1. 现状分析

### 1.1 当前技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | React Router 7 (SSR) | Cloudflare Workers 上运行 SSR |
| 构建 | Vite 7 + @cloudflare/vite-plugin | 部署到 Cloudflare Pages/Workers |
| 存储 | Dexie (IndexedDB) | 纯客户端，IndexedDB 封装 |
| 编辑器 | TipTap | Markdown 编辑 |
| 样式 | Tailwind CSS v4 + shadcn/ui | |
| 状态管理 | Zustand | sidebar、sync 状态 |
| 云同步 | WebDAV / S3 | 通过 Cloudflare Worker API 代理（绕 CORS） |
| PWA | vite-plugin-pwa | Service Worker 离线支持 |

### 1.2 当前架构分层

```
app/
├── root.tsx              ← SSR 入口（Layout, ThemeProvider, SW 注册）
├── entry.server.tsx      ← 服务端渲染逻辑
├── routes.ts             ← 路由定义
├── routes/               ← 页面组件（13 个路由）
│   ├── api.fs.ts         ← ★ 服务端 API：代理 WebDAV/S3 请求
│   ├── landing.tsx       ← Web 首页（纯展示）
│   ├── manifest.tsx      ← 动态 PWA manifest
│   ├── notebooks.tsx     ← 笔记本列表（含大量 Web 专属 UI）
│   ├── notebook-*.tsx    ← 笔记本核心功能
│   ├── settings.tsx      ← 设置页
│   ├── tags.tsx          ← 标签管理
│   └── playground/       ← 开发调试
├── components/           ← UI 组件
│   ├── editor/           ← TipTap 编辑器
│   ├── notebook-sidebar  ← 侧边栏
│   ├── tree-menu/        ← 树形菜单
│   ├── ui/               ← shadcn 基础组件
│   └── theme-provider    ← 主题
├── lib/                  ← 核心业务逻辑
│   ├── db.ts             ← Dexie 数据库定义
│   ├── types.ts          ← 类型定义
│   ├── constants.ts      ← 常量（localStorage keys）
│   ├── utils.ts          ← 工具函数
│   ├── services/         ← 业务 Service 层
│   │   ├── note-service.ts     ← 笔记 CRUD
│   │   ├── menu-service.ts     ← 菜单 CRUD
│   │   ├── data-service.ts     ← 数据备份/恢复
│   │   ├── import-service.ts   ← 导入
│   │   ├── export-service.ts   ← 导出
│   │   ├── fs-service.ts       ← ★ 文件系统服务（调用 /api/fs）
│   │   └── sync/               ← 同步引擎
│   │       ├── service.ts      ← 同步 Service
│   │       ├── tracker.ts      ← 变更追踪
│   │       ├── types.ts        ← 同步类型
│   │       └── utils.ts        ← 同步工具
│   ├── stores/           ← Zustand 状态
│   │   ├── sidebar-store.ts
│   │   └── sync-store.ts
│   └── utils/            ← 工具模块
├── hooks/                ← React Hooks
│   ├── use-pwa.ts              ← ★ Web 专属
│   ├── use-service-worker-update.ts ← ★ Web 专属
│   └── use-local-storage.ts
├── services/
│   └── fs-client.ts      ← ★ WebDAV/S3 客户端（服务端运行）
workers/
└── app.ts                ← Cloudflare Worker 入口
```

### 1.3 关键架构特征

1. **SSR + CSR 混合**: Cloudflare Workers 做 SSR，但核心数据全在 IndexedDB（客户端）
2. **API 代理模式**: `/api/fs` 路由在服务端执行 WebDAV/S3 调用，避免浏览器 CORS 限制
3. **客户端优先**: 所有数据操作（CRUD）都通过 Dexie 直接操作 IndexedDB，不经过服务器
4. **同步是推拉模型**: 手动触发 sync，通过 FsService → API → WebDAV/S3

---

## 2. 代码复用分析

### 2.1 复用评估矩阵

| 模块 | 文件 | 复用度 | 原因 |
|------|------|--------|------|
| **数据库定义** | `lib/db.ts` | **100%** | 纯 IndexedDB，无平台依赖 |
| **类型定义** | `lib/types.ts` | **100%** | 纯 TypeScript 类型 |
| **常量** | `lib/constants.ts` | **100%** | localStorage key 定义 |
| **工具函数** | `lib/utils.ts`, `lib/utils/*` | **100%** | 纯函数 |
| **Note Service** | `lib/services/note-service.ts` | **100%** | 纯 Dexie 操作 |
| **Menu Service** | `lib/services/menu-service.ts` | **100%** | 纯 Dexie 操作 |
| **Data Service** | `lib/services/data-service.ts` | **100%** | 纯 Dexie 操作 |
| **Import Service** | `lib/services/import-service.ts` | **100%** | 委托 DataService |
| **Export Service** | `lib/services/export-service.ts` | **90%** | 包含 DOM 操作（下载文件），需适配 |
| **Sync Tracker** | `lib/services/sync/tracker.ts` | **100%** | Dexie hooks |
| **Sync Types** | `lib/services/sync/types.ts` | **100%** | 纯类型 |
| **Sync Utils** | `lib/services/sync/utils.ts` | **100%** | 纯函数 |
| **Sync Service** | `lib/services/sync/service.ts` | **90%** | 依赖 FsService，需适配 |
| **FsService** | `lib/services/fs-service.ts` | **50%** | 调用 `/api/fs` 代理，插件需改为直接调用 |
| **FsClient** | `services/fs-client.ts` | **80%** | S3/WebDAV 客户端，插件中在 Background 运行 |
| **API 路由** | `routes/api.fs.ts` | **0%** | 服务端专用，插件不需要 |
| **Zustand Stores** | `lib/stores/*` | **100%** | 纯状态管理 |
| **编辑器组件** | `components/editor/*` | **100%** | 纯 React |
| **侧边栏** | `components/notebook-sidebar*` | **90%** | 可能需要布局适配 |
| **树形菜单** | `components/tree-menu/*` | **100%** | 纯 React |
| **UI 基础组件** | `components/ui/*` | **100%** | shadcn 组件 |
| **主题** | `components/theme-provider` | **100%** | 纯 React |
| **PWA Hook** | `hooks/use-pwa.ts` | **0%** | Web 专用 |
| **SW Hook** | `hooks/use-service-worker-update.ts` | **0%** | Web 专用 |
| **LS Hook** | `hooks/use-local-storage.ts` | **100%** | 通用 |
| **笔记本列表页** | `routes/notebooks.tsx` | **30%** | 大量 Web 专属 UI（背景动画、Footer、导航） |
| **笔记本布局** | `routes/notebook-layout.tsx` | **70%** | 核心布局可复用，PWA 检测需适配 |
| **笔记详情** | `routes/notebook-notedetail.tsx` | **90%** | 核心功能，少量 Web 依赖 |
| **标签管理** | `routes/tags.tsx` | **90%** | 核心功能 |
| **设置页** | `routes/settings.tsx` | **70%** | 部分设置项是 Web 专属 |
| **Worker 入口** | `workers/app.ts` | **0%** | Cloudflare 专用 |
| **Entry Server** | `entry.server.tsx` | **0%** | SSR 专用 |
| **Landing** | `routes/landing.tsx` | **0%** | 纯 Web 营销页 |
| **Manifest** | `routes/manifest.tsx` | **0%** | PWA 专用 |

### 2.2 复用度总结

```
┌─────────────────────────────────────────────────┐
│ 100% 复用（核心层）                    ~60% 代码量 │
│   db, types, constants, utils, note-service,    │
│   menu-service, data-service, import-service,   │
│   sync/tracker, sync/types, sync/utils,         │
│   stores, hooks/local-storage, ui components,   │
│   editor, tree-menu, theme-provider             │
├─────────────────────────────────────────────────┤
│ 需适配复用（适配层）                    ~15% 代码量 │
│   fs-service（API代理 → 直连）                   │
│   sync-service（依赖 fs-service）                │
│   fs-client（browser fetch → extension fetch）   │
│   export-service（DOM 下载 → chrome.downloads）  │
├─────────────────────────────────────────────────┤
│ 不可复用（平台层）                      ~25% 代码量 │
│   api.fs.ts, workers/app.ts, entry.server.tsx,  │
│   landing.tsx, manifest.tsx, use-pwa.ts,        │
│   use-service-worker-update.ts, notebooks.tsx   │
│   （大部分UI可提取子组件复用）                     │
└─────────────────────────────────────────────────┘
```

---

## 3. 浏览器插件架构设计

### 3.1 UI 入口设计

插件只使用 **Side Panel** 作为唯一 UI 入口。点击扩展图标直接打开 Side Panel，不使用 Popup 和 Content Script。

| 入口 | 用途 | 说明 |
|------|------|------|
| **Side Panel** | 唯一 UI——笔记浏览、编辑、管理、设置 | 点击扩展图标直接打开 |

**为什么只用 Side Panel**:
- 持久存在，不会因为切换标签页而关闭
- 宽度固定（约 400px），适合笔记类应用的窄面板布局
- 是独立扩展页面，有完整 Chrome API 访问权限
- 用户体验接近 Web 版的 sidebar 布局
- 无需维护 Popup 的独立 UI 和状态，降低复杂度

### 3.2 整体架构

```
┌──────────────────────────────────────────────────┐
│                Browser Extension                  │
│                                                   │
│  ┌────────────────────────────────────────────┐   │
│  │           Side Panel (React SPA)            │   │
│  │                                            │   │
│  │  - 笔记本列表                              │   │
│  │  - 笔记浏览 / 编辑                         │   │
│  │  - 标签管理                                │   │
│  │  - 设置（同步配置）                         │   │
│  └──────────────────┬─────────────────────────┘   │
│                     │                             │
│                     │  chrome.runtime.sendMessage  │
│                     │                             │
│  ┌──────────────────▼─────────────────────────┐   │
│  │          Background Service Worker          │   │
│  │                                            │   │
│  │  - WebDAV/S3 直连（无 CORS 限制）           │   │
│  │  - 自动同步（chrome.alarms）                │   │
│  │  - 消息路由                                │   │
│  └──────────────┬─────────────────────────────┘   │
│                 │                                  │
│                 │  共享 origin                     │
│                 ▼                                  │
│  ┌────────────────────────────────────────────┐   │
│  │            IndexedDB (Dexie)               │   │
│  └────────────────────────────────────────────┘   │
│                                                   │
│  manifest.json (Manifest V3)                      │
└──────────────────────────────────────────────────┘
```

### 3.3 Background Service Worker 职责

在插件中，Background SW 替代了 Web 版的 Cloudflare Worker：

| Web 版 (Cloudflare Worker) | 插件版 (Background SW) |
|---|---|
| `/api/fs` 代理 WebDAV/S3 请求 | Background 直接调用 WebDAV/S3（无 CORS 限制） |
| 无自动同步 | `chrome.alarms` 定时自动同步 |
| 无跨 tab 通信 | `chrome.runtime.sendMessage` 跨 context 通信 |

**关键变化**: 插件中的 `FsService` 不再调用 `/api/fs`，而是通过 `chrome.runtime.sendMessage` 将请求发送到 Background SW，由 SW 直接调用 `FsClient`。

### 3.4 同步流程对比

**Web 版**:
```
用户操作 → FsService → fetch('/api/fs') → Cloudflare Worker → FsClient → WebDAV/S3
```

**插件版**:
```
用户操作 → FsService → chrome.runtime.sendMessage → Background SW → FsClient → WebDAV/S3
```

---

## 4. 项目结构改造方案

### 4.1 推荐方案：pnpm Workspace Monorepo

`packages/` 存放共享库，`apps/` 存放各平台应用：

```
timenote/
├── pnpm-workspace.yaml
├── package.json                    ← 根 package.json（workspace 脚本）
├── tsconfig.base.json              ← 共享 TS 配置
├── biome.json                      ← 共享 lint 配置
│
├── packages/
│   ├── core/                       ← ★ 共享核心包（最大复用）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── db.ts                     ← 数据库定义
│   │   │   ├── types.ts                  ← 类型定义
│   │   │   ├── constants.ts              ← 常量
│   │   │   ├── utils/                    ← 工具函数
│   │   │   │   ├── cn.ts
│   │   │   │   └── token.ts
│   │   │   ├── services/                 ← 业务 Service 层
│   │   │   │   ├── note-service.ts
│   │   │   │   ├── menu-service.ts
│   │   │   │   ├── data-service.ts
│   │   │   │   ├── import-service.ts
│   │   │   │   └── sync/
│   │   │   │       ├── tracker.ts
│   │   │   │       ├── types.ts
│   │   │   │       └── utils.ts
│   │   │   ├── stores/                   ← Zustand stores
│   │   │   │   ├── sidebar-store.ts
│   │   │   │   └── sync-store.ts
│   │   │   ├── hooks/                    ← 通用 hooks
│   │   │   │   └── use-local-storage.ts
│   │   │   └── fs/                       ← ★ 文件系统抽象层（关键改造）
│   │   │       ├── types.ts                    ← FsClient 接口定义
│   │   │       ├── fs-service.ts               ← 高层 FsService（平台无关）
│   │   │       ├── platform-web.ts             ← Web 实现：fetch('/api/fs')
│   │   │       └── platform-ext.ts             ← 插件实现：chrome.runtime.sendMessage
│   │   └── index.ts                      ← 统一导出
│   │
│   └── ui/                         ← ★ 共享 UI 组件包
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/                   ← shadcn 基础组件
│       │   │   ├── editor/               ← TipTap 编辑器
│       │   │   ├── notebook-sidebar.tsx
│       │   │   ├── note-tags-view.tsx
│       │   │   ├── page-header.tsx
│       │   │   ├── sync-actions.tsx
│       │   │   ├── tree-menu/
│       │   │   └── theme-provider.tsx
│       │   └── styles/
│       │       └── app.css               ← Tailwind 样式
│       └── index.ts
│
├── apps/
│   ├── web/                        ← Web 版（当前项目迁移）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts               ← Cloudflare + React Router SSR
│   │   ├── react-router.config.ts
│   │   ├── wrangler.jsonc
│   │   ├── app/
│   │   │   ├── root.tsx                 ← Web 专属 root
│   │   │   ├── entry.server.tsx
│   │   │   ├── routes.ts
│   │   │   ├── routes/
│   │   │   │   ├── landing.tsx          ← Web 专属
│   │   │   │   ├── api.fs.ts            ← Web 专属（CF Worker API）
│   │   │   │   ├── manifest.tsx         ← Web 专属（PWA）
│   │   │   │   ├── notebooks.tsx        ← Web 专属 UI
│   │   │   │   ├── notebook-layout.tsx  ← 复用核心，适配 Web 布局
│   │   │   │   ├── notebook-notes.tsx
│   │   │   │   ├── notebook-notedetail.tsx
│   │   │   │   ├── notebook-settings.tsx
│   │   │   │   ├── tags.tsx
│   │   │   │   ├── settings.tsx
│   │   │   │   └── playground/
│   │   │   ├── hooks/
│   │   │   │   ├── use-pwa.ts
│   │   │   │   └── use-service-worker-update.ts
│   │   │   └── services/
│   │   │       └── fs-client.ts         ← 服务端 FsClient（WebDAV/S3）
│   │   └── workers/
│   │       └── app.ts
│   │
│   └── extension/                  ← 浏览器插件
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts               ← CRXJS Vite Plugin
│       ├── manifest.json                ← Manifest V3
│       ├── src/
│       │   ├── sidepanel/               ← Side Panel 主界面（唯一 UI）
│       │   │   ├── index.html
│       │   │   ├── main.tsx             ← React 入口
│       │   │   ├── App.tsx              ← 路由配置
│       │   │   ├── routes/
│       │   │   │   ├── notebooks.tsx    ← 简化的笔记本列表
│       │   │   │   ├── notebook.tsx     ← 笔记本视图（sidebar + content）
│       │   │   │   ├── note-detail.tsx  ← 笔记编辑
│       │   │   │   ├── tags.tsx
│       │   │   │   └── settings.tsx
│       │   │   └── layout/
│       │   │       └── sidepanel-layout.tsx
│       │   │
│       │   ├── background/              ← Background Service Worker
│       │   │   ├── index.ts             ← SW 入口
│       │   │   ├── fs-handler.ts        ← 处理 FsService 消息
│       │   │   ├── sync-scheduler.ts    ← 自动同步调度
│       │   │   └── message-router.ts    ← 消息路由
│       │   │
│       │   └── lib/
│       │       ├── fs-client.ts         ← 插件端 FsClient（直接调用）
│       │       ├── sync-service.ts      ← 插件端 SyncService
│       │       └── message-types.ts     ← 消息类型定义
│       │
│       └── public/
│           └── icons/
│               ├── icon-16.png
│               ├── icon-32.png
│               ├── icon-48.png
│               └── icon-128.png
│
└── docs/
```

### 4.2 pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### 4.3 包依赖关系

```
┌─────────────────────┐
│     @timenote/core  │ ← 无外部 UI 依赖
│  db, services,      │
│  stores, utils      │
└────────┬────────────┘
         │
┌────────▼────────────┐
│     @timenote/ui    │ ← 依赖 core
│  components, styles │
└──┬──────────────┬───┘
   │              │
   ▼              ▼
┌──────┐   ┌────────────┐
│ web  │   │ extension  │ ← 依赖 core + ui
└──────┘   └────────────┘
```

### 4.4 关键改造：文件系统抽象层

**当前问题**: `FsService` 硬编码调用 `fetch('/api/fs')`，只适用于 Web 版。

**解决方案**: 在 `@timenote/core` 中定义 `FsTransport` 接口，各平台提供实现。

```typescript
// packages/core/src/fs/types.ts
export interface FsTransport {
  list(path: string): Promise<FsStat[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
}
```

```typescript
// packages/core/src/fs/fs-service.ts
// 平台无关的高层服务，注入 transport
export function createFsService(transport: FsTransport) {
  const existingDirs = new Set<string>();
  return {
    async list(path: string) { ... },
    async read(path: string) { ... },
    // ...
  };
}
```

```typescript
// packages/core/src/fs/platform-web.ts
// Web 版：通过 /api/fs 代理
export const webTransport: FsTransport = {
  async list(path) {
    return callApi('list', path);
  },
  // ...
};
```

```typescript
// packages/core/src/fs/platform-ext.ts
// 插件版：通过 chrome.runtime.sendMessage 到 Background SW
export const extensionTransport: FsTransport = {
  async list(path) {
    return chrome.runtime.sendMessage({
      type: 'fs:list',
      path,
    });
  },
  // ...
};
```

```typescript
// apps/extension/src/background/fs-handler.ts
// Background SW 中直接使用 FsClient（无 CORS 限制）
import { createFsClient } from './fs-client';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type?.startsWith('fs:')) {
    handleFsMessage(message).then(sendResponse);
    return true; // 保持消息通道
  }
});

async function handleFsMessage(message: FsMessage) {
  const client = createFsClient(getConnection());
  switch (message.type) {
    case 'fs:list':
      return client.readdir(message.path);
    case 'fs:read':
      return client.readFile(message.path);
    // ...
  }
}
```

### 4.5 关键改造：SyncService 适配

```typescript
// packages/core/src/services/sync/service.ts
// 接受 FsService 实例作为依赖注入
export function createSyncService(fsService: FsService) {
  return {
    async syncNotebook(notebookId: string) {
      await fsService.ensureDir(SYNC_ROOT_PATH);
      await this.pull(notebookId);
      await this.push(notebookId);
    },
    // ...
  };
}
```

### 4.6 关键改造：ExportService 适配

```typescript
// packages/core/src/services/export-service.ts
// 下载行为通过回调注入
export async function exportData(
  onDownload: (blob: Blob, filename: string) => void
) {
  const data = await DataService.fetchBackupData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  onDownload(blob, `timenote-export-${new Date().toISOString().split('T')[0]}.json`);
  return data;
}

// Web 版调用
exportData((blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

// 插件版调用
exportData(async (blob, filename) => {
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename, saveAs: true });
});
```

---

## 5. Extension manifest.json 设计

```json
{
  "manifest_version": 3,
  "name": "TimeNote",
  "version": "1.0.0",
  "description": "轻量级笔记应用，支持 WebDAV/S3 云同步",

  "permissions": [
    "storage",
    "sidePanel",
    "alarms",
    "downloads"
  ],

  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },

  "action": {
    "default_icon": {
      "16": "public/icons/icon-16.png",
      "32": "public/icons/icon-32.png",
      "48": "public/icons/icon-48.png",
      "128": "public/icons/icon-128.png"
    }
  },

  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },

  "icons": {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  },

  "commands": {
    "_execute_action": {
      "suggested_key": { "default": "Alt+T" },
      "description": "打开 TimeNote"
    }
  }
}
```

点击扩展图标时，通过 Background SW 调用 `chrome.sidePanel.open()` 直接打开 Side Panel，无需 Popup：

```typescript
// apps/extension/src/background/index.ts
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
```

---

## 6. 构建配置

### 6.1 Extension vite.config.ts（使用 CRXJS）

```typescript
// apps/extension/vite.config.ts
import react from '@vitejs/plugin-react';
import crx from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
      },
    },
  },
});
```

### 6.2 Web 版 vite.config.ts（保持不变）

维持现有 Cloudflare + React Router 配置。

---

## 7. 消息通信协议

### 7.1 消息类型定义

```typescript
// apps/extension/src/lib/message-types.ts

export type FsMessage =
  | { type: 'fs:list'; path: string }
  | { type: 'fs:read'; path: string }
  | { type: 'fs:write'; path: string; content: string }
  | { type: 'fs:exists'; path: string }
  | { type: 'fs:ensureDir'; path: string }
  | { type: 'fs:stat'; path: string }
  | { type: 'sync:push'; notebookId: string }
  | { type: 'sync:pull'; notebookId: string }
  | { type: 'sync:getRemoteNotebooks' };

export type MessageResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### 7.2 通信流程

```
  Side Panel                         Background SW
      │                                    │
      │── chrome.runtime.sendMessage ─────▶│
      │   { type: 'fs:read', path: '...' } │
      │                                    │── FsClient.read(path)
      │                                    │── WebDAV / S3
      │◀── sendResponse(result) ──────────│
      │                                    │
```

---

## 8. 数据存储策略

### 8.1 IndexedDB（已有，完全复用）

Side Panel 和 Background SW 共享同一个 IndexedDB 数据库（同一 extension origin），无需额外同步。

### 8.2 配置存储

| 数据 | Web 版 | 插件版 |
|------|--------|--------|
| 主题设置 | localStorage | `chrome.storage.local` |
| 同步配置（WebDAV/S3） | localStorage | `chrome.storage.local` |
| Sidebar 状态 | localStorage | 组件内 state |

**适配方案**: 在 `@timenote/core` 中抽象存储接口。

```typescript
// packages/core/src/storage/types.ts
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
```

Web 版实现用 `localStorage`，插件版实现用 `chrome.storage.local`。

---

## 9. Side Panel UI 适配要点

### 9.1 布局差异

| 特征 | Web 版 | Side Panel |
|------|--------|------------|
| 宽度 | 全屏 + 可调 sidebar | 固定 ~400px |
| 笔记本列表 | 独立页面 | 紧凑列表或下拉选择 |
| 导航 | URL 路由 | 状态切换或简单路由 |
| 外部链接 | 大量（GitHub、Footer） | 无 |

### 9.2 Side Panel 路由设计

```typescript
// 简化的路由结构，适配窄面板
const routes = [
  { path: '/',           component: NotebooksList },  // 紧凑列表
  { path: '/:nbId',      component: NotebookView },   // sidebar + content 合一
  { path: '/:nbId/:noteId', component: NoteEditor },
  { path: '/settings',   component: Settings },
];
```

建议使用 `react-router` SPA 模式（HashRouter），因为 Side Panel 是独立 HTML 页面。

### 9.3 NotebookView 适配

Web 版使用 sidebar + main 的双栏布局。Side Panel 窄空间下建议：
- 顶部 Tab 切换（目录 / 笔记列表 / 标签）
- 或可折叠的抽屉式导航
- 复用 `NotebookSidebar` 组件的数据和逻辑，替换布局外壳

---

## 10. 自动同步机制

```typescript
// apps/extension/src/background/sync-scheduler.ts
import { SyncService } from './sync-service';

chrome.runtime.onInstalled.addListener(() => {
  // 每 30 分钟自动同步
  chrome.alarms.create('auto-sync', { periodInMinutes: 30 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auto-sync') {
    const notebooks = await NoteService.getAllNotebooks();
    for (const nb of notebooks) {
      try {
        await SyncService.syncNotebook(nb.id);
      } catch (e) {
        console.error(`Auto-sync failed for ${nb.id}:`, e);
      }
    }
  }
});
```

---

## 11. 实施路径

### Phase 1：项目结构改造

1. 初始化 pnpm workspace（`packages/*` + `apps/*`）
2. 创建 `packages/core`，迁移 `lib/` 下的共享代码
3. 创建 `packages/ui`，迁移 `components/`
4. 将现有 Web 项目迁移到 `apps/web`
5. 重构 `FsService` 为平台抽象层
6. Web 版验证：确保功能不变

### Phase 2：Extension 骨架

1. 创建 `apps/extension`
2. 配置 CRXJS + Vite
3. 实现 Background SW（action.onClicked → sidePanel.open）
4. 实现消息路由 + FsHandler
5. 实现 `extensionTransport`（FsService 插件实现）
6. 实现 Side Panel 基本框架（React SPA）
7. 验证：点击图标打开 Side Panel，能读取 IndexedDB 数据

### Phase 3：Side Panel 核心 UI

1. 笔记本列表（紧凑版）
2. 笔记浏览 + 编辑（复用 editor 组件）
3. 标签管理
4. 设置页（同步配置）
5. 导入/导出
6. 验证：完整的 CRUD 流程

### Phase 4：同步 & 增强

1. Background SW 中的同步逻辑
2. 自动同步（chrome.alarms）
3. 快捷键支持（Alt+T 打开面板）

---

## 12. 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| CRXJS 与 Vite 7+ 兼容性 | 构建失败 | CRXJS v2.4 支持 Vite 8，已验证 |
| IndexedDB 跨 context 一致性 | 数据不一致 | Extension 内所有 context 共享同一 origin，Dexie 事务保证一致性 |
| Side Panel 窄屏适配 | UI 体验差 | 设计时以 400px 为基准，组件响应式 |
| Background SW 生命周期限制 | 同步中断 | MV3 SW 有 5 分钟限制，长同步需分片处理 |
| Web 版改造回归 | Web 功能异常 | Phase 1 完成后完整回归测试 |
| 两个版本的样式一致性 | 维护成本 | 共享 `@timenote/ui` 包，Tailwind 配置统一 |
