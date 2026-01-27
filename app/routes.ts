import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('routes/notebooks.tsx'),
  route('settings', 'routes/settings.tsx'),

  route('s/:notebookToken', 'routes/notebook-layout.tsx', [
    index('routes/notebook-timeline.tsx'),
    route('tags', 'routes/tags.tsx'),
    route('manifest.webmanifest', 'routes/manifest.tsx'),
    route(':noteId', 'routes/note-detail.tsx'),
  ]),

  // Playground 模块
  route('playground', 'routes/playground/index.tsx'),
  route('playground/webdav', 'routes/playground/webdav.tsx'),
  route('playground/data-tools', 'routes/playground/data-tools.tsx'),

  // API
  route('api/fs', 'routes/api.fs.ts'),
] satisfies RouteConfig;
