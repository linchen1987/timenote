## privider 设计改造

provider(storage and sync) 设计
- 目前只能指定 provider, 需要支持配置具体的 path. path 默认是 timenote/vaults/{project_id}. 完整的 url(endpoint) 是 provider + path
    - 通常不需要手动指定 path. 但是 notebook data 实际是一个目录，所以功能上需要支持
- 每个 notebook 可以各自配置自己的 endpoint (目前是统一配置全局1个 provider)
- 配置 provider 很繁琐，用户无需重复配置 provider. 当用户配置了 provider 后，provider 自动注册到全局
    - 配置 remote 时可以直接选择已有的 provider
- notebook 有两个 endpoint, 一个是本地的 endpoint, 一个是 remote endpoint
    - remote endpoint 可选
    - 本地 endpoint 写死，用户无需关心。目的是统一 endpoint format. opfs 中位置强制为 "opfs"://vaults/{project_id}
    - 数据结构要实现为和 git 相同的支持多个 remote. 功能上当前只支持一个 remote 即可
- 为本地 notebook 设置 remote provider
    - 手动选择(或输入) provider
    - provider 中的路径自动生成 timenote/vaults/{project_id}。也可手动指定
    - 配置后可修改或禁用，不影响其他 notebook
    - 功能上当前只支持一个 remote 即可
- 列出 remote notebook
    - 当前只扫描 provider 中的 /timenote/vaults
    - 因为当前只支持一个 remote，所以如果以存在 project_id 相同的 local notebook 则不列出
- 拉取 remote notebook
    - 选择列出的 notebook 拉取
    - 或手动选择(或输入) provider + path 拉取: path 可以输入任意