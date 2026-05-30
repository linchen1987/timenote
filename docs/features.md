# TimeNote 功能清单

## 文档定位

面向 PM 和 Dev 的功能全景图。描述"做什么"和"怎么实现"，不描述实现细节。

## 约定

**实现**列含义：

- **统一实现**：所有端共享同一份代码
- **统一接口**：Core 定义接口，各端注入不同 IO 实现（括号中标注各端差异）
- **统一实现（组合）**：组合多个已有功能点，组合逻辑本身是统一实现；括号中标注所组合的功能点编号

**客户端**列：Web / Extension / CLI / Desktop。"所有端"指以上全部。

---

## 一、数据模型

vault 内所有持久化格式的 schema 与校验。格式定义详见 [vault.md](specs/vault.md)。

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| M1 | 数据模型 | vault 内所有持久化格式的 schema 与校验 | 所有端 | 统一实现 |

---

## 二、笔记本管理

### Vault 生命周期

对 vault 数据本身的创建、修改、销毁。

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| V1 | 初始化 vault | 创建空 vault 目录结构（manifest / menu / delete-log / sync-ledger / config.local.json） | 所有端 | 统一实现 |
| V2 | 修改 vault 元数据 | 修改 vault name 等信息 | 所有端 | 统一实现 |
| V3 | 销毁 vault | 删除 vault 所有文件 | 所有端 | 统一实现 |

### Vault 注册表

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| V4 | 注册 vault | 将 vault 加入注册表 | Web, Extension, Desktop | 统一接口 |
| V4.1 | 创建并注册 vault | 创建空 vault（V1）并注册（V4） | Web, Extension, Desktop | 统一实现（组合 V1 + V4） |
| V4.2 | 打开并注册已有 vault | 打开本地已有 vault 目录并注册（V4） | Desktop | 统一实现（组合 V4） |
| V5 | 移除 vault 注册 | 从注册表移除 | Web, Extension, Desktop | 统一接口 |
| V5.1 | 移除并删除数据 | 移除注册（V5）并销毁数据（V3） | Web, Extension | 统一实现（组合 V5 + V3） |
| V6 | 列出已注册 vaults | 查看注册表中所有 vault | Web, Extension, Desktop | 统一接口 |
| V7 | 激活 vault | 构建索引（D16）+ 读取菜单（D6）+ 加载同步状态到内存 | Web, Extension, Desktop | 统一实现（组合 D16 + D6） |

---

## 三、数据操作

### 笔记操作

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| D1 | 创建笔记 | 生成 ID + 解析标签 + 构建 frontmatter + 写文件 | 所有端 | 统一实现 |
| D2 | 更新笔记 | 读取 → 合并标签 → 更新 frontmatter + 时间戳 → 写文件 | 所有端 | 统一实现 |
| D3 | 删除笔记 | 删除文件 + 追加删除日志 | 所有端 | 统一实现 |
| D4 | 删除日志追加 | 读取 delete-log → 追加记录 → 写回 | 所有端 | 统一实现 |
| D5 | 从正文提取标签 | 解析 Markdown 中的 #tag（含 CJK 字符） | 所有端 | 统一实现 |

### 菜单操作

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| D6 | 读取菜单 | 读取 menu.json → 展平为运行时结构（带 id / parentId / order） | Web, Extension, Desktop | 统一实现 |
| D7 | 保存菜单 | 运行时结构 → 嵌套树 → 写入 menu.json | Web, Extension, Desktop | 统一实现 |
| D8 | 创建菜单项 | 添加 note 或 search 类型菜单项 | Web, Extension, Desktop | 统一实现 |
| D9 | 更新菜单项 | 修改菜单项属性 | Web, Extension, Desktop | 统一实现 |
| D10 | 删除菜单项 | 删除菜单项及其子项 | Web, Extension, Desktop | 统一实现 |
| D11 | 菜单排序 / 移动 | 拖拽排序、层级移动 | Web, Extension, Desktop | 统一实现 |

### 附件操作

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| D12 | 附件写入 | 内容寻址写入（SHA-256 去重，`assets/{hash[:2]}/{hash}.{ext}`） | 所有端 | 统一实现 |
| D13 | 附件读取 | 读取附件二进制数据 | 所有端 | 统一实现 |
| D14 | 附件删除 | 删除指定附件文件 | 所有端 | 统一实现 |
| D15 | 附件垃圾回收 | 扫描所有笔记的附件引用，删除未被引用的附件 | 所有端 | 统一实现 |

### 搜索与索引

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| D16 | 笔记索引构建 | 扫描 vault 文件，解析 frontmatter / 正文，写入索引 | Web, Extension, Desktop | 统一接口（Web/Extension: IndexedDB, Desktop: 待定） |
| D17 | 全文搜索 | 搜索笔记正文内容（AND 匹配，按词频排序） | Web, Extension, Desktop | 统一接口（Web/Extension: 内存倒排索引, Desktop: 待定） |
| D18 | 标签搜索 | 按标签过滤笔记 | Web, Extension, Desktop | 统一接口 |
| D19 | 标签列表 | 列出所有标签及使用计数 | Web, Extension, Desktop | 统一接口 |
| D20 | 时间线查询 | 按 updated_at 降序分页列出笔记 | Web, Extension, Desktop | 统一接口 |

---

## 四、数据同步

### 同步引擎

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| S1 | Ledger 构建 | 从文件系统扫描构建 SyncLedger；或从 ledger 文件读取；支持增量更新（基于脏记录） | 所有端 | 统一实现 |
| S2 | Ledger 写入 | 将 SyncLedger 序列化写入文件 | 所有端 | 统一实现 |
| S3 | 同步算法 | 三方 ledger 对比 → 生成同步计划（toPull / toPush / toDelete / conflict） | 所有端 | 统一实现 |
| S4 | 同步计划执行 | 按计划在本地和远程之间传输文件（笔记 / 元数据 / 附件） | 所有端 | 统一实现 |

