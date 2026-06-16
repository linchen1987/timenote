# TimeNote Desktop App 设计方案

## 一、概述 & 目标

使用 **Tauri v2** 构建 TimeNote 桌面应用，最大化复用现有 `@timenote/core`、`@timenote/ui` 代码，同时实现 Desktop 特有功能（本地文件系统直访问、打开已有 vault、系统托盘、全局快捷键等）。

### 设计原则

1. **前端零重写**：Desktop 前端 = 纯 SPA，复用 `@timenote/ui` 全部页面组件，结构与 Extension 几乎一致
2. **注入式 IO**：遵循 `FsClient` / `VaultRegistry` / `FsVolumeAccessStore` 三接口分离，Desktop 只需提供新实现
3. **渐进增强**：Phase 1 先跑起来（OPFS 存储），Phase 2 切换到原生文件系统 + Desktop 特有功能

### 与 Extension 的关键差异

| 维度 | Extension | Desktop |
|------|-----------|---------|
| 本地存储 | OPFS（沙箱） | **原生文件系统**（用户可见的真实目录） |
| Vault 发现 | OPFS 固定目录扫描 | **注册表文件**（vault 可在任意路径） |
| V4.2 打开已有 vault | 不支持 | **支持**（原生目录选择器） |
| 远程存储 (S3/WebDAV) | 直连（Side Panel 有网络权限） | 直连或 Rust 代理（Tauri HTTP 无 CORS 限制） |
| 凭证存储 | localStorage | localStorage（Phase 1）/ 文件（Phase 2） |
| 窗口管理 | Chrome Side Panel | **原生窗口**（托盘、快捷键、多窗口） |
| 路由 | HashRouter | HashRouter 或 BrowserRouter |
| 构建 | Vite + CRXJS | **Vite + Tauri** |

---

## 二、架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri 窗口 (WebView)                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │            React SPA (@timenote/ui)               │   │
│  │                                                    │   │
│  │  Routes → Pages → vault-store (Zustand)           │   │
│  │                         │                          │   │
│  │          ┌──────────────┼──────────────┐          │   │
│  │          │              │              │          │   │
│  │    TauriVaultRegistry  VaultOrchestrator  ProviderStore │
│  │          │              │              │          │   │
│  └──────────┼──────────────┼──────────────┼──────────┘   │
│             │              │              │               │
│  ┌──────────▼──────────────▼──────────────▼──────────┐   │
│  │              Transport Adapters                    │   │
│  │                                                    │   │
│  │  TauriFsDriver  │  S3Driver (direct)  │ WebDAVDriver│   │
│  │  (local fs)     │  (or Tauri HTTP)    │ (direct)   │   │
│  └──────────┬───────────────────────────────────────┘   │
│             │                                            │
│         invoke()                                         │
│             │                                            │
└─────────────┼────────────────────────────────────────────┘
              │
              ▼  Tauri IPC Bridge
┌─────────────────────────────────────────────────────────┐
│                   Rust Backend (src-tauri)                │
│                                                           │
│  fs commands    │  dialog   │  tray   │  shortcuts       │
│  (plugin-fs)    │  (plugin) │  (app)  │  (plugin)        │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │              OS (macOS / Windows / Linux)          │     │
│  │     真实文件系统 / 系统托盘 / 全局热键 / 通知        │     │
│  └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## 三、技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 框架 | **Tauri v2** | Rust 后端 + WebView，体积小、性能好、安全 |
| 前端 | React 19 + Vite | 复用现有 monorepo 体系 |
| 路由 | react-router (HashRouter) | 与 Extension 一致，无 server 依赖 |
| 状态 | Zustand (`createBoundVaultStore`) | 直接复用 `@timenote/ui` |
| 本地存储 | **Phase 1: OPFS → Phase 2: Tauri fs** | 渐进切换 |
| 索引 | IndexedDB (Dexie) | WebView 支持，直接复用 |
| 打包/分发 | Tauri bundler | `.dmg` / `.msi` / `.AppImage` |
| 自动更新 | `@tauri-apps/plugin-updater` | 原生支持 |

