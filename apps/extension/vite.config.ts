import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

function copyExtensionFiles(): Plugin {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      const srcIconsDir = resolve(__dirname, 'public/icons');
      const iconsDir = resolve(distDir, 'icons');
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true });
      }
      if (existsSync(srcIconsDir)) {
        for (const file of ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png']) {
          const src = resolve(srcIconsDir, file);
          if (existsSync(src)) {
            copyFileSync(src, resolve(iconsDir, file));
          }
        }
      }

      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));
      manifest.background.service_worker = 'background.js';
      manifest.side_panel.default_path = 'src/sidepanel/index.html';
      manifest.action.default_icon = {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      };
      manifest.icons = {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      };
      writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), copyExtensionFiles()],
  build: {
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
  },
  resolve: {
    alias: {
      '@timenote/core': resolve(__dirname, '../../packages/core/src'),
      '@timenote/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
});
