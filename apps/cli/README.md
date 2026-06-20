# @timenote/cli

Timenote 命令行工具，供人类用户和 AI Agent 使用。

## 概念

- **Volume**：一个带认证的存储卷（WebDAV 服务器 / S3 bucket），是配置的最小单元。每个 volume 有唯一的 `volumeUrl`，如 `webdav://user@host` 或 `s3://bucket@endpoint`。
- Volume 凭据存储在 `~/.config/timenote/volumes.json`，与桌面端共享。

## 开发环境使用

在 monorepo 根目录，通过 tsx 直接运行源码（无需 build）：

```bash
npx tsx apps/cli/src/main.ts --help
npx tsx apps/cli/src/main.ts config volume add webdav \
  --host dav.example.com --username user --password pass
npx tsx apps/cli/src/main.ts clone "webdav://user@dav.example.com:timenote/vaults/vX" my-notebook
cd my-notebook
npx tsx ../../apps/cli/src/main.ts pull
```

或使用根目录脚本：

```bash
pnpm dev:cli --help
```

建议添加 alias：

```bash
alias tn='npx tsx apps/cli/src/main.ts'
```

## 命令

### 配置 Volume

```bash
tn config volume add webdav --host <host> --username <user> --password <pass>
tn config volume add webdav --host <host> --username <user> --token <token> --no-tls
tn config volume add s3 --bucket <bucket> --endpoint <endpoint> \
  --access-key-id <id> --secret-access-key <key>
tn config volume list
tn config volume show <volumeUrl>
tn config volume remove <volumeUrl>
```

### Clone Notebook

```bash
tn clone <volumeUrl>:<remotePath> [dir-name]
```

### 管理 Remote

```bash
tn remote set origin <volumeUrl>:<remotePath>
tn remote remove origin
```

### 同步

```bash
tn pull              # 在 vault 目录内执行
tn sync              # 双向同步
```

### Note 操作

```bash
tn note create --content "hello" --tag daily --json
echo "body" | tn note create
tn note create --file ./report.md

tn note update <noteId> --content "new content"
tn note update <noteId> --append "extra text"

tn note delete <noteId>
```

## 远程直连模式（无本地副本 / 可脚本化）

上面的 Note 操作默认作用于**本地 vault 目录**（需要先 `clone`）。`create` / `update`
额外支持 `--remote`，可**直接对远程 vault 操作，无需 clone、无本地副本、无落盘**，
适合脚本 / CI / Agent 一次性写入。底层把 note 暂存于内存 FS，再走同步引擎
（`direction=push`）写入远程 note 与 ledger；push 语义不会删除远程已有文件。

```bash
# 内嵌凭据的连接串（自包含，可放进单个环境变量，零落盘）
tn note create --remote "s3://bucket@endpoint/timenote/vaults/projX?accessKeyId=AKIA&secretAccessKey=secret" \
  --content "hello" --json
tn note create --remote "webdav://user:password@host/timenote/vaults/projX" --content "hello"

# 凭据用 flag 显式传入（密钥不进 URL / 日志）
tn note create --remote "s3://bucket@endpoint/timenote/vaults/projX" \
  --access-key-id "$AK" --secret-access-key "$SK" --content "hello"

# 或用环境变量提供整个连接串
TIMENOTE_REMOTE_URL="s3://bucket@endpoint/path?accessKeyId=AKIA&secretAccessKey=secret" \
  tn note create --content "hello"

# 更新远程已有 note（保留 created_at 等元数据）
tn note update <noteId> --remote "s3://..." --content "new body"
```

### 凭据解析优先级（高 → 低）

1. **Flag**：`--access-key-id` / `--secret-access-key` / `--region`（S3）、`--password`（WebDAV）。
2. **URL 内嵌**：S3 用 query 参数 `?accessKeyId=&secretAccessKey=&region=`；WebDAV 用 userinfo `user:password@host`。
3. **Volume 存储**：`~/.config/timenote/volumes.json`（按 `volumeUrl` 查找），即与 `config volume add` 一致。

URL 中的非密钥信息（endpoint / bucket / host / username / 路径）始终取自 URL；flag 仅用于覆盖密钥。