### Tauri 插件清单

| 插件 | 用途 |
|------|------|
| `@tauri-apps/plugin-fs` | 本地文件读写（Scoped） |
| `@tauri-apps/plugin-dialog` | 目录选择器（V4.2） |
| `@tauri-apps/plugin-shell` | 打开外部链接/文件管理器 |
| `@tauri-apps/plugin-notification` | 同步完成通知 |
| `@tauri-apps/plugin-global-shortcut` | 全局热键（快速创建笔记） |
| `@tauri-apps/plugin-os` | 平台检测 |
| `@tauri-apps/plugin-updater` | 自动更新 |
| `@tauri-apps/plugin-autostart` | 开机自启 |
| `tauri-plugin-log` | 日志 |

---

## 四、目录结构

```
apps/desktop/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html                    # SPA 入口
│
├── src/                           # 前端 (React SPA)
│   ├── main.tsx                   # React 挂载入口
│   ├── App.tsx                    # 路由定义 (与 Extension 一致)
│   │
│   ├── lib/
│   │   ├── vault-store.ts         # Store 绑定 (核心: ~30 行)
│   │   ├── tauri-fs-driver.ts     # FsClient via Tauri IPC
│   │   ├── tauri-vault-registry.ts # VaultRegistry (路径注册表)
│   │   └── desktop-api.ts         # Tauri 封装: 托盘/快捷键/通知
│   │
│   ├── routes/                    # 路由组件 (薄包装, 传 useStore)
│   │   ├── home-redirect.tsx
│   │   ├── notebooks.tsx
│   │   ├── notebook-notes.tsx
│   │   ├── note-detail.tsx
│   │   ├── tags.tsx
│   │   ├── notebook-settings.tsx
│   │   └── settings.tsx
│   │
│   ├── layout/
│   │   └── notebook-layout.tsx    # 复用 @timenote/ui 的 layout
│   │
│   └── styles/
│       └── app.css                # @source 指向 packages/ui
│
└── src-tauri/                     # Rust 后端
    ├── Cargo.toml
    ├── tauri.conf.json            # Tauri 配置 (窗口/CSP/权限)
    ├── build.rs
    ├── icons/                     # 应用图标
    ├── capabilities/
    │   └── default.json           # 权限声明 (fs scope 等)
    └── src/
        ├── main.rs                # Tauri 入口
        ├── lib.rs                 # 插件注册 + setup
        ├── commands.rs            # 自定义 Tauri commands
        └── vault_registry.rs      # Rust 侧 vault 注册表读写
```

---

## 五、Transport 层设计

### 5.1 TauriFsDriver — 本地文件系统适配

实现 `FsClientDriver` 接口，通过 Tauri 的 fs plugin 或自定义 command 操作真实文件系统。

