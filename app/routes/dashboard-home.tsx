import { Link } from "react-router";

export default function DashboardHome() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Dashboard Home
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Welcome to your dashboard! This is the main dashboard page.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
          <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Quick Stats</h3>
          <p className="text-blue-700 dark:text-blue-400">View your statistics and metrics</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded">
          <h3 className="font-medium text-green-900 dark:text-green-300 mb-2">Recent Activity</h3>
          <p className="text-green-700 dark:text-green-400">Check your latest activities</p>
        </div>
      </div>
      
      <div className="mt-6">
        <Link
          to="/"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}