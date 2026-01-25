import {
  type RouteConfig,
  route,
  index,
  layout,
} from "@react-router/dev/routes";

export default [
  // 首页
  index("routes/home.tsx"),
  
  // 关于页面
  route("about", "routes/about.tsx"),
  
  // 联系页面
  route("contact", "routes/contact.tsx"),
  
  // 仪表板布局和子路由
  route("dashboard", "routes/dashboard.tsx", [
    index("routes/dashboard-home.tsx"),
  ]),
  
  // 用户资料
  route("profile", "routes/profile.tsx"),
  
  // 设置
  route("settings", "routes/settings.tsx"),
  
  // 博客和博客详情
  route("blog", "routes/blog.tsx"),
  route("blog/:id", "routes/blog-post.tsx"),
  
] satisfies RouteConfig;