```typescript
// src/lib/tauri-fs-driver.ts
import type { FsClientDriver } from '@timenote/core';
import type { FsClient, FsClientConfig, FsClientStat } from '@timenote/core';
import { readDir, readTextFile, writeTextFile, exists, mkdir, remove, readFile, writeFile } from '@tauri-apps/plugin-fs';

class TauriFsClient implements FsClient {
  readonly scheme = 'localfs' as const;
  readonly volumeUrl: string;
  readonly url: string;
  readonly rootPath: string;
  readonly credentials = undefined;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.volumeUrl = `localfs://${rootPath}`;
    this.url = `localfs://${rootPath}`;
  }

  private resolve(path: string): string {
    // 将 vault-root-relative 路径拼接为绝对路径
    return path ? `${this.rootPath}/${path}` : this.rootPath;
  }

  async list(path: string): Promise<FsClientStat[]> {
    const entries = await readDir(this.resolve(path));
    return entries.map((e) => ({
      filename: path ? `${path}/${e.name}` : e.name,
      basename: e.name,
      lastmod: new Date().toISOString(),
      size: 0,
      type: e.isDirectory ? ('directory' as const) : ('file' as const),
    }));
  }

  async read(path: string): Promise<string> {
    return readTextFile(this.resolve(path));
  }

  async write(path: string, content: string): Promise<void> {
    const full = this.resolve(path);
    const dir = full.substring(0, full.lastIndexOf('/'));
    if (dir && !(await exists(dir))) await mkdir(dir, { recursive: true });
    await writeTextFile(full, content);
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    const data = await readFile(this.resolve(path));
    return data.buffer;
  }

  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    const full = this.resolve(path);
    const dir = full.substring(0, full.lastIndexOf('/'));
    if (dir && !(await exists(dir))) await mkdir(dir, { recursive: true });
    await writeFile(full, new Uint8Array(data));
  }

  async remove(path: string): Promise<void> {
    await remove(this.resolve(path)).catch(() => {});
  }

  async exists(path: string): Promise<boolean> {
    return exists(this.resolve(path));
  }

  async ensureDir(path: string): Promise<void> {
    await mkdir(this.resolve(path), { recursive: true });
  }

  async testConnection(): Promise<boolean> {
    return exists(this.rootPath);
  }
}

export const TauriFsDriver: FsClientDriver = {
  create(config: FsClientConfig): FsClient {
    const rootPath = (config as any).rootPath || '/';
    return new TauriFsClient(rootPath);
  },
};
```

> **注意**：`@tauri-apps/plugin-fs` 的 `readDir` 不返回 `size`/`lastmod`。如需精确 stat 信息，可新增自定义 Tauri command（Rust 侧 `std::fs::metadata`）。Phase 1 先用默认值，与现有 Node adapter 行为一致。

### 5.2 远程存储 (S3 / WebDAV)

**Tauri WebView 的网络访问无 CORS 限制**（不同于浏览器）。两种方案：

| 方案 | 说明 | 适用场景 |
|------|------|----------|
| **A. 直连 (默认)** | 直接复用现有 `S3Driver` / `WebdavDriver` | Phase 1 首选 |
| B. Tauri HTTP 代理 | 用 `@tauri-apps/plugin-http` 替换 `fetch` | 目标服务器不支持 HTTPS 时 |

Phase 1 使用方案 A：Tauri 的 CSP 配置允许 `connect-src *`，WebView 中 `fetch` 直接到达远程服务器。

```typescript
// vault-store.ts 中直接注册现有 driver
registerDriver('s3', S3Driver);
registerDriver('webdav', WebdavDriver);
```

### 5.3 Driver 注册总览

```typescript
// Desktop 注册的 driver
registerDriver('localfs', TauriFsDriver);   // Phase 2: 原生 fs
registerDriver('s3', S3Driver);             // 远程同步
registerDriver('webdav', WebdavDriver);     // 远程同步
```

---

## 六、VaultRegistry 设计

### 6.1 DesktopVaultRegistry

Desktop 的核心差异：vault 可位于**任意文件系统路径**（不像 OPFS 固定在 `vaults/{projectId}/`）。

注册表存储在 app data 目录下的 JSON 文件中：
- macOS: `~/Library/Application Support/com.timenote.desktop/vaults.json`
- Windows: `%APPDATA%\com.timenote.desktop\vaults.json`
- Linux: `~/.config/com.timenote.desktop/vaults.json`

```typescript
// src/lib/tauri-vault-registry.ts
import type { VaultRegistry, VaultRegistryEntry } from '@timenote/core';
import { TauriFsClient } from './tauri-fs-driver';

interface RegistryData {
  vaults: Array<{
    projectId: string;
    name: string;
    path: string;  // 绝对路径
  }>;
}

