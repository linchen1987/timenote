
import { Link } from "react-router";

export function meta() {
  return [
    { title: "Profile" },
    { name: "description", content: "User profile page" },
  ];
}

export default function Profile() {
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
          User Profile
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex items-center space-x-6 mb-8">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">JD</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                John Doe
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                john.doe@example.com
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Personal Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    First Name
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">John</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Last Name
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">Doe</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">john.doe@example.com</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Account Settings
              </h3>
              <div className="space-y-3">
                <Link
                  to="/settings"
                  className="block w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-center"
                >
                  Edit Settings
                </Link>
                <button className="block w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}