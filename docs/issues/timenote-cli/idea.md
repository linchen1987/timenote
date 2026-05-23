## timenote cli (供 agent 和 human 使用)

cli 核心功能
- 使用 cli clone, pull, sync notebook
- 如何 clone notebook
    - 可配置多个 provider
    - 通过 provider + path 下载. 和 git clone 感觉类似
- create/update/delete note

其他功能先不支持

case
- 用户 or agent 在一个 project (local dir) 中 clone 1个或多个 notebook
- 分别管理每一个 notebook (create/update/delete note, sync notebook)
- e.g. 分析处理 notebookA 中的数据, 生成通知或报道，写入到 notebook2 中
- e.g. 只操作一个 notebook, 分析过往note, 生成新的 note

代码要尽量复用