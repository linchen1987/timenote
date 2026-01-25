import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Demo Home" },
    { name: "description", content: "React Router Demo Pages" },
  ];
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          React Router Demo
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DemoCard
            title="About Page"
            description="Learn more about this demo"
            to="/about"
            color="blue"
          />
          <DemoCard
            title="Contact Page"
            description="Get in touch with us"
            to="/contact"
            color="green"
          />
          <DemoCard
            title="Dashboard"
            description="View your dashboard"
            to="/dashboard"
            color="purple"
          />
          <DemoCard
            title="Profile"
            description="View your profile"
            to="/profile"
            color="orange"
          />
          <DemoCard
            title="Settings"
            description="Manage your settings"
            to="/settings"
            color="red"
          />
          <DemoCard
            title="Blog"
            description="Read our blog posts"
            to="/blog"
            color="indigo"
          />
          <DemoCard
            title="Markdown Playground"
            description="WYSIWYG markdown editor"
            to="/markdown"
            color="pink"
          />
        </div>
      </div>
    </main>
  );
}

function DemoCard({ title, description, to, color }: {
  title: string;
  description: string;
  to: string;
  color: string;
}) {
  const colorClasses = {
    blue: "bg-blue-500 hover:bg-blue-600",
    green: "bg-green-500 hover:bg-green-600",
    purple: "bg-purple-500 hover:bg-purple-600",
    orange: "bg-orange-500 hover:bg-orange-600",
    red: "bg-red-500 hover:bg-red-600",
    indigo: "bg-indigo-500 hover:bg-indigo-600",
    pink: "bg-pink-500 hover:bg-pink-600",
  };

  return (
    <Link
      to={to}
      className={`${colorClasses[color as keyof typeof colorClasses]} text-white rounded-lg p-6 block transition-colors duration-200`}
    >
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-white/80">{description}</p>
    </Link>
  );
}
