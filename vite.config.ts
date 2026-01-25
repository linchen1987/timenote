import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false, // 我们手动在 root.tsx 注册，以获得更好的控制
      devOptions: {
        enabled: true,
        type: "module",
      },
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: false,
      workbox: {
        // 排除动态 manifest 路由，防止名称被缓存后无法随笔记本重命名而更新
        navigateFallbackDenylist: [/^\/s\/.*\/manifest.webmanifest$/],
        // 预缓存所有构建产物
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // 运行时缓存策略：对图片使用缓存优先
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
        ],
      },
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
});