export async function createDesktopVaultRegistry(): Promise<VaultRegistry> {
  const registryPath = await resolveRegistryPath();
  let data: RegistryData = await loadRegistry(registryPath);

  const save = () => writeRegistry(registryPath, data);

  return {
    async list(): Promise<VaultRegistryEntry[]> {
      return data.vaults.map((v) => ({
        projectId: v.projectId,
        sourceUrl: `localfs://${v.path}`,
        name: v.name,
      }));
    },

    async get(projectId: string) {
      const v = data.vaults.find((x) => x.projectId === projectId);
      return v ? { projectId: v.projectId, sourceUrl: `localfs://${v.path}`, name: v.name } : null;
    },

    async register(projectId: string, name: string) {
      // V4.1: 创建新 vault
      const path = await pickDefaultVaultPath(projectId);
      data.vaults.push({ projectId, name, path });
      await save();
      return { projectId, sourceUrl: `localfs://${path}`, name };
    },

    async registerExisting(projectId: string, path: string, name: string) {
      // V4.2: 打开已有 vault (Desktop 特有)
      const existing = data.vaults.find((x) => x.projectId === projectId);
      if (existing) throw new Error('Vault already registered');
      data.vaults.push({ projectId, name, path });
      await save();
      return { projectId, sourceUrl: `localfs://${path}`, name };
    },

    async unregister(projectId: string) {
      data.vaults = data.vaults.filter((x) => x.projectId !== projectId);
      await save();
    },

    async destroy(projectId: string) {
      const v = data.vaults.find((x) => x.projectId === projectId);
      if (v) await removeDir(v.path);  // 删除数据
      data.vaults = data.vaults.filter((x) => x.projectId !== projectId);
      await save();
    },

    async getProvider(projectId: string) {
      const v = data.vaults.find((x) => x.projectId === projectId);
      if (!v) throw new Error(`Vault not found: ${projectId}`);
      return new TauriFsClient(v.path);
    },
  };
}
```

> **`registerExisting` 是新方法**，不在现有 `VaultRegistry` 接口中。通过 `@tauri-apps/plugin-dialog` 的 `open({ directory: true })` 获取用户选择的目录路径，验证 `.timenote/manifest.json` 存在后注册。

### 6.2 注册表文件读写

通过 Tauri 自定义 command 在 Rust 侧管理，或直接用 `@tauri-apps/plugin-fs` 在 JS 侧读写。Phase 1 用 JS 直读写即可。

---

## 七、Store 绑定

与 Extension 几乎一致（核心代码 ~20 行）：

```typescript
// src/lib/vault-store.ts
import { registerDriver, VaultOrchestrator } from '@timenote/core';
import { S3Driver } from '@timenote/core/fs/adapters/s3/s3';
import { WebdavDriver } from '@timenote/core/fs/adapters/webdav/webdav';
import { createBoundVaultStore, createLocalStorageProviderStore } from '@timenote/ui';
import { TauriFsDriver } from './tauri-fs-driver';
import { createDesktopVaultRegistry } from './tauri-vault-registry';

// Phase 2: 原生文件系统
registerDriver('localfs', TauriFsDriver);
registerDriver('s3', S3Driver);
registerDriver('webdav', WebdavDriver);

const orchestrator = new VaultOrchestrator(
  createDesktopVaultRegistry,                   // Phase 2: 原生路径注册表
  createLocalStorageProviderStore(),
);

export const useVaultStore = createBoundVaultStore(orchestrator);
```

### Phase 1 (快速启动) 的差异

Phase 1 可以直接复用 OPFS + OPFS VaultRegistry（与 Extension 完全一致的绑定），确保功能可用后再切换到原生 fs：

```typescript
// Phase 1 — 与 Extension 完全相同
import { createOpfsVaultRegistry, LocalFsDriver as OpfsFsDriver } from '@timenote/core';

registerDriver('localfs', OpfsFsDriver);
const orchestrator = new VaultOrchestrator(
  createOpfsVaultRegistry,
  createLocalStorageProviderStore(),
);
export const useVaultStore = createBoundVaultStore(orchestrator);
```

---

## 八、前端应用结构

### 8.1 App.tsx — 路由定义

与 Extension 结构完全一致（HashRouter）：

```tsx
// src/App.tsx
import { ThemeProvider, Toaster } from '@timenote/ui';
import { HashRouter, Route, Routes } from 'react-router';
// ... route imports

