# Remotes & Provider 设计

remotes 解决两个关注点的分离：

| 关注点 | 实体 | 作用域 |
|--------|------|--------|
| 怎么连接（协议、凭证） | Provider | 全局（per-device） |
| 同步到哪里（provider + 路径） | Remote | per-vault |

Provider 类型动态发散（WebDAV, S3, OneDrive, Desktop API...），但数量很少（通常 <10）。每个 type 有独立的身份模型，spec 按 type 单独定义。

config.local.json 的 vault spec 位置见 [vault.md](vault.md)。本文档定义 config.local.json 的具体格式及相关的 provider 设计。

## config.local.json

参照 `.env` / `.env.local` 模式（Next.js, Vite 等均采用）：
- `config.json` = 可同步的用户偏好（跟着 vault 走），暂不实现
- `config.local.json` = 本地配置（各端独立，不同步），不需要多端兼容

```json
{
  "remotes": [
    {"url": "webdav://alice@dav.example.com/timenote/vaults/proj_abc", "default": true},
    {"url": "s3://mybucket@s3.amazonaws.com/backups/proj_abc", "name": "backup"}
  ]
}
```

### remotes

数组，存所有已配置的 remote 地址。

| 字段 | 必填 | 缺省 | 说明 |
|------|------|------|------|
| `url` | 是 | — | 地址，RFC 3986 格式（见下方 URL 格式节） |
| `default` | 否 | `false` | 默认远程，自动操作使用此 remote。最多一个 `true`（或都没有）。无 `default` = 不执行自动操作，但配置保留，手动可用 |
| `name` | 否 | — | 显示标签，CLI/GUI 可选使用 |

`url` 是序列化形式。结构化对象是逻辑形式（single source of truth），支持双向转换：

- `parse(url) → {type, ...identity, path}` — 每个 type 定义自己的解析规则
- `stringify({type, ...identity, path}) → url` — 每个 type 定义自己的序列化规则

## URL 格式

统一遵循 RFC 3986：`{type}://[identity@authority]/path`

- `@` 分离 identity 和 authority（从右往左解析，最后一个 `@` 为分隔符）
- `/` 分离 authority 和 path
- 无 identity 时省略 `@`

| Type | identity | authority | 示例 |
|------|----------|-----------|------|
| webdav | username | host | `webdav://alice@dav.example.com/path` |
| s3 | bucket | endpoint | `s3://mybucket@s3.amazonaws.com/path` |
| onedrive | user | host | `onedrive://user@example.com/path` |
| desktop | — | host:port | `desktop://localhost:8080/path` |
| fs | — | — | `fs:///home/user/notes` |

## Per-Type 字段定义

每个 provider type 定义三组字段：

| Type | 身份字段（进 URL/ID） | 连接细节（不进 URL） | 凭证（不进 URL） |
|------|---------------------|---------------------|----------------|
| webdav | host, username | tls, port | password, token |
| s3 | endpoint, bucket | region | accessKeyId, secretAccessKey |

判断标准：同一个资源换一个连接参数是否还是同一份数据？是 → 连接细节。否 → 身份字段。

- webdav `tls`：`http://` 和 `https://` 指向同一服务器同一数据 → 连接细节
- s3 `region`：AWS bucket 全局唯一；S3 兼容服务由 endpoint 区分 → 连接细节

## Provider Registry

per-device 全局配置（不在 vault 中）。字段是 single source of truth，ID 从 identity 字段推导，不存储。

```typescript
type ProviderConfig =
  | {
      type: 'webdav';
      host: string;
      username: string;
      password?: string;
      token?: string;
      tls?: boolean;     // default true
      port?: number;     // default 443 (tls) / 80
    }
  | {
      type: 's3';
      endpoint: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      region?: string;   // default "auto"
    };

// ID 推导（不存储）
// → "webdav://alice@dav.example.com"
// → "s3://mybucket@s3.amazonaws.com"
function generateProviderId(config: ProviderConfig): string;
```

对当前 `ProviderConfig` 的修正：
1. Proper discriminated union（消除 optional `webdav?` / `s3?` 的非法状态）
2. `url` 拆分为 `host` + `tls` + `port`
3. ID 格式从 `webdav:alice@https://host` → `webdav://alice@host`（RFC 3986）
4. `id` 不存储

## Lookup 流程

```
config.local.json → remotes[i]
  → url
  → parse(url) → {type, ...identity}
  → 在 provider registry 中按 type + identity 字段匹配
  → 找到 ProviderConfig → 获得 credentials + connection details
  → 构建 transport → 执行同步
```

## 各端使用

| 端 | 场景 | 行为 |
|----|------|------|
| GUI | 自动同步 | 找 `default: true` 的 remote，执行 sync |
| GUI | 手动选择 | UI 展示 remotes 列表，用户选择后设 `default: true` |
| GUI | 关闭远程 | 移除 `default`（不删除 remote 配置，方便重新启用） |
| CLI | `timenote sync` | 使用 `default` remote，无 default 时报错 |
| CLI | `timenote sync --remote 1` | 覆盖 default，使用指定索引（类似 `git push other_origin`） |
| 所有端 | 无 default | remotes 为空或无 `default: true`，不执行自动操作 |

## 迁移

### CLI: remotes.json → config.local.json

CLI 当前使用 `.timenote/remotes.json`（`Record<string, RemoteEntry>`），需迁移到 `.timenote/config.local.json`。

### Web/Extension: localStorage → config.local.json

Web/Extension 将 remote 配置存在 `localStorage @timenote/notebook_remotes`（按 projectId 索引），需迁移到 OPFS `.timenote/config.local.json`。

---

MARK:

```
StorageProviderIdentity          标识一块存储服务，不含凭据
    │
    ├ + 凭据  → StorageProviderConfig   完整配置，全局存储，可创建 Transport
    │
    └ + path  → StorageSource           实际存储地址（哪块存储 + 哪个路径）
                  │
                  └ ↔ URL string        序列化，只含 Identity 不含凭据，可存文件可分享
```