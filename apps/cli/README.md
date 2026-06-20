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
