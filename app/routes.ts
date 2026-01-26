import {
  type RouteConfig,
  route,
  index,
} from "@react-router/dev/routes";

export default [
  index("routes/notebooks.tsx"),
  
  route("s/:notebookToken/tags", "routes/tags.tsx"),
  route("s/:notebookToken", "routes/notebook-timeline.tsx"),
  route("s/:notebookToken/manifest.webmanifest", "routes/manifest.tsx"),
  route("s/:notebookToken/:noteId", "routes/note-detail.tsx"),
  
  // Playground 模块
  route("playground", "routes/playground/index.tsx"),
  route("playground/webdav", "routes/playground/webdav.tsx"),

  // API
  route("api/fs", "routes/api.fs.ts"),
] satisfies RouteConfig;
