# Provider 设计改造 — High Level Design

## 背景

当前 remote storage (WebDAV/S3) 是全局单一配置，所有 notebook 共享同一个 provider。
目标：每个 notebook 可以独立配置自己的 remote endpoint，provider 可复用。

## 核心概念

### Endpoint

每个 notebook 有两个 endpoint：

| Endpoint | 格式 | 说明 |
|----------|------|------|
| Local | `opfs://vaults/{projectId}` | 固定，用户不可配置 |
| Remote | `{provider}{path}` | 可选，可配置多个（当前功能上只支持一个） |

完整 remote URL 示例：
- WebDAV: `https://nas.example.com/dav` + `timenote/vaults/vBm1ic75uaq`
- S3: `https://s3.amazonaws.com/my-bucket` + `timenote/vaults/vBm1ic75uaq`

### Provider vs Remote

- **Provider**：一个存储后端（WebDAV/S3）的连接配置（地址 + 凭据），注册到全局 registry
- **Remote**：一个 notebook 的一组同步目标配置，由 `providerId + path` 组成
- 关系：多个 notebook 的 remote 可以复用同一个 provider

## 数据模型

### Provider ID 生成规则

Provider ID 由配置中的标识性字段自动生成，配置后不可修改这些字段。

| Type | 标识字段 (不可变) | ID 格式 | 示例 |
|------|-------------------|---------|------|
| WebDAV | url + username | `webdav:{username}@{url}` | `webdav:admin@https://nas.example.com/dav` |
| S3 | endpoint + bucket | `s3:{bucket}@{endpoint}` | `s3:my-bucket@s3.amazonaws.com` |

生成规则：
```typescript
function generateProviderId(config: ProviderConfig): string {
  if (config.type === 'webdav') {
    const url = config.webdav!.url.replace(/\/+$/, '');
    return `webdav:${config.webdav!.username}@${url}`;
  }
  const { bucket, endpoint } = config.s3!;
  return `s3:${bucket}@${endpoint ?? ''}`;
}
```

- 相同标识字段 → 相同 ID → 视为同一 provider（自动 dedup）
- 凭据类字段（password / secretAccessKey）可修改，不影响 ID

### Provider Registry

存储位置：`localStorage[@timenote/providers]`（JSON 数组）

```typescript
interface ProviderConfig {
  id: string;           // 由 generateProviderId() 自动生成，不可修改
  type: 'webdav' | 's3';
  // 二选一，根据 type
  webdav?: {
    url: string;        // 不可变（参与 ID 生成）
    username: string;   // 不可变（参与 ID 生成）
    password: string;   // 可修改
  };
  s3?: {
    endpoint?: string;  // 不可变（参与 ID 生成）
    bucket: string;     // 不可变（参与 ID 生成）
    region?: string;
    accessKeyId: string;
    secretAccessKey: string; // 可修改
  };
}
```

操作：
- `listProviders(): ProviderConfig[]`
- `getProvider(id: string): ProviderConfig | null`
- `saveProvider(config: ProviderConfig): ProviderConfig` — upsert，相同 ID 覆盖更新
- `deleteProvider(id: string): void`

### Notebook Remote Config

存储位置：`localStorage[@timenote/notebook_remotes]`（JSON 对象）

```typescript
interface RemoteEntry {
  providerId: string;   // → ProviderConfig.id
  path: string;         // 相对 provider 根目录的路径, default: "timenote/vaults/{projectId}"
  enabled: boolean;     // 是否启用同步
}

interface NotebookRemoteConfig {
  [projectId: string]: {
    [remoteName: string]: RemoteEntry;  // 'origin' | 'upstream' | 'backup' | ...
  };
}
```

当前 UI 只暴露一个 remote（`origin`），数据结构预留多 remote 扩展。

示例：

