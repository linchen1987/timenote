import {
  type RouteConfig,
  route,
  index,
} from "@react-router/dev/routes";

export default [
  index("routes/notebooks.tsx"),
  
  route("s/:notebookToken/tags", "routes/tags.tsx"),
  route("s/:notebookToken", "routes/notebook-timeline.tsx"),
  route("s/:notebookToken/:noteId", "routes/note-detail.tsx"),
] satisfies RouteConfig;
