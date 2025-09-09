'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, FileText, Home, Settings, User, Wrench, ChevronLeft, ChevronRight, GraduationCap, Clock, Target, Bell, Search, BookOpen, PenTool, Award, Users, HelpCircle, LogOut, LucideIcon } from 'lucide-react';
import { useProfile } from '@/context/ProfileContext';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Skeleton from '../components/skeleton';
import { signOut } from 'next-auth/react';
import { useNotifications } from '@/context/NotificationsContext';

type Color = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'yellow' | 'indigo' | 'pink' | 'gray';

type NavItems = {
  icon: LucideIcon;
  label: string;
  link: string;
  color: Color;
  badge?: number;
  description?: string;
}

export default function Nav() {
  const { session, profile } = useProfile();
  const { notifications } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('Home');

  // Calculate unread notifications count
  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  const studentNavItems: NavItems[] = useMemo(() => [
    {
      icon: Home,
      label: 'Dashboard',
      link: '/dashboard',
      color: 'blue',
      description: 'Overview & stats'
    },
    {
      icon: BookOpen,
      label: 'My Courses',
      link: '/dashboard/courses',
      color: 'purple',
      description: 'Enrolled courses'
    },
    {
      icon: Calendar,
      label: 'Schedule',
      link: '/dashboard/calendar',
      color: 'green',
      description: 'Events & meetings'
    },
    {
      icon: PenTool,
      label: 'Submissions',
      link: '/dashboard/submissions',
      color: 'orange',
      description: 'Tasks & projects'
    },
    {
      icon: FileText,
      label: 'Tests & Quizzes',
      link: '/dashboard/tests',
      color: 'red',
      description: 'Assessments'
    },
    {
      icon: Award,
      label: 'Grades',
      link: '#',
      color: 'yellow',
      description: 'Performance tracking'
    },
    {
      icon: Users,
      label: 'Study Groups',
      link: '#',
      color: 'indigo',
      description: 'Collaborate & learn'
    },
    {
      icon: Bell,
      label: 'Notifications',
      link: '/dashboard/notifications',
      color: 'pink',
      badge: unreadNotificationsCount,
      description: 'Updates & alerts'
    }
  ], [unreadNotificationsCount]);

  const tutorNavItems: NavItems[] = useMemo(() => [
    {
      icon: Home,
      label: 'Dashboard',
      link: '/dashboard',
      color: 'blue',
      description: 'Overview & analytics'
    },
    {
      icon: Wrench,
      label: 'Manage Courses',
      link: '/dashboard/manage-courses',
      color: 'purple',
      description: 'Course management'
    },
    {
      icon: Calendar,
      label: 'Schedule',
      link: '/dashboard/calendar',
      color: 'green',
      description: 'Events & meetings'
    },
    {
      icon: FileText,
      label: 'Tests & Quizzes',
      link: '/dashboard/tutor-tests',
      color: 'red',
      description: 'Tests & grading'
    },
    {
      icon: PenTool,
      label: 'Submissions',
      link: '/dashboard/submissions',
      color: 'orange',
      description: 'Tasks & projects'
    },
    {
      icon: Bell,
      label: 'Notifications',
      link: '/dashboard/notifications',
      color: 'pink',
      badge: unreadNotificationsCount,
      description: 'Updates & alerts'
    }
  ], [unreadNotificationsCount]);

  const navItems = session?.user.role === 'TUTOR' ? tutorNavItems : studentNavItems;

  const bottomNavItems: NavItems[] = useMemo(() => [
    {
      icon: User,
      label: 'Profile',
      link: '/dashboard/account',
      color: 'gray'
    },
    {
      icon: Settings,
      label: 'Settings',
      link: '/dashboard/settings',
      color: 'gray'
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      link: '#',
      color: 'gray'
    }
  ], []);

  // Function to set active item based on pathname
  const setActiveItemFromPathname = useCallback(() => {
    const allNavItems = [...navItems, ...bottomNavItems];

    // Normalize pathname (remove trailing slash if present)
    const cleanPath = pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;

    // Sort items by path length (longest first) to prioritize more specific matches
    const sortedItems = [...allNavItems].sort((a, b) =>
      b.link.split('/').length - a.link.split('/').length
    );

    // Find the best matching item
    let bestMatch = null;
    let bestMatchLength = 0;

    for (const item of sortedItems) {
      // Skip items with empty links or placeholder links
      if (!item.link || item.link === "#") continue;

      // Normalize item link
      const cleanItemLink = item.link.endsWith("/") && item.link !== "/"
        ? item.link.slice(0, -1)
        : item.link;

      // Check if the current path starts with the item link
      if (cleanPath.startsWith(cleanItemLink)) {
        // Prefer the longest (most specific) match
        if (cleanItemLink.length > bestMatchLength) {
          bestMatch = item;
          bestMatchLength = cleanItemLink.length;
        }
      }
    }

    if (bestMatch) {
      setActiveItem(bestMatch.label);
    } else {
      // Fallback: try to match by the first segment
      const pathSegments = cleanPath.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const firstSegment = `/${pathSegments[0]}`;
        const fallbackMatch = allNavItems.find(item =>
          item.link && item.link.startsWith(firstSegment)
        );
        if (fallbackMatch) {
          setActiveItem(fallbackMatch.label);
        }
      }
    }
  }, [navItems, bottomNavItems, pathname]);

  // Update active item when pathname changes
  useEffect(() => {
    setActiveItemFromPathname();
  }, [pathname, session?.user.role, setActiveItemFromPathname]);

  const getColorClasses = (color: Color, isActive: boolean = false) => {
    const colors = {
      blue: isActive
        ? 'bg-blue-100 text-blue-700 border-blue-200'
        : 'hover:bg-blue-50 hover:text-blue-600',
      purple: isActive
        ? 'bg-purple-100 text-purple-700 border-purple-200'
        : 'hover:bg-purple-50 hover:text-purple-600',
      green: isActive
        ? 'bg-green-100 text-green-700 border-green-200'
        : 'hover:bg-green-50 hover:text-green-600',
      orange: isActive
        ? 'bg-orange-100 text-orange-700 border-orange-200'
        : 'hover:bg-orange-50 hover:text-orange-600',
      red: isActive
        ? 'bg-red-100 text-red-700 border-red-200'
        : 'hover:bg-red-50 hover:text-red-600',
      yellow: isActive
        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
        : 'hover:bg-yellow-50 hover:text-yellow-600',
      indigo: isActive
        ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
        : 'hover:bg-indigo-50 hover:text-indigo-600',
      pink: isActive
        ? 'bg-pink-100 text-pink-700 border-pink-200'
        : 'hover:bg-pink-50 hover:text-pink-600',
      gray: isActive
        ? 'bg-gray-100 text-gray-700 border-gray-200'
        : 'hover:bg-gray-50 hover:text-gray-600'
    };
    return colors[color] || colors.gray;
  };

  const handleNavItemClick = (label: string, link: string) => {
    setActiveItem(label);
    router.push(link);
  }

  return (
    <nav className={`sticky top-0 h-screen overflow-y-auto bg-white border-r border-gray-200 shadow-lg transition-all duration-300 ease-in-out z-30 ${isCollapsed ? 'w-24' : 'w-72'
      }`}>
      {/* Header */}
      <div className="relative p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Grit
                </h1>
                <p className="text-xs text-gray-500 capitalize">{session?.user.role.toLowerCase()} Portal</p>
              </div>
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-all duration-200 hover:scale-105"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Stats - Only when expanded */}
        {!isCollapsed && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-gray-700">Today</span>
              </div>
              <span className="text-blue-600 font-semibold">0 tasks</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-gray-700">Progress</span>
              </div>
              <span className="text-purple-600 font-semibold">0%</span>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar - Only when expanded */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses, assignments..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-2">
          {navItems.map(({ icon: Icon, label, link, color, badge, description }) => {
            const isActive = activeItem === label;
            const displayBadge = badge !== undefined ? badge : 0;

            return (
              <button
                key={label}
                onClick={() => handleNavItemClick(label, link)}
                className={`group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${isActive
                  ? `${getColorClasses(color, true)} shadow-md border transform scale-105`
                  : `${getColorClasses(color)} text-gray-600 hover:shadow-sm hover:scale-105`
                  }`}
                title={isCollapsed ? `${label} - ${description}` : ''}
              >
                <div className={`relative p-2 rounded-lg ${isActive
                  ? 'bg-white shadow-sm'
                  : 'group-hover:bg-white group-hover:shadow-sm'
                  } transition-all duration-200`}>
                  <Icon className="w-4 h-4" />
                  {displayBadge > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1">
                      {displayBadge > 99 ? '99+' : displayBadge}
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{label}</div>
                    <div className="text-xs opacity-75 truncate">{description}</div>
                  </div>
                )}

                {isActive && !isCollapsed && (
                  <div className="w-2 h-2 bg-current rounded-full opacity-60"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-100 p-4 space-y-2">
        {bottomNavItems.map(({ icon: Icon, label, link, color }) => {
          const isActive = activeItem === label;
          return (
            <button
              key={label}
              onClick={() => handleNavItemClick(label, link)}
              className={`group relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${isActive
                ? `${getColorClasses(color, true)} shadow-md border`
                : `${getColorClasses(color)} text-gray-600 hover:shadow-sm`
                }`}
              title={isCollapsed ? label : ''}
            >
              <div className={`p-2 rounded-lg ${isActive
                ? 'bg-white shadow-sm'
                : 'group-hover:bg-white group-hover:shadow-sm'
                } transition-all duration-200`}>
                <Icon className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <span className="font-medium text-sm truncate">{label}</span>
              )}
            </button>
          );
        })}

        {/* User Profile Section */}
        <div className={`mt-4 pt-4 border-t border-gray-100 ${isCollapsed ? 'flex justify-center' : ''}`}>
          {isCollapsed ? (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <User className="w-5 h-5 text-white" />
            </div>
          ) : (
            <div
              onClick={() => signOut()}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all duration-200 cursor-pointer group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                {profile ? (
                  <>
                    <div className="font-medium text-sm text-gray-900 truncate">{profile?.fullName}</div>
                    <div className="text-xs text-gray-500 truncate">{profile?.email}</div>
                  </>
                )
                  : (
                    <>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </>
                  )}
              </div>
              <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors duration-200" />
            </div>
          )}
        </div>
      </div>

      {/* Collapse indicator */}
      {isCollapsed && (
        <div className="absolute top-1/2 -right-3 transform -translate-y-1/2">
          <div className="w-6 h-12 bg-white border border-gray-200 rounded-r-lg shadow-lg flex items-center justify-center">
            <div className="w-1 h-6 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      )}
    </nav>
  );
}