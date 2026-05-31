# createFsProvider 依赖注入重构

## 背景

`createFsProvider` 根据 URL 创建 FsProvider。创建过程需要查找持久化的 provider 配置（S3/WebDAV 的凭证等）。当前签名：

```ts
createFsProvider(sourceUrl: string, store: StorageProviderStore): FsProvider
```

`StorageProviderStore` 是平台相关的（Web/Extension 用 localStorage，CLI 用文件系统）。core 不持有任何平台实现。

## 问题

每个调用方都要显式传 `store`，但在同一上下文中 store 永远是同一个：
- `VaultOrchestrator` 内部 3 处调用都传 `this.providerStore`
- CLI 的 sync/clone 每次都传刚创建的 `FileProviderStore`

重复传参，依赖关系不清晰。

## 方案

### A. 闭包注入（推荐）

构造时注入 store，返回绑定好的函数：

```ts
function bindCreateFsProvider(store: StorageProviderStore) {
  return (sourceUrl: string): FsProvider => {
    // 内部用 store，调用方不再需要传
  };
}
```

Orchestrator 构造函数签名：

```ts
constructor(
  registry: VaultRegistry | (() => Promise<VaultRegistry>),
  createFsProvider: (sourceUrl: string) => FsProvider,
)
```

### B. Effect-TS（未来可选）

core 内部用 Effect `Context` + `Layer` 管理依赖，边界处 `runPromise` 转回普通值。web/extension 无感知。

渐进式可行，但当前场景 ROI 不高（3-4 个服务，线性依赖）。等依赖图变复杂再评估。

## 改动范围

| 文件 | 改动 |
|------|------|
| `providers/index.ts` | `createFsProvider(url, store)` → `bindCreateFsProvider(store)` 返回闭包 |
| `vault-orchestrator.ts` | 第二参数 `StorageProviderStore` → `(url: string) => FsProvider`；删除 `providerStore`/`getProviderStore()` |
| `vault-store.ts` (Zustand) | `listProviders/saveProvider/deleteProvider` 不再委托 orchestrator，额外接收 store |
| `web/extension vault-store.ts` | `bindCreateFsProvider(createLocalStorageProviderStore())` + 传 store |
| `cli/vault.ts` | `bindCreateFsProvider(await createFileProviderStore())` |
| `core/src/index.ts` | 导出 `bindCreateFsProvider` |
