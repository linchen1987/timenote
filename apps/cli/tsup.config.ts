import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs'],
  target: 'node18',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: ['@timenote/core', '@timenote/core/fs/node-fs'],
  external: ['react', 'react-dom', 'dexie', 'zustand', 'jszip'],
});
