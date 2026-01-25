
import { Link } from "react-router";

export function meta() {
  return [
    { title: "Blog" },
    { name: "description", content: "Blog posts page" },
  ];
}

export default function Blog() {
  const posts = [
    {
      id: 1,
      title: "Getting Started with React Router v7",
      excerpt: "Learn how to build modern web applications with React Router v7",
      date: "2024-01-15",
      author: "John Doe"
    },
    {
      id: 2,
      title: "Tailwind CSS Best Practices",
      excerpt: "Discover the best practices for using Tailwind CSS in your projects",
      date: "2024-01-10",
      author: "Jane Smith"
    },
    {
      id: 3,
      title: "TypeScript Tips and Tricks",
      excerpt: "Improve your TypeScript skills with these helpful tips",
      date: "2024-01-05",
      author: "Bob Johnson"
    }
  ];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <nav className="mb-8">
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Home
          </Link>
        </nav>
        
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
          Blog
        </h1>
        
        <div className="space-y-6">
          {posts.map((post) => (
            <article key={post.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {post.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {post.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <span>{post.author}</span>
                  <span className="mx-2">•</span>
                  <span>{post.date}</span>
                </div>
                <Link
                  to={`/blog/${post.id}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Read more →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}