export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/s/list" element={<NotebooksList />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/s/:notebookToken" element={<NotebookLayoutWrapper />}>
            <Route index element={<NotebookTimelinePage />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="settings" element={<NotebookSettings />} />
            <Route path=":noteId" element={<NoteDetail />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toaster />
    </ThemeProvider>
  );
}
```

### 8.2 Route 组件

每个 route 是薄包装，将 Desktop 的 `useVaultStore` 传给 `@timenote/ui` 的页面组件：

```tsx
// src/routes/notebook-notes.tsx
import { VaultTimelinePage } from '@timenote/ui';
import { useVaultStore } from '../lib/vault-store';

export default function NotebookTimelinePage() {
  return <VaultTimelinePage useStore={useVaultStore} />;
}
```

### 8.3 Vite 配置

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  clearScreen: false,
  server: {
    port: 1420,         // Tauri 约定端口
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  resolve: {
    alias: {
      '@timenote/core': resolve(__dirname, '../../packages/core/src'),
      '@timenote/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
});
```

### 8.4 app.css

```css
@import '@timenote/ui/styles';
@source '../../../packages/ui/src';
@source '../../../packages/core/src';
```

---

## 九、Desktop 特有功能

### 9.1 V4.2 打开已有 vault

```typescript
// src/lib/desktop-api.ts
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, exists } from '@tauri-apps/plugin-fs';

export async function pickAndRegisterVault(
  registry: DesktopVaultRegistry
): Promise<VaultRegistryEntry | null> {
  const selected = await open({ directory: true, multiple: false });
  if (!selected || typeof selected !== 'string') return null;

  // 验证是合法 vault
  const manifestPath = `${selected}/.timenote/manifest.json`;
  if (!(await exists(manifestPath))) {
    throw new Error('所选目录不是有效的 TimeNote vault（缺少 .timenote/manifest.json）');
  }

  const raw = await readTextFile(manifestPath);
  const manifest = JSON.parse(raw);
  const projectId = manifest.project_id;
  const name = manifest.name;

  return registry.registerExisting(projectId, selected, name);
}
```

UI 集成：在 `NotebooksPage` 中新增"打开本地 Vault"按钮。

### 9.2 系统托盘 (System Tray)

Tauri v2 内置 tray 支持：

```rust
// src-tauri/src/lib.rs
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
let new_note = MenuItem::with_id(app, "new_note", "新建笔记", true, None::<&str>)?;
let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&show, &new_note, &PredefinedMenuItem::separator(app)?, &quit])?;

let _tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id.as_ref() {
        "show" => { /* show window */ }
        "new_note" => { /* emit event to frontend */ }
        "quit" => { app.exit(0); }
        _ => {}
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
            // 单击托盘图标显示窗口
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    })
    .build(app)?;
```

### 9.3 全局快捷键

```rust
// src-tauri/src/lib.rs
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Code, Modifiers, Shortcut};

let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT);
app.global_shortcut().register(shortcut)?;
app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
    // 全局快捷键: Cmd/Ctrl+Shift+T → 显示窗口 + 新建笔记
    let _ = app.emit("global-new-note", ());
})?;
```

前端监听：

```typescript
import { listen } from '@tauri-apps/api/event';

listen('global-new-note', () => {
  // 导航到当前 notebook 的新建笔记页面
});
```

### 9.4 开机自启

```rust
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

app.autolaunch().enable()?;
```

在 Settings 页面提供开关。

### 9.5 自动同步 (后台)

与 Extension 的 30 分钟 alarm 类似，但用 Rust 侧 timer 或 Tauri 的 `setInterval` equivalent：

```typescript
// src/lib/auto-sync.ts
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 分钟

setInterval(async () => {
  const store = useVaultStore.getState();
  const { activeProjectId } = store;
  if (activeProjectId) {
    await store.sync(activeProjectId).catch(() => {});
  }
}, SYNC_INTERVAL_MS);
```