### 同步操作

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| S5 | 双向同步 `sync` | 本地与远程双向同步 | 所有端 | 统一实现（组合 S1-S4） |
| S6 | 单向拉取 `pull` | 从远程单向拉取 | 所有端 | 统一实现（组合 S1-S4） |
| S7 | 单向推送 `push` | 向远程单向推送 | 所有端 | 统一实现（组合 S1-S4） |
| S8 | 全量初始化 `initFromSource` | 从空本地 vault 全量拉取 source 数据（无需 ledger 对比） | 所有端 | 统一实现（组合 S1-S4） |
| S9 | Clone | 从任意存储创建本地 vault（V1）并全量拉取（S8） | 所有端 | 统一实现（组合 V1 + S8） |
| S10 | 导入 | 从任意存储导入 vault 数据；vault 不存在时走 S9（Clone），vault 已存在时走 S6（Pull） | 所有端 | 统一实现（组合 S9 或 S6） |
| S10.1 | 从 ZIP 导入 | S10 的特化：source = ZIP 存储（T1.5） | Web, Extension, Desktop | 统一实现（组合 S10 + T1.5） |
| S11 | 导出 | 推送全量数据到任意存储（S7） | 所有端 | 统一实现（组合 S7） |
| S11.1 | 导出到 ZIP | S11 的特化：target = ZIP 存储（T1.5） | Web, Extension, Desktop | 统一实现（组合 S11 + T1.5） |
| S14 | 扫描远程 vault | 扫描远程存储发现已有 vault | Web, Extension, Desktop | 统一实现 |

---

## 五、数据存储

统一的文件系统抽象层。所有 Storage Provider 实现同一套接口，上层代码不感知具体存储方式。

每个 notebook 有一个"本地"存储，零或多个"远程"存储（通过远程绑定配置，用于同步/备份）。"本地"和"远程"是逻辑角色，不是物理区别 — 理论上任何 Storage Provider 都可以承担任一角色。

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| T1 | 文件系统接口 + OPFS Provider | 统一接口（read / write / readBinary / writeBinary / list / remove / exists / ensureDir）+ OPFS 实现 | Web, Extension | 统一实现 |
| T1.2 | Node.js fs Provider | 本地文件系统 | CLI, Desktop | 统一实现 |
| T1.3 | WebDAV Provider | WebDAV 协议 | 所有端 | 统一接口（Web: HTTP API 中转, Extension: Chrome Message 中转, CLI/Desktop: 直连） |
| T1.4 | S3 Provider | S3 协议 | 所有端 | 统一接口（传输方式同 T1.3） |
| T1.5 | ZIP Provider | ZIP 文件读写 | Web, Extension, Desktop | 统一实现 |

---

## 六、存储连接配置

管理 Storage Provider 的连接凭证和远程绑定。

### Storage Provider 凭证管理

全局管理 Storage Provider 的连接凭证（per-device，非 per-vault）。
凭证包括：身份标识、连接参数、密钥/密码。同一 Storage Provider 凭证可被多个 vault 的远程绑定复用。

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| C1 | Storage Provider 凭证格式 | 各类型 Storage Provider 的凭证结构定义及 URL 编址规则 | 所有端 | 统一实现 |
| C2 | 添加 Storage Provider 凭证 | 保存一个 Storage Provider 的连接凭证 | 所有端 | 统一接口 |
| C3 | 删除 Storage Provider 凭证 | 删除 Storage Provider 凭证 | 所有端 | 统一接口 |
| C4 | 列出 Storage Provider 凭证 | 查看已保存的所有 Storage Provider | 所有端 | 统一接口 |
| C5 | 连接测试 | 用 Storage Provider 凭证创建连接 → 探测可用性 → 返回结果 | 所有端 | 统一实现 |

### 远程绑定管理

管理 vault 与远程存储的绑定关系（per-vault）。每个绑定指定一个 Storage Provider 凭证 + 远程路径。

| # | 功能点 | 说明 | 客户端 | 实现 |
|---|--------|------|--------|------|
| C6 | 设置远程绑定 | 为 vault 绑定远程存储（Storage Provider + 路径） | 所有端 | 统一接口 |
| C7 | 移除远程绑定 | 解除 vault 的远程存储绑定 | 所有端 | 统一接口 |
| C8 | 列出远程绑定 | 查看 vault 的所有远程绑定 | 所有端 | 统一接口 |
| C9 | 设置默认远程 | 指定默认远程，自动操作使用此 remote。可不设（不执行自动操作） | 所有端 | 统一接口 |

---

## Tip

- **S10（导入）vs 当前实现**：设计要求 Import vault 不存在时应调用 S9（Clone），当前 `import-service.ts` 直接调用 V1 + S8，未复用 Clone。实现应对齐设计。
- **S10（导入）source 泛化**：设计要求 Import 支持任意 T1 存储作为 source，当前实现仅支持 ZIP 存储（T1.5）。实现应对齐设计，将 ZIP 作为 source 的特化调用。
- **S11（导出）泛化**：设计要求 Export 支持任意 T1 存储作为 target，当前实现仅支持 ZIP 存储（T1.5）。S11.1 是 ZIP 场景的特化调用，当前已有实现。
- **M8（Remote 配置格式）存储位置**：设计要求远程绑定配置存在 vault 内部，当前 CLI 使用 `.timenote/remotes.json`，Web/Extension 使用 localStorage，需统一迁移。详见 [remotes.md](specs/remotes.md)。
