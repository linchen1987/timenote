# Project Documentation

## Debugging & Runtime Guidelines
- **Trust Runtime Errors Over Documentation**: When runtime validation fails (e.g., `invalid_type`, `missing_property`), prioritize the properties explicitly demanded by the error message over high-level documentation or abstraction layers.
- **Trace Source of Truth**: For complex libraries or SDKs with multiple abstraction layers, verify the underlying type definitions (e.g., in `node_modules/**/*.d.ts`) rather than relying solely on top-level Typescript interfaces or online docs. If a library enforces a strict schema at a lower level (e.g., specific property names like `input` vs `args`), explicitly conform to that structure in your data preparation logic, even if high-level helpers exist.
- **Prioritize Schema Documentation**: When debugging structural or validation errors, prioritize searching for the **latest** data schema, object model, or type definition documentation over high-level feature guides. Ensure documentation matches the installed library version.
- **Ask for Help**: If specific documentation (like schema definitions) cannot be located, explicitly ask the user for assistance or links to relevant documentation to avoid wasting time on assumptions

## SSR / Hydration Pitfalls
- **Never return `null` from route components during SSR**: If a component returns `null` on server but content on client, hydration fails silently — effects never run, page stays blank. Return a loading placeholder instead.
- **TipTap `immediatelyRender: true` breaks SSR**: The MarkdownEditor uses `immediatelyRender: true` which fails during SSR. Guard it behind client-only checks (e.g. `ready` state set after `useEffect`).
- **Hydration mismatch at `<html>` level**: Theme class (`light`/`dark`) differs between server and client, causing React hydration error. Fix: add `suppressHydrationWarning` on `<html>` in root layout. Client-side navigation (`<Link>`) always works fine.
- **OPFS/Vault services are browser-only**: Never call `navigator.storage.getDirectory()`, `VaultService`, or `VaultNoteService` during SSR. All vault init must happen inside `useEffect`.

## Vault Architecture (2.0.0)
- **OPFS is truth, IndexedDB is index**: Write OPFS first, then update index. Index can be fully rebuilt from OPFS.
- **Single active vault**: `VaultNoteService.activateVault(projectId)` must complete before any query (listNotes, searchNotes, etc.). Combine activate + load in one useEffect to avoid race conditions.
- **Transport caching**: `VaultService.listVaults()` caches OPFS transports. If you skip `listVaults()` before `getOpfsTransport()`, the transport won't be found. Always call `listVaults()` or `createVault()` first. In route components, call `activateVault()` (which internally calls `listVaults()`) before any note operations.
- **Direct URL access requires self-contained init**: Each route page must independently call `init()` → `activateVault()` → load data. Never assume a parent route already initialized the store.
- **`gray-matter` is NOT browser-compatible**: Uses Node.js `Buffer`. Use `js-yaml` + custom regex for frontmatter.
- **`js-yaml` auto-converts ISO dates to Date objects**: Use `preprocessDates()` to convert back to ISO strings before Zod validation.

## React Router DOCS
- Routing https://reactrouter.com/start/framework/routing 

## Tech Stack
- pnpm (workspace monorepo)
- react-router
- tailwind css v4

## Rules
- 除非用户要求，否则不要自动编辑此文件。
- **Git Operations**: 除非用户明确要求，否则绝对不要自动执行 git commit, git push 等操作。
- comment 不要添加修改说明，只添加当前代码的解释。
- localstorage 在统一文件中管理key. 除去通用key(比如 theme) 都需要使用相同的前缀
- **Import & Quotes**: Always use single quotes `'` and trailing semicolons `;`.
- **Package Imports**: Use `@timenote/core` for core logic, `@timenote/ui` for UI components
- **Web-specific imports**: Use `~/` alias for web-specific code (relative to `apps/web/app/`)
- **Readability & Maintainability**: No inline magic values. Extract meaningful names for constants, keep config/logic/UI separated.

## Project Structure (Monorepo)
- `packages/core/` - Shared core package (`@timenote/core`)
  - `src/db.ts` - Dexie database schema and instance (legacy)
  - `src/types.ts` - TypeScript type definitions (legacy)
  - `src/constants.ts` - Application constants (localStorage keys)
  - `src/utils/` - Utility functions (cn, token, search)
  - `src/fs/` - File system abstraction layer (FsTransport interface)
  - `src/vault/` - Vault subsystem (2.0.0)
    - `spec/` - 持久化格式定义 (Zod schemas: manifest, menu, note, note-id, sync-ledger, delete-log, hash, vault-layout)
    - `provider/` - 底层 adapter (OPFS transport, IndexedDB index, full-text search)
    - `core/` - 核心数据层：同步引擎 + vault 生命周期 (vault-fs, vault-service, sync-algorithm, build-ledger, execute-plan, write-ledger, sync-service, import-service, export-service)
    - `service/` - 业务服务 (vault-store, note-service, menu-service, menu-transform, search-query, migration-service)
  - `src/hooks/` - Shared React hooks
- `packages/ui/` - Shared UI package (`@timenote/ui`)
  - `src/components/ui/` - Shadcn UI components
  - `src/components/editor/` - TipTap Markdown editor
  - `src/components/tree-menu/` - Tree menu component
  - `src/components/theme-provider.tsx` - Theme provider
  - `src/styles/app.css` - Tailwind CSS styles
- `apps/web/` - Web application (Cloudflare Workers SSR)
  - `app/routes/` - Route components
  - `app/lib/vault-store.ts` - Zustand store binding for web
  - `app/services/fs-client.ts` - Server-side WebDAV/S3 client
- `apps/extension/` - Browser extension (Chrome Side Panel)
  - `src/sidepanel/` - Side Panel React SPA
  - `src/background/` - Background Service Worker
  - `src/lib/extension-transport.ts` - Extension FsTransport (chrome.runtime.sendMessage)
  - `src/lib/storage.ts` - Chrome storage adapter

## Business Logic
- 不同的 notebook 中的数据是隔离的

## Terminology (名词概念)
- **Notebook**：用户可见的"笔记本"概念。UI 路由 `/s/:notebookToken`、组件名 `NotebookLayout`、`useNotebooksPage` 等都使用 notebook。Notebook 是面向用户的完整体验单元。
- **Vault**：抽象的核心存储单元。一个 vault 包含 notes、manifest、menu、delete-log、sync-ledger 等物理文件。Vault 不绑定特定存储后端（OPFS/S3/WebDAV/ZIP 都是 adapter）。
- **Project**：vault 的唯一标识符（`projectId`），存储在 manifest 的 `project_id` 字段中。Project 和 vault 是一一对应关系。
- **三者的关系**：Notebook（用户层）= Vault（数据层）= Project（标识层），是同一个实体在不同抽象层的不同名称。

## Key Commands
- `pnpm dev` - Start web dev server
- `pnpm dev:ext` - Start extension dev build (watch mode)
- `pnpm build` - Build web app
- `pnpm build:ext` - Build extension
- `pnpm lint` / `pnpm lint:fix` - Biome lint
- `pnpm test` - Run tests
