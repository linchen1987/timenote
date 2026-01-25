
import { Link } from "react-router";

export function meta() {
  return [
    { title: "About" },
    { name: "description", content: "About this demo application" },
  ];
}

export default function About() {
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
          About This Demo
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            React Router v7 Demo
          </h2>
          
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            This is a demonstration of React Router v7 capabilities including:
          </p>
          
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-6">
            <li>File-based routing</li>
            <li>Navigation with Link component</li>
            <li>Route metadata</li>
            <li>Type-safe routes</li>
            <li>Tailwind CSS integration</li>
          </ul>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
                <h4 className="font-medium text-blue-900 dark:text-blue-300">Modern Stack</h4>
                <p className="text-blue-700 dark:text-blue-400 text-sm">React Router v7 + TypeScript + Tailwind CSS</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded">
                <h4 className="font-medium text-green-900 dark:text-green-300">Cloudflare Ready</h4>
                <p className="text-green-700 dark:text-green-400 text-sm">Deploy to Workers with wrangler</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}