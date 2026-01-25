# Project Documentation

## Debugging & Runtime Guidelines
- **Trust Runtime Errors Over Documentation**: When runtime validation fails (e.g., `invalid_type`, `missing_property`), prioritize the properties explicitly demanded by the error message over high-level documentation or abstraction layers.
- **Trace Source of Truth**: For complex libraries or SDKs with multiple abstraction layers, verify the underlying type definitions (e.g., in `node_modules/**/*.d.ts`) rather than relying solely on top-level Typescript interfaces or online docs. If a library enforces a strict schema at a lower level (e.g., specific property names like `input` vs `args`), explicitly conform to that structure in your data preparation logic, even if high-level helpers exist.
- **Prioritize Schema Documentation**: When debugging structural or validation errors, prioritize searching for the **latest** data schema, object model, or type definition documentation over high-level feature guides. Ensure documentation matches the installed library version.
- **Ask for Help**: If specific documentation (like schema definitions) cannot be located, explicitly ask the user for assistance or links to relevant documentation to avoid wasting time on assumptions

## React Router DOCS
- Routing https://reactrouter.com/start/framework/routing 

## Tech Stack
- pnpm
- react-router
- tailwind css v4

## Rules
- 除非用户要求，否则不要自动编辑此文件。
- 注释中不要添加修改说明，只添加当前代码的解释。

## Files
- note列表页 /app/routes/notebook-timeline.tsx
