# FsStorage 规范

> 类型定义在 [`packages/core/src/fs/`](../../packages/core/src/fs/) 下。
> 联合类型入口: [`types.ts`](../../packages/core/src/fs/types.ts)

## 概述

FsStorage 是 timenote 对存储后端的抽象（S3, WebDAV, 本地文件系统等），提供统一的 `FsClient` 接口。

FsStorage 需要回答两个问题：**连到哪里**（Volume + rootPath：哪个存储卷的哪个路径），以及**怎么连**（Credentials：用什么凭证）。这是两个独立的关注点——一个凭证可以访问同一存储卷下的不同路径，一个 vault 也可以配置多个远程目标。

## Scheme

存储后端的协议标识：

| Scheme | 说明 | 示例 |
|--------|------|------|
| `localfs` | 本地文件系统（OPFS / Node.js fs） | `localfs://` |
| `s3` | S3 兼容对象存储 | `s3://bucket@endpoint/path` |
| `webdav` | WebDAV 协议 | `webdav://user@host/path` |

`FsScheme = 'localfs' | 's3' | 'webdav'`

## 类型体系

每个存储后端由三个正交维度描述：

| 维度 | 含义 | 回答的问题 |
|------|------|-----------|
| Volume | 哪个存储卷 | 连到哪里 |
| rootPath | 存储卷内的根路径 | 连到哪里 |
| Credentials | 如何认证 | 怎么连 |

各 scheme 各维度示例：

| Scheme | Volume | rootPath | Credentials |
|--------|--------|----------|-------------|
| localfs | (无，固定) | `timenote/vaults/proj_abc` | (无) |
| s3 | endpoint + bucket | `timenote/vaults/proj_abc` | accessKeyId + secretAccessKey |
| webdav | host + username | `timenote/vaults/proj_abc` | password |

三个维度组合为四个核心类型：

```
                  FsVolume (Volume)
                /                   \
         + rootPath           + credentials
           /                         \
  FsEndpoint                   FsVolumeAccess
  (连到哪里)                      (怎么连)
        \                           /
         \                         /
        FsClientConfig (完全体)
```

| 类型 | 组成 | 回答的问题 | 作用域 |
|------|------|-----------|--------|
| `FsVolume` | Volume（scheme 特有标识字段） | 哪个存储卷 | — |
| `FsEndpoint` | Volume + rootPath | 连到哪里 | per-vault |
| `FsVolumeAccess` | Volume + Credentials | 怎么连 | per-device |
| `FsClientConfig` | Volume + Credentials + rootPath | 完整连接配置 | — |

**设计原则**：每个组合类型只包含其语义所需的维度。不适用的维度直接省略字段，而不是用默认值（如 `rootPath: '/'` 或 `credentials: {}`）填充。这样类型本身就能精确表达语义，避免调用方猜测字段值是真实含义还是"无"。

### Per-Scheme 类型定义

> 类型定义: [`adapters/s3/s3.ts`](../../packages/core/src/fs/adapters/s3/s3.ts) · [`adapters/webdav/webdav.ts`](../../packages/core/src/fs/adapters/webdav/webdav.ts) · [`adapters/localfs/types.ts`](../../packages/core/src/fs/adapters/localfs/types.ts)
>
> 联合类型: [`types.ts`](../../packages/core/src/fs/types.ts)

每个 scheme 定义四组类型，遵循统一的组合规则：

```
{Scheme}Volume        = { scheme: '{scheme}' } + 标识字段
{Scheme}Endpoint      = {Scheme}Volume & { rootPath }
{Scheme}Credentials   = 凭证字段（localfs 无凭证则不定义）
{Scheme}VolumeAccess  = {Scheme}Volume & {Scheme}Credentials
{Scheme}ClientConfig  = {Scheme}Volume & {Scheme}Credentials & { rootPath }
```

跨 scheme 联合类型（`FsVolume`、`FsEndpoint`、`FsVolumeAccess`、`FsClientConfig`）在 `types.ts` 中定义，每增加 scheme 时扩展对应 union。

