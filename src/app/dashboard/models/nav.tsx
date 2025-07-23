'use client';

import { Book, Calendar, FileText, Home, Settings, User, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';

export default function Nav() {
  const [selected, setSelected] = useState<string>('Calendar');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { profile, session, status } = useProfile();
  const role = session?.user?.role;

  const studentNavItems = [
    { icon: Home, label: 'Home', link: '/dashboard' },
    { icon: Calendar, label: 'Calendar', link: '/dashboard/calendar' },
    { icon: Book, label: 'Courses', link: '/dashboard/browse-courses' },
    { icon: FileText, label: 'Tests', link: '/dashboard/tests' },
    { icon: FileText, label: 'Submissions', link: '/dashboard/submissions' },
    { icon: User, label: 'Account', link: '/dashboard/account' },
    { icon: Settings, label: 'Settings', link: '/dashboard/settings' },
  ];

  const tutorNavItems = [
    { icon: Home, label: 'Home', link: '/dashboard' },
    { icon: Calendar, label: 'Calendar', link: '/dashboard/calendar' },
    { icon: Wrench, label: 'Manage Courses', link: '/dashboard/manage-courses' },
        { icon: FileText, label: 'Review Tests', link: '/dashboard/tests' },
    { icon: FileText, label: 'Review Submissions', link: '/dashboard/submissions' },
    { icon: User, label: 'Account', link: '/dashboard/account' },
    { icon: Settings, label: 'Settings', link: '/dashboard/settings' },
  ];

  const navItems = role === 'TUTOR' ? tutorNavItems : studentNavItems;

  return (
    <nav
      className={`sticky top-0 h-screen z-30 bg-white border-r border-gray-300 shadow-sm transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-48'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        {!isCollapsed && <span className="text-2xl font-bold text-blue-500">Grit</span>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-500 text-2xl hover:text-gray-700"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '»' : '«'}
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
                    ? 'bg-blue-100 text-blue-600 font-semibold'
                    : 'hover:bg-blue-50 text-gray-700'
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
