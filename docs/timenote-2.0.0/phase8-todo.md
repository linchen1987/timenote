# Phase 8: Cleanup TODO

> 当 vault 2.0 稳定后，逐步清理旧代码。每项独立可执行。

## 8.1 清理 `@timenote/ui` 旧组件

- [ ] 移除 `packages/ui/src/components/notebook-timeline.tsx` (644 行，内含旧 Dexie `NoteService` / `useLiveQuery`)
- [ ] 移除 `packages/ui/src/components/note-detail-view.tsx` (126 行，内含旧 Dexie)
- [ ] 移除 `packages/ui/src/components/sync-actions.tsx` (依赖旧 sync store)
- [ ] 移除 `packages/ui/src/components/note-tags-view.tsx` (依赖旧 `NoteService`)
- [ ] 清理 `packages/ui/package.json` 中不再需要的依赖 (如 `dexie-react-hooks`)

## 8.2 清理 `packages/core` 旧代码

- [ ] 移除 `packages/core/src/services/note-service.ts` (旧 Dexie NoteService)
- [ ] 移除 `packages/core/src/services/menu-service.ts` (旧 Dexie MenuService)
- [ ] 移除 `packages/core/src/services/sync-service.ts` (旧全量同步)
- [ ] 移除 `packages/core/src/services/import-service.ts` (旧 JSON 导入)
- [ ] 移除 `packages/core/src/services/export-service.ts` (旧 JSON 导出)
- [ ] 移除 `packages/core/src/services/data-tools-service.ts` (旧数据工具)
- [ ] 移除 `packages/core/src/stores/sync-store.ts` (旧 sync store)
- [ ] 保留 `packages/core/src/db.ts` 最小化 — 仅保留迁移检测所需 (`MigrationService` 依赖旧 Dexie 表)
- [ ] 从 core barrel export (`src/index.ts`) 移除旧服务导出

## 8.3 清理 Web App

- [ ] 移除 `apps/web/app/routes/playground/` 整个目录
- [ ] 移除 `apps/web/app/routes/migration.tsx` (迁移完成后不再需要)
- [ ] 移除 `apps/web/app/lib/fs-service.ts` (旧 FsService，settings 页已不需要)
- [ ] 移除 `apps/web/app/lib/sync-service.ts` (旧 sync service adapter)
- [ ] 清理 `apps/web/app/routes/notebook-settings.tsx` 中的旧 DataToolsService 引用
- [ ] 清理 `apps/web/app/routes/landing.tsx` 中 Playground 链接

## 8.4 清理 Extension

- [ ] 移除 `apps/extension/src/lib/fs-service.ts` — settings 页的连接测试改为直接使用 `extensionTransport`
- [ ] 移除 `apps/extension/src/background/sync-scheduler.ts` 中的旧 TODO
- [ ] 移除 `dexie-react-hooks` 依赖 (已从代码中移除，但 package.json 中可能残留)
- [ ] 移除 `@crxjs/vite-plugin` devDependency (未使用)

## 8.5 清理共享依赖

- [ ] 从根 `package.json` 或各 workspace 的 `package.json` 移除不再需要的依赖
- [ ] 确认 `dexie-react-hooks` 已从所有 package.json 移除
- [ ] 确认 `dexie` 仅作为 `MigrationService` 的依赖保留 (最终也可移除)

## 8.6 代码复用优化 (可选)

当前 Web 和 Extension 的 route 文件有大量重复逻辑 (timeline 600+ 行、note detail 160+ 行)。Phase 8 可考虑：

- [ ] 将共享页面逻辑抽取为 `@timenote/ui` 组件 (如 `VaultTimelinePage`, `VaultNoteDetailPage`, `VaultListPage`)
- [ ] 组件接收 `useVaultStore` 作为 prop
- [ ] Web 和 Extension route 各简化为几行
