
import { Link, Outlet } from "react-router";

export function meta() {
  return [
    { title: "Dashboard" },
    { name: "description", content: "User dashboard page" },
  ];
}

export default function Dashboard() {
  const stats = [
    { label: "Total Users", value: "1,234", change: "+12%" },
    { label: "Revenue", value: "$45,678", change: "+23%" },
    { label: "Orders", value: "567", change: "+8%" },
    { label: "Conversion", value: "3.2%", change: "-2%" },
  ];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <nav className="mb-8">
          <Link
            to="/"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Home
          </Link>
        </nav>
        
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
          Dashboard
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                {stat.label}
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stat.value}
              </p>
              <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                {stat.change} from last month
              </p>
            </div>
          ))}
        </div>
        
        <Outlet />
      </div>
    </main>
  );
}