# 数据存储架构

## 概览

支持 WebDAV 和 S3 两种存储后端，通过统一接口屏蔽差异。

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Frontend       │     │  API Route      │     │  Provider       │
│  FsService      │────▶│  /api/fs        │────▶│  FsClient       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                            ┌───────────┴───────────┐
                                            ▼                       ▼
                                    ┌─────────────┐         ┌─────────────┐
                                    │ WebDAV      │         │ S3          │
                                    │ WebDavFsClient│       │ S3FsClient  │
                                    └─────────────┘         └─────────────┘
```

## 文件结构

| 文件 | 职责 |
|------|------|
| `app/lib/services/sync/service.ts` | 前端业务层，负责数据同步逻辑 |
| `app/lib/services/fs-service.ts` | 前端服务，管理连接配置，调用 API |
| `app/routes/api.fs.ts` | API 路由，分发请求到对应 FsClient |
| `app/services/fs-client.ts` | FsClient 接口及 WebDAV/S3 实现 |

## WebDAV vs S3 差异

| 特性 | WebDAV | S3 |
|------|--------|-----|
| 目录 | 真实目录，可 stat | 虚拟概念，基于 key 前缀 |
| mkdir | 必须先创建目录才能写文件 | 无需创建，直接写文件 |
| ensureDir | 递归检查并创建目录 | 空操作，直接返回 |
| stat 目录 | 返回 directory 类型 | 404 时检查是否有子对象 |
| 底层库 | `webdav` | `@bradenmacdonald/s3-lite-client` |

## 数据同步

### 目录结构

```
/timenote/                    # SYNC_ROOT_PATH
  /nb_{notebookId}/           # 每个笔记本一个目录
    data.json                 # 笔记本数据（笔记、标签等）
```

### 同步流程

```
push(notebookId)
  ├── init() → ensureDir(/timenote)
  ├── ensureDir(/timenote/nb_{id})
  └── write(/timenote/nb_{id}/data.json)

pull(notebookId)
  └── read(/timenote/nb_{id}/data.json) → 合并到本地
```
