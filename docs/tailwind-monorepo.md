# Tailwind CSS v4 in Monorepo

## Problem

`@tailwindcss/vite` auto-detection only scans the app's own directory. In a monorepo, classes used in workspace packages (`packages/ui`, `packages/core`) are not detected, resulting in missing CSS output.

## Solution

Use `@source` directive in each app's CSS entry point to include workspace packages.

### Web App (`apps/web/app/app.css`)

```css
@import "tailwindcss";

@source "../../../packages/ui/src";
@source "../../../packages/core/src";
```

### Extension (`apps/extension/src/sidepanel/app.css`)

```css
@import "tailwindcss";

@source "../../../../packages/ui/src";
@source "../../../../packages/core/src";
```

## Notes

- Paths are relative to the CSS file location
- If new packages using Tailwind classes are added, they need a corresponding `@source` entry
- Alternatively, can be simplified to `@source "../../../packages/*/src"` for automatic coverage