### 9.6 窗口状态持久化

使用 `tauri-plugin-window-state` 自动记住窗口大小和位置。

### 9.7 在文件管理器中显示 Vault

```typescript
import { open } from '@tauri-apps/plugin-shell';

// 在 Notebook Settings 中添加"在文件管理器中显示"
open(vaultPath);
```

### 9.8 文件变更监听 (Watch)

Tauri 的 `fs` watch 或 Rust `notify` crate 监听 vault 目录变化，实现外部编辑后自动刷新：

```rust
// 当 vault 目录被外部修改时，通知前端重建索引
app.emit("vault-changed", projectId)?;
```

```typescript
listen('vault-changed', () => {
  useVaultStore.getState().rebuildIndex(projectId);
});
```

### 9.9 自动更新

```rust
// src-tauri/src/lib.rs
let _ = app.handle().plugin(
    tauri_plugin_updater::Builder::new().build(),
)?;
```

```typescript
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const update = await check();
if (update) {
  await update.downloadAndInstall();
  await relaunch();
}
```

---

## 十、Tauri 配置

### tauri.conf.json (关键配置)

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "TimeNote",
  "version": "1.0.0",
  "identifier": "com.timenote.desktop",
  "build": {
    "frontendDist": "../dist",        // Vite build output
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev:desktop",
    "beforeBuildCommand": "pnpm build:desktop"
  },
  "app": {
    "windows": [
      {
        "title": "TimeNote",
        "width": 1024,
        "height": 720,
        "minWidth": 680,
        "minHeight": 500,
        "hidden": false  // 可设为 true 配合托盘启动
      }
    ],
    "security": {
      "csp": {
        // 允许远程存储连接 (S3/WebDAV)
        "connect-src": "'self' https: http://*",
        "img-src": "'self' data: blob: asset: https:",
        "default-src": "'self'"
      }
    },
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    }
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/your/timenote/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### capabilities/default.json (权限)

```jsonc
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-read-dir",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "**" }  // 或更严格的 scope
      ]
    },
    "dialog:allow-open",
    "shell:allow-open",
    "notification:default",
    "global-shortcut:allow-register",
    "updater:default",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled"
  ]
}
```

---

## 十一、功能矩阵映射

对照 `features.md`，Desktop 各功能点的实现方案：

### 数据模型 (M)
| 功能点 | Desktop 实现 | 说明 |
|--------|-------------|------|
| M1 | 统一实现 | 无差异 |

### 笔记本管理 (V)
| 功能点 | Desktop 实现 | 说明 |
|--------|-------------|------|
| V1-V3 | 统一实现 | TauriFsDriver 提供本地 IO |
| V4 注册 | `DesktopVaultRegistry.register()` | 写入注册表 JSON |
| **V4.1 创建并注册** | 同上 | 在默认 vaults 目录下创建 |
| **V4.2 打开已有 vault** | `DesktopVaultRegistry.registerExisting()` + `dialog.open()` | **Desktop 特有** |
| V5 移除注册 | `DesktopVaultRegistry.unregister()` | 仅移除注册，不删数据 |
| V6 列出 | `DesktopVaultRegistry.list()` | 读注册表 JSON |
| V7 激活 | 统一实现 | IndexedDB 索引 (WebView 支持) |

### 数据操作 (D)
| 功能点 | Desktop 实现 | 说明 |
|--------|-------------|------|
| D1-D5 笔记操作 | 统一实现 | |
| D6-D11 菜单操作 | 统一实现 | |
| D12-D15 附件操作 | 统一实现 | 附件直接在文件系统中 |
| **D16 索引构建** | **IndexedDB (Dexie)** | WebView 支持 IndexedDB，直接复用 |
| **D17 全文搜索** | **内存倒排索引** | 同 Web/Extension |
| D18-D20 | 统一实现 | |