```json
{
  "vBm1ic75uaq": {
    "origin": {
      "providerId": "webdav:admin@https://nas.example.com/dav",
      "path": "timenote/vaults/vBm1ic75uaq",
      "enabled": true
    }
  },
  "vXm2kd83tpl": {
    "origin": {
      "providerId": "webdav:admin@https://nas.example.com/dav",
      "path": "timenote/vaults/vXm2kd83tpl",
      "enabled": true
    },
    "backup": {
      "providerId": "s3:my-bucket@s3.amazonaws.com",
      "path": "backup/timenote/vXm2kd83tpl",
      "enabled": false
    }
  }
}
```

操作：
- `getRemote(projectId: string, remoteName?: string): RemoteEntry | null` — remoteName default `origin`
- `setRemote(projectId: string, remoteName: string, entry: RemoteEntry): void`
- `removeRemote(projectId: string, remoteName: string): void`
- `listRemotes(projectId?: string): NotebookRemoteConfig | { [remoteName: string]: RemoteEntry }`

### localStorage Keys

在 `constants.ts` 中新增：

```
@timenote/providers          → ProviderConfig[]
@timenote/notebook_remotes   → NotebookRemoteConfig
```

以下旧 key 在迁移后废弃（不删除，但不再读取）：

```
@timenote/storage_type
@timenote/webdav_url
@timenote/webdav_username
@timenote/webdav_password
@timenote/s3_bucket
@timenote/s3_endpoint
@timenote/s3_access_key_id
@timenote/s3_secret_access_key
@timenote/s3_region
```

## 架构变更

### Transport Layer

**现状**：`webTransport` 是单例，每次调用 `callApi()` 时从全局 localStorage 读取 `FsConnection`。

**改造后**：transport 工厂模式。

```typescript
// 从 ProviderConfig 构建 FsConnection（用于发送到 /api/fs）
function connectionFromProvider(provider: ProviderConfig): FsConnection;

// 为指定 provider 创建 RemoteTransport
function createTransportForProvider(provider: ProviderConfig): RemoteTransport;
```

`createTransportForProvider` 的实现本质上是将 `webTransport` 的逻辑泛化——
不再从全局 localStorage 读取 `FsConnection`，而是从传入的 `ProviderConfig` 构建。

`/api/fs` 服务端路由无需任何改动——它已经每次请求接收 `FsConnection`。

### VaultStore

**现状**：`createVaultStore(transport)` 接收一个全局 `RemoteTransport`。

**改造后**：

```typescript
interface TransportResolver {
  // 为 notebook 解析当前启用的 remote transport
  resolve(projectId: string): Promise<ResolvedTransport | null>;
  // 列出指定 provider 下的 remote vaults
  listRemoteVaults(providerId: string): Promise<VaultMeta[]>;
  // 为指定 provider + path 创建 transport
  createTransport(providerId: string, path: string): Promise<RemoteTransport>;
}

interface ResolvedTransport {
  transport: RemoteTransport;
  remoteName: string;
  providerId: string;
  path: string;
}
```

`resolve(projectId)` 流程：
1. `NotebookRemotes.getRemote(projectId, 'origin')` → `RemoteEntry | null`
2. 如果 `null` 或 `!entry.enabled` → 返回 `null`
3. `ProviderRegistry.getProvider(entry.providerId)` → `ProviderConfig`
4. `createTransportForProvider(provider)` → `RemoteTransport`
5. `createPrefixedTransport(entry.path, transport)` → 项目级 transport
6. 返回 `ResolvedTransport`

Store actions 变更：

```typescript
// 新增
configureRemote(projectId: string, providerId: string, path?: string): void;
removeRemoteConfig(projectId: string, remoteName?: string): void;
toggleRemote(projectId: string, remoteName?: string): void;
getRemoteConfig(projectId: string): RemoteEntry | null;
listRemoteVaults(providerId: string): Promise<VaultMeta[]>;
cloneFromProvider(providerId: string, path: string): Promise<void>;

// 修改 — 内部通过 resolver 动态解析
sync(projectId: string): Promise<SyncResult>;    // resolver.resolve → null 则 no-op
pull(projectId: string): Promise<SyncResult>;
push(projectId: string): Promise<SyncResult>;
tryEntrySync(projectId: string): Promise<void>;
scheduleAutoSync(projectId: string): void;
```

