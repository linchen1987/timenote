import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { createBlockletPlugin } from 'vite-plugin-blocklet';

// https://vitejs.dev/config/
const config = {
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      manifest: false,
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/manifest.json': 'http://localhost:3001',
      '/logo': 'http://localhost:3001',
    },
  },
};

if (process.env.BUILD_BLOCKLET) {
  config.plugins.push(
    createBlockletPlugin({
      loadingColor: '#3773F2',
    })
  );
}

// https://vitejs.dev/config/
export default defineConfig(config);