### Volume vs Credentials 判断标准

同一个资源换一个连接参数是否还是同一份数据？是 → Credentials。否 → Volume (Identity)。

例如：S3 的 endpoint + bucket 决定了数据在哪里（Volume），而 accessKeyId + secretAccessKey 只决定谁能访问（Credentials）。WebDAV 的 host + username 决定了数据在哪里（Volume），而 password 决定认证方式（Credentials）。

## Volume URL

每个存储卷有一个唯一标识 `volumeUrl`，由 scheme 特有的标识字段计算得出，不含凭证，不含路径。

| Scheme | 格式 | 示例 |
|--------|------|------|
| localfs | `localfs://` | `localfs://` |
| s3 | `s3://{bucket}@{endpoint}` | `s3://mybucket@s3.amazonaws.com` |
| webdav | `webdav://{username}@{host}` | `webdav://alice@dav.example.com` |

`volumeUrl` 用作 `FsVolumeAccessStore` 的 key。

## URL 格式（Endpoint 序列化）

Endpoint 的序列化形式遵循 RFC 3986：`{scheme}://[identity@authority]/path`。不含凭证。

- `@` 分离 identity 和 authority（从右往左解析，最后一个 `@` 为分隔符）
- `/` 分离 authority 和 path
- 无 identity 时省略 `@`

| Scheme | identity | authority | 示例 |
|--------|----------|-----------|------|
| webdav | username | host | `webdav://alice@dav.example.com/timenote/vaults/proj_abc` |
| s3 | bucket | endpoint | `s3://mybucket@s3.amazonaws.com/timenote/vaults/proj_abc` |
| localfs | — | — | `localfs://` |

URL 必须支持双向转换：`parse(url) → FsEndpoint`，`stringify(endpoint) → url`。

## 术语：两种 path

| 概念 | 含义 | 所在位置 | 可变性 |
|------|------|---------|--------|
| **rootPath** | FsClient 的根路径，文件操作的起始目录。创建实例时绑定 | `FsEndpoint` / `FsClientConfig` / `FsClient.rootPath` | 不可变（实例级） |
| **path**（操作路径） | 具体文件或目录的路径，相对于 rootPath。每次文件操作时传入 | `FsClient.read(path)` / `FsClient.write(path, ...)` 等 | 每次调用不同 |

## 命名规则

| 前缀 | 含义 | 示例 |
|------|------|------|
| `Fs` | 模块级，跨 scheme | `FsClient`、`FsScheme`、`FsVolumeAccess` |
| `{Scheme}` | scheme 专属 | `S3Volume`、`WebdavCredentials` |

scheme 名 PascalCase 作为前缀。`localfs` 使用 `LocalFs`（中间大写），与 `Fs`（整个模块级前缀）区分。

## Driver

Driver 封装平台差异。同一个 scheme 在不同平台注册不同 Driver（如 localfs 在 CLI 注册 Node 实现，在 Web 注册 OPFS 实现）。Driver 接受 `FsClientConfig` 返回 `FsClient` 实例。

各端在启动时显式注册所需的 Driver，同一 scheme 可以有多个实现（如直连 vs RPC 代理），由各端选择注册哪一个。

## Remotes

Remote Endpoint 持久化在 `.timenote/config.local.json` 的 `remotes` 数组中，per-vault，不同步。

参照 `.env` / `.env.local` 模式：
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
| `url` | 是 | — | Endpoint 的 URL 序列化（见 URL 格式节） |
| `default` | 否 | `false` | 默认远程。最多一个 `true`（或都没有） |
| `name` | 否 | — | 显示标签（如 `origin`、`backup`） |

## 怎么连：VolumeAccess

VolumeAccess（凭证）持久化在 `FsVolumeAccessStore` 中，per-device 全局配置（不在 vault 中），以 `volumeUrl` 为 key。

各端提供不同的 store 实现（Web/Extension 用 localStorage，CLI 用文件）。

