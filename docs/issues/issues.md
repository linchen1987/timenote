## TODO
- #cli review code
    - 远程存储 sdk core (fs-client) : fs-client 命名不好
- #cli #desktop provider 设计

## Feature
- provider setting ui 修改：支持查看和修改配置（查看所有配置，修改非id相关的配置）

## Bug
- provider:settings 中配置oss后test还是不通过(web)
- extension 从 note list page 返回后还是无法点击（页面元素点击无响应）

## refactor
- 使用 zustand 管理 note list page and note detail page 状态，主要目的是 detail 改动后返回 list page 能立刻看到变化

## chore
- 测试 aliyun oss 权限！
- 当前结构能支撑多少篇笔记（clone/push, index, 其他）

## cli
- add-provider list-provider remove-provider 格式应该为 provider list|add|remove
- url 和 endpoint 应该统一
- clone 下来后 sync-ledger 数据好像被去掉了，是这样吗？
- 当 cli note create 所在目录不是 timenote vault 时错误信息太乱
- note create --json 参数是什么意思
- note 操作太多，目前没有必要，keep simple. --append --file
- [x] sync-ledger 好像有问题。clone 下来后 sync-ledger 数据好像被去掉了，是这样吗？.添加了1个note后 sync，预期是添加一条笔记，但是返回 Synced with "origin": pulled 0, pushed 0, conflicts 0. pull 测试正常
- 需要测试
- spec 中的代码一定不要随意修改，确定修改一定要有文档和测试。 `remotes: 'remotes.json'`


### md 增强
- 数据库表格 (mini notion)
- 图片笔记（展示为图片/相册等形式）
- \`\[\[xxx\]\]\` 双链 (兼容 obsidian)
- 嵌入/引用/块引用 (兼容 obsidian)

### Project ID
- 设置 project id 的目的是为了防止手误将两份 notebook 合并.
- 作为目录名时，用户可以查看存储 (比如 opfs, s3, webdav, file system), 所以目录名需要人类可读
- project id 不应该和 notebook 目录名强耦合

## mark

### Package 层面调整
- [ ] 评估 `packages/core` 的导出结构，清理 legacy exports
- [ ] 评估 `packages/core/src/vault/index.ts` barrel 是否合理，是否应按子模块导出
- [ ] 评估 `src/fs/` (FsTransport) 与 `vault-fs.ts` (VaultFs) 的关系，是否应统一

### 功能增强
- [ ] `applyDirtyEntries` 中 notes 的 `u` 应从 frontmatter 提取 `updated_at`（当前用 `new Date()`）
- [ ] `buildSourceLedger` fallback 到全量扫描时是否需要日志/warning
- [ ] sync 冲突策略（当前按 `u` 时间戳方向判断），是否需要更精细的策略（如 per-file conflict resolution）