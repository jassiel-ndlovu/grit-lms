import { Book, Calendar, FileText, Home, Settings, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [selected, setSelected] = useState<string>("Calendar");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { icon: Home, label: "Home", link: "/dashboard" },
    { icon: Calendar, label: "Calendar", link: "#" },
    { icon: Book, label: "Courses", link: "#" },
    { icon: FileText, label: "Tests", link: "#" },
    { icon: FileText, label: "Submissions", link: "#" },
    { icon: User, label: "Account", link: "#" },
    { icon: Settings, label: "Settings", link: "#" },
  ];

  return (
    <nav
      className={`sticky top-0 h-screen z-30 bg-gray-100 border-r border-gray-300 shadow-sm transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-48"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        {!isCollapsed && <span className="text-2xl font-bold text-blue-500">Grit</span>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-500 text-2xl hover:text-gray-700"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? "»" : "«"}
        </button>
      </div>

      {/* Nav Items */}
      <ul className="flex flex-col items-center text-sm space-y-4 mt-4">
        {navItems.map(({ icon: Icon, label, link }) => (
          <Link key={label} href={link} className="w-full">
          <li>
            <button
              onClick={() => setSelected(label)}
              className={`flex items-center w-full px-4 py-2 transition-colors ${
                selected === label
                  ? "bg-blue-100 text-blue-600 font-semibold"
                  : "hover:bg-blue-50 text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {!isCollapsed && <span className="ml-3">{label}</span>}
            </button>
          </li>
          </Link>
        ))}
      </ul>
    </nav>
  );
}
