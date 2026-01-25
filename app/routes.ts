import {
  type RouteConfig,
  route,
  index,
} from "@react-router/dev/routes";

export default [
  index("routes/notebooks.tsx"),
  
  route("s/:notebookId/tags", "routes/tags.tsx"),
  route("s/:notebookId", "routes/notebook-timeline.tsx"),
  route("s/:notebookId/:noteId", "routes/note-detail.tsx"),
] satisfies RouteConfig;