### 同步 (S)
| 功能点 | Desktop 实现 | 说明 |
|--------|-------------|------|
| S1-S4 | 统一实现 | |
| S5-S7 | 统一实现 | |
| S8-S9 Clone | 统一实现 | |
| S10-S11 导入/导出 | 统一实现 | ZIP 适配器在 WebView 中可用 |
| S14 扫描远程 | 统一实现 | |

### 存储提供者 (T)
| 功能点 | Desktop 实现 | 说明 |
|--------|-------------|------|
| **T1 OPFS** | 不使用 | Desktop 使用原生 fs |
| **T1.2 Node.js fs** | `TauriFsDriver` (Tauri fs plugin) | 通过 IPC 调用 Rust fs |
| T1.3 WebDAV | 直连 `WebdavDriver` | WebView 无 CORS 限制 |
| T1.4 S3 | 直连 `S3Driver` | 同上 |
| T1.5 ZIP | 统一实现 | jszip 在 WebView 中可用 |

### 凭证管理 (C)
| 功能点 | Desktop 实现 | 说明 |
|--------|-------------|------|
| C1-C5 | `createLocalStorageProviderStore()` | Phase 1 用 localStorage |
| C6-C9 | 统一接口 (config.local.json) | |

---

## 十二、实现计划

### Phase 1: 最小可用 (MVP) — 预计 2-3 天

**目标**：Tauri 壳 + OPFS 存储 = 能用的桌面笔记应用

| 步骤 | 内容 | 复用率 |
|------|------|--------|
| 1 | 创建 `apps/desktop` 目录结构 | - |
| 2 | Tauri 项目初始化 (`cargo tauri init`) | - |
| 3 | Vite 配置 (alias 指向 core/ui) | 参考 Extension |
| 4 | `vault-store.ts` — OPFS + OPFS Registry | **100% 复用 Extension 绑定** |
| 5 | `App.tsx` + routes — SPA 结构 | **100% 复用 Extension 路由** |
| 6 | `app.css` — Tailwind 配置 | 参考 tailwind-monorepo.md |
| 7 | Tauri 基础配置 (窗口/CSP) | - |
| 8 | pnpm workspace 注册 | - |
| 9 | 启动验证 | - |

**Phase 1 产出**：一个在桌面窗口中运行的 TimeNote，功能与 Extension 版本完全一致。

### Phase 2: 原生文件系统 — 预计 3-5 天

**目标**：真实文件系统访问 + V4.2 打开已有 vault

| 步骤 | 内容 | 复用率 |
|------|------|--------|
| 1 | `TauriFsDriver` 实现 | FsClient 接口适配 |
| 2 | `DesktopVaultRegistry` 实现 | VaultRegistry 接口适配 |
| 3 | 切换 `vault-store.ts` 到 Tauri 绑定 | 改 ~10 行 |
| 4 | V4.2 UI：目录选择器 + "打开 Vault" 按钮 | 新增 UI |
| 5 | Tauri fs 权限配置 (capabilities) | - |
| 6 | 测试：创建 vault、打开已有 vault、同步 | - |

### Phase 3: Desktop 特性 — 预计 3-5 天

| 步骤 | 内容 |
|------|------|
| 1 | 系统托盘 (显示/新建笔记/退出) |
| 2 | 全局快捷键 (Cmd/Ctrl+Shift+T) |
| 3 | 开机自启 (Settings 开关) |
| 4 | 自动同步 (后台 30 分钟 interval) |
| 5 | 在文件管理器中显示 Vault |
| 6 | 窗口状态持久化 |
| 7 | 自动更新 |
| 8 | 文件变更监听 (外部编辑刷新) |
| 9 | macOS dock badge (未同步数) |

### Phase 4: 打包发布 — 预计 2-3 天

| 步骤 | 内容 |
|------|------|
| 1 | 应用图标设计 |
| 2 | macOS: `.dmg` (需 Apple Developer 证书签名 + 公证) |
| 3 | Windows: `.msi` / `.exe` (需代码签名) |
| 4 | Linux: `.AppImage` / `.deb` |
| 5 | 自动更新 JSON 发布流程 |
| 6 | GitHub Release CI |