`sync/pull/push` 行为变更：
- 如果 notebook 没有 remote config 或 remote 未 enabled → 静默返回，不报错
- 如果有 remote config 且 enabled → 正常同步

### Sync Direction (多 remote 扩展)

当前只使用 `origin`。未来扩展时：

```
sync(projectId)           → 同步 origin
sync(projectId, 'upstream') → 同步 upstream
syncAll(projectId)        → 同步所有 enabled 的 remotes
```

`scheduleAutoSync` 未来可以遍历所有 enabled remotes 依次同步。当前只处理 `origin`。

## 迁移

### 一次性迁移（在 `init()` 中执行）

```
1. 检查旧 key @timenote/storage_type 是否存在
2. 如果存在 → 读取所有旧 key，构建 ProviderConfig，saveProvider()
3. 获取当前所有 local vaults（projectId 列表）
4. 为每个 vault 创建 origin remote：
   NotebooksRemotes.setRemote(projectId, 'origin', {
     providerId: <migrated provider id>,
     path: `timenote/vaults/${projectId}`,
     enabled: true,
   })
5. 旧 key 保留不删除（兼容回退），但代码不再读取
```

迁移后 `webTransport` 单例不再被使用。
`apps/web/app/lib/vault-store.ts` 从 `createVaultStore(webTransport)` 改为
`createVaultStore(resolver)`。

## UI 变更

### Settings 页面 (/settings)

**Provider Registry 管理**：
- 列出所有已注册 providers
- 添加新 provider（选择 WebDAV/S3，填写连接信息，测试连接，自动注册）
- 编辑 / 删除已有 provider
- 删除前检查是否有 notebook 正在使用

### Notebook Settings 页面 (/s/:token/settings)

**Remote 配置**：
- 显示当前 remote 配置状态（provider + path + enabled）
- 选择 provider：下拉选择已注册的 provider，或"添加新 provider"
- Path：默认自动生成 `timenote/vaults/{projectId}`，可手动修改
- 启用/禁用开关
- 断开 remote（删除配置）

### Notebooks 页面 (/notebooks)

**Provider 列表 + 手动扫描**：
- 列出所有已注册 providers
- 每个 provider 旁有"扫描"按钮，点击后扫描该 provider 的 `timenote/vaults/`
- 扫描结果：列出 remote vaults，过滤掉已存在本地的（projectId 匹配）
- "拉取" 按钮 → `cloneFromProvider(providerId, path)`

**手动拉取**：
- 选择 provider + 输入自定义 path → `cloneFromProvider(providerId, customPath)`

## 文件变更清单

| 区域 | 文件 | 变更类型 | 说明 |
|------|------|----------|------|
| core | `vault/provider-registry.ts` | 新增 | Provider CRUD + dedup |
| core | `vault/notebook-remotes.ts` | 新增 | Notebook remote config CRUD |
| core | `constants.ts` | 修改 | 新增 localStorage keys |
| core | `service/vault-store.ts` | 重构 | TransportResolver 模式，动态解析 |
| web | `lib/web-transport.ts` | 重构 | transport 工厂，移除全局单例 |
| web | `lib/vault-store.ts` | 修改 | 使用 resolver 初始化 |
| web | `routes/settings.tsx` | 修改 | Provider Registry UI |
| web | `routes/notebook-settings.tsx` | 修改 | Per-notebook remote 配置 UI |
| ui | `storage-config-card.tsx` | 修改 | 支持选择已有 provider vs 新增 |
| ui | `use-notebooks-page.ts` | 修改 | Provider 列表 + 手动扫描 |

## 实施顺序

1. **Phase 1: 数据层** — `provider-registry.ts`, `notebook-remotes.ts`, `constants.ts`
2. **Phase 2: Transport 层** — 重构 `web-transport.ts`，引入 `createTransportForProvider`
3. **Phase 3: Store 层** — 重构 `vault-store.ts`，`TransportResolver`，迁移逻辑
4. **Phase 4: UI** — Settings / Notebook Settings / Notebooks 页面改造
