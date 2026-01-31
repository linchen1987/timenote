import type { LoaderFunctionArgs } from 'react-router';
import { parseNotebookName } from '~/lib/utils/token';

export async function loader({ params }: LoaderFunctionArgs) {
  const { notebookToken } = params;
  const notebookName = parseNotebookName(notebookToken || '');
  const displayName = notebookName || 'TimeNote';

  const manifest = {
    // 使用 notebookToken 作为唯一标识符，确保不同笔记本是独立的 App 实例
    id: `/s/${notebookToken}`,
    name: `${displayName}`,
    short_name: displayName,
    description: `Notes for ${displayName}`,
    start_url: `/s/${notebookToken}`,
    scope: `/s/${notebookToken}`,
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