---

## 十三、待解决问题

| # | 问题 | 当前倾向 | 备注 |
|---|------|----------|------|
| 1 | **D16/D17 索引策略** | 复用 IndexedDB (Dexie) | WebView 原生支持；Phase 2 验证大数据量性能 |
| 2 | **凭证存储安全性** | Phase 1: localStorage | Phase 3 可选: Tauri keyring (OS keychain) |
| 3 | **fs scope 安全** | Phase 1: `**` (全盘) | Phase 3: 限制到用户选择的目录 |
| 4 | **多窗口** | 暂不实现 | 一个 vault 一个窗口的设计待需求验证 |
| 5 | **文件锁/并发** | 暂不处理 | 多端同时编辑同一 vault 文件的冲突由 sync 引擎处理 |
| 6 | **TauriFsDriver stat 信息** | 用默认值 (size=0, lastmod=now) | 与 Node adapter 行为一致；如需精确信息加 Rust command |
| 7 | **WebView2 (Windows) 依赖** | Tauri 自动安装 | 首次启动可能需要联网安装 WebView2 |

---

## 十四、pnpm workspace 集成

### package.json (apps/desktop)

```json
{
  "name": "@timenote/desktop",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:desktop": "vite",
    "build": "tsc && vite build",
    "build:desktop": "vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@timenote/core": "workspace:*",
    "@timenote/ui": "workspace:*",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-fs": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "@tauri-apps/plugin-notification": "^2",
    "@tauri-apps/plugin-global-shortcut": "^2",
    "@tauri-apps/plugin-updater": "^2",
    "@tauri-apps/plugin-autostart": "^2",
    "@tauri-apps/plugin-os": "^2",
    "react": "^19",
    "react-dom": "^19",
    "react-router": "^7",
    "zustand": "^5"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@tailwindcss/vite": "^4",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5",
    "vite": "^6",
    "vite-tsconfig-paths": "^5"
  }
}
```

### Root package.json 新增 scripts

```json
{
  "scripts": {
    "dev:desktop": "pnpm --filter @timenote/desktop tauri:dev",
    "build:desktop": "pnpm --filter @timenote/desktop tauri:build"
  }
}
```

### pnpm-workspace.yaml

无需修改（已有 `apps/*` 通配）。

---

## 十五、代码复用率分析

| 模块 | 复用来源 | 复用方式 | 复用率 |
|------|----------|----------|--------|
| UI 页面组件 | `@timenote/ui` | import 直接使用 | **100%** |
| 编辑器 (TipTap) | `@timenote/ui/components/editor` | import | **100%** |
| 树形菜单 | `@timenote/ui/components/tree-menu` | import | **100%** |
| Shadcn 组件 | `@timenote/ui/components/ui` | import | **100%** |
| Vault 引擎 | `@timenote/core/vault/*` | import | **100%** |
| 同步引擎 | `@timenote/core/vault/sync-*` | import | **100%** |
| Spec (Zod schemas) | `@timenote/core/spec/*` | import | **100%** |
| 笔记/菜单服务 | `@timenote/core/notes/*` | import | **100%** |
| Store (Zustand) | `@timenote/ui createBoundVaultStore` | import | **100%** |
| 路由结构 | Extension `App.tsx` | 参考 + 微调 | **95%** |
| vault-store.ts | Extension `vault-store.ts` | 参考 + 替换 driver | **80%** |
| TauriFsDriver | 新写 | FsClient 接口适配 | **0%** |
| DesktopVaultRegistry | 新写 | VaultRegistry 接口适配 | **0%** |
| Desktop 特性 API | 新写 | Tauri commands | **0%** |

**整体代码复用率估算: ~90%+**

Desktop 真正需要新写的代码量极少（约 500-800 行 TypeScript + 200-300 行 Rust），其余全部复用 monorepo 现有代码。
