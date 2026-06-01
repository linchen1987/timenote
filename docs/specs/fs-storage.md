# FsProvider 规范

> 代码即文档。类型定义在 [`providers/`](../../packages/core/src/fs/providers/) 下，
> 本文档仅描述设计决策和总览，不重复类型细节。
> 联合类型总入口: [`module.ts`](../../packages/core/src/fs/providers/module.ts)

## 类型体系

FsProvider 是 timenote 对存储后端的抽象（S3, WebDAV, 本地文件系统等）。

连接一个远程 vault 需要回答两个问题：**连到哪里**（Identity + Path：哪个 provider 的哪个路径），以及**怎么连**（Credentials：用什么凭证）。这是两个独立的关注点——一个凭证可以访问同一 provider 下的不同路径，一个 vault 也可以配置多个远程目标。

每个 provider 由三个正交维度描述：

| 维度 | 含义 | 回答的问题 | S3 例子 | FS 例子 |
|------|------|-----------|---------|---------|
| Identity | 哪个 provider | 连到哪里 | endpoint + bucket | (无) |
| Path | vault 在 provider 内的位置 | 连到哪里 | `/my-vault` | `/tmp/opfs` |
| Credentials | 如何认证 | 怎么连 | accessKeyId + secretAccessKey | (无) |

三个维度组合为四个核心类型：

```
              FsProviderIdentity (Identity)
             /                       \
      + path                     + credentials
       /                               \
FsProviderEndpoint               FsProviderAccount
  (连到哪里)                         (怎么连)
       \                               /
        \                             /
       FsProviderConfig (完全体)
```

| 类型 | 组成 | 回答的问题 | 作用域 |
|------|------|-----------|--------|
| `FsProviderIdentity` | Identity | 哪个 provider | — |
| `FsProviderEndpoint` | Identity + path | 连到哪里 | per-vault |
| `FsProviderAccount` | Identity + Credentials | 怎么连 | per-device |
| `FsProviderConfig` | Identity + Credentials + path | 完整连接配置 | — |

**设计原则**：每个类型只出现在语义匹配的场景中，不允许用 `path: '/'` 占位或空 credentials 混充。

### Per-Type 定义

判断标准：同一个资源换一个连接参数是否还是同一份数据？是 → Credentials。否 → Identity。

> 类型定义: [`s3.ts`](../../packages/core/src/fs/providers/s3/s3.ts) · [`webdav.ts`](../../packages/core/src/fs/providers/webdav/webdav.ts) · [`fs/def.ts`](../../packages/core/src/fs/providers/fs/def.ts)
>
> 联合类型: [`module.ts`](../../packages/core/src/fs/providers/module.ts)

## 连到哪里：Endpoint

### URL 格式

Endpoint 的序列化形式，遵循 RFC 3986：`{type}://[identity@authority]/path`。不含凭证（凭证属于"怎么连"，见下节）。

- `@` 分离 identity 和 authority（从右往左解析，最后一个 `@` 为分隔符）
- `/` 分离 authority 和 path
- 无 identity 时省略 `@`

| Type | identity | authority | 示例 |
|------|----------|-----------|------|
| webdav | username | host | `webdav://alice@dav.example.com/path` |
| s3 | bucket | endpoint | `s3://mybucket@s3.amazonaws.com/path` |
| fs | — | — | `fs:///home/user/notes` |

URL 必须支持双向转换：`parse(url) → FsProviderEndpoint`，`stringify(endpoint) → url`。

### Remotes

Endpoint 持久化在 config.local.json 的 `remotes` 数组中。config.local.json 位于 vault 的 `.timenote/` 目录下（位置见 [vault.md](vault.md)），per-vault，不同步。

参照 `.env` / `.env.local` 模式
- `config.local.json` = 本地配置（各端独立，不同步），不需要多端兼容
- `config.json` = 可同步的用户偏好（跟着 vault 走），暂不实现

```json
{
  "remotes": [
    {"url": "webdav://alice@dav.example.com/timenote/vaults/proj_abc", "default": true},
    {"url": "s3://mybucket@s3.amazonaws.com/backups/proj_abc", "name": "backup"}
  ]
}
```

| 字段 | 必填 | 缺省 | 说明 |
|------|------|------|------|
| `url` | 是 | — | Endpoint 的 URL 序列化（见上方 URL 格式节） |
| `default` | 否 | `false` | 默认远程。最多一个 `true`（或都没有） |
| `name` | 否 | — | 显示标签 |

## 怎么连：Account

Account 持久化在 Provider Registry 中，per-device 全局配置（不在 vault 中），存储 `FsProviderAccount`（Identity + Credentials，不含 path）。

> 接口定义: [`providers/index.ts`](../../packages/core/src/fs/providers/index.ts) — `FsProviderStore` / `FsProviderEntry`

## Lookup 流程

运行时，将"连到哪里"和"怎么连"合并为完整连接配置：

```
config.local.json → remotes[i].url
  → parse(url) → FsProviderEndpoint (连到哪里)
  → getProviderId(endpoint) → providerId
  → store.getProvider(providerId) → FsProviderAccount (怎么连)
  → { ...account, path: endpoint.path } → FsProviderConfig (完整配置)
  → createFsProvider(config) → FsProvider transport
```
