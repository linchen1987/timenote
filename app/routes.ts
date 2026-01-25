import {
  type RouteConfig,
  route,
  index,
} from "@react-router/dev/routes";

export default [
  index("routes/notebooks.tsx"),
  route("indexes", "routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("contact", "routes/contact.tsx"),
  
  route("dashboard", "routes/dashboard.tsx", [
    index("routes/dashboard-home.tsx"),
  ]),
  
  route("profile", "routes/profile.tsx"),
  route("settings", "routes/settings.tsx"),
  
  route("blog", "routes/blog.tsx"),
  route("blog/:id", "routes/blog-post.tsx"),
  
  route("markdown", "routes/markdown-playground.tsx"),

  route("notebooks/:notebookId", "routes/notebook-timeline.tsx"),
  route("notebooks/:notebookId/:noteId", "routes/note-detail.tsx"),
] satisfies RouteConfig;
