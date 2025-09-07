'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, User, Settings, Search, Moon, Sun, Menu, X, MessageSquare, HelpCircle, Bookmark, Clock, Zap, BookOpen, FileText, Award } from 'lucide-react';
import { useProfile } from '@/context/ProfileContext';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Skeleton from '../components/skeleton';
import { signOut } from 'next-auth/react';
import { useNotifications } from '@/context/NotificationsContext';

export default function ModernStudentHeader() {
  const { profile, session } = useProfile();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get unread notifications count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Get page title based on current path
  const getPageTitle = () => {
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length <= 1) return 'Dashboard';
    
    const pageMap: { [key: string]: string } = {
      'courses': 'My Courses',
      'calendar': 'Schedule',
      'submissions': 'Submissions',
      'tests': 'Tests & Quizzes',
      'grades': 'Grades',
      'groups': 'Study Groups',
      'notifications': 'Notifications',
      'profile': 'Profile',
      'settings': 'Settings',
      'help': 'Help & Support',
      'manage-courses': 'Manage Courses',
      'tutor-tests': 'Tests & Grading'
    };
    
    return pageMap[pathSegments[1]] || pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getNotificationIcon = (type: string) => {
    const typeMap: { [key: string]: React.ReactNode } = {
      'COURSE_UPDATE': <BookOpen className="w-4 h-4 text-blue-600" />,
      'LESSON_CREATED': <BookOpen className="w-4 h-4 text-green-600" />,
      'TEST_CREATED': <FileText className="w-4 h-4 text-red-600" />,
      'TEST_DELETED': <FileText className="w-4 h-4 text-gray-600" />,
      'TEST_UPDATED': <FileText className="w-4 h-4 text-orange-600" />,
      'QUIZ_CREATED': <FileText className="w-4 h-4 text-purple-600" />,
      'SUBMISSION_CREATED': <Bookmark className="w-4 h-4 text-blue-600" />,
      'SUBMISSION_DUE': <Clock className="w-4 h-4 text-yellow-600" />,
      'SUBMISSION_UPDATED': <Bookmark className="w-4 h-4 text-green-600" />,
      'SUBMISSION_DELETED': <Bookmark className="w-4 h-4 text-red-600" />,
      'SUBMISSION_GRADED': <Award className="w-4 h-4 text-green-600" />,
      'TEST_DUE': <Clock className="w-4 h-4 text-red-600" />,
      'TEST_GRADED': <Award className="w-4 h-4 text-purple-600" />,
      'MESSAGE': <MessageSquare className="w-4 h-4 text-indigo-600" />,
      'SYSTEM': <Zap className="w-4 h-4 text-yellow-600" />
    };
    
    return typeMap[type] || <Bell className="w-4 h-4 text-gray-600" />;
  };

  const formatNotificationTime = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return created.toLocaleDateString();
  };

  const handleNotificationClick = (notification: AppTypes.Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
    }
    setNotificationsOpen(false);
  };

  const handleViewAllNotifications = () => {
    router.push('/dashboard/notifications');
    setNotificationsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    if (session?.user?.id) {
      await markAllAsRead(session.user.id);
    }
  };

  return (
    <header className="w-full bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">

        {/* Left Section - Page Title & Breadcrumb */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:block">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
              <div className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                {session?.user.role}
              </div>
            </div>
            {profile ? <p className="text-sm text-gray-600">
              {getGreeting()}, {profile.fullName?.split(' ')[0]}!
            </p> :
              <Skeleton className="w-30 h-8 rounded" />
            }
          </div>

          {/* Mobile menu button */}
          <button className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Center Section - Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className={`relative w-full transition-all duration-300 ${searchFocused ? 'transform scale-105' : ''
            }`}>
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className={`w-4 h-4 transition-colors ${searchFocused ? 'text-blue-500' : 'text-gray-400'
                }`} />
            </div>
            <input
              type="text"
              placeholder="Search courses, assignments, or resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm ${searchFocused ? 'bg-white border-blue-200 shadow-lg' : 'border-gray-200 hover:bg-white'
                }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Right Section - Actions & Profile */}
        <div className="flex items-center gap-3">

          {/* Quick Actions */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:scale-105"
              title="Toggle dark mode"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-yellow-600" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {/* Help */}
            <button
              onClick={() => router.push('/dashboard/help')}
              className="p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:scale-105"
              title="Help & Support"
            >
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Notifications */}
          <div ref={notificationRef} className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:scale-105 group"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 shadow-xl rounded-2xl z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        {unreadCount} new
                      </span>
                    </div>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-blue-50/50' : ''
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-400">
                                {formatNotificationTime(new Date(notification.createdAt).toLocaleDateString())}
                              </span>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 border-t border-gray-100 bg-gray-50">
                  <button 
                    onClick={handleViewAllNotifications}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div ref={menuRef} className="relative">
            <ModernHeaderUserProfile
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              profile={profile as AppTypes.Student}
            />

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 shadow-xl rounded-2xl z-50 overflow-hidden">
                {/* Profile Header */}
                <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      {profile && session ? (
                        <>
                          <h4 className="font-semibold">{profile.fullName}</h4>
                          <p className="text-sm text-blue-100">{profile.email}</p>
                          <span className="inline-block px-2 py-1 bg-white/20 text-xs rounded-full mt-1">
                            {session.user.role}
                          </span>
                        </>
                      ) : (
                        <>
                          <Skeleton className="w-24 h-4 bg-white/30 mb-2" />
                          <Skeleton className="w-32 h-3 bg-white/30 mb-1" />
                          <Skeleton className="w-16 h-3 bg-white/30" />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <MenuItem
                    icon={<User className="w-4 h-4" />}
                    label="View Profile"
                    description="Manage your account settings"
                    onClick={() => {
                      router.push('/dashboard/account');
                      setMenuOpen(false);
                    }}
                  />
                  <MenuItem
                    icon={<Settings className="w-4 h-4" />}
                    label="Settings"
                    description="Customize your experience"
                    onClick={() => {
                      router.push('/dashboard/settings');
                      setMenuOpen(false);
                    }}
                  />
                  {/* <MenuItem
                    icon={<MessageSquare className="w-4 h-4" />}
                    label="Support"
                    description="Get help and contact us"
                    onClick={() => {
                      router.push('/dashboard/help');
                      setMenuOpen(false);
                    }}
                  /> */}

                  <div className="border-t border-gray-100 my-2"></div>

                  <MenuItem
                    icon={<LogOut className="w-4 h-4" />}
                    label="Sign Out"
                    description="Sign out of your account"
                    onClick={() => signOut()}
                    className="text-red-600 hover:bg-red-50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

type ModernHeaderUserProfileProps = {
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  profile: AppTypes.Student;
}

function ModernHeaderUserProfile({ menuOpen, setMenuOpen, profile }: ModernHeaderUserProfileProps) {
  if (!profile) {
    return (
      <div className="w-10 h-10 bg-gray-200 rounded-xl animate-pulse"></div>
    );
  }

  return (
    <button
      onClick={() => setMenuOpen(!menuOpen)}
      className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-200 hover:shadow-md hover:scale-105 ${menuOpen
        ? 'bg-blue-50 border-blue-200 shadow-md'
        : 'bg-white border-gray-200 hover:bg-gray-50'
        }`}
    >
      <div className="relative">
        {profile.imageUrl ? (
          <div className="w-8 h-8 rounded-xl overflow-hidden">
            <img src={profile.imageUrl} alt="Profile" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold rounded-xl flex items-center justify-center text-white shadow-md">
            {profile.fullName?.charAt(0).toUpperCase() ?? 'U'}
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
      </div>

      <div className="hidden sm:flex items-center gap-2">
        <span className="text-sm font-medium text-gray-800 max-w-24 truncate">
          {profile.fullName?.split(' ')[0]}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''
          }`} />
      </div>
    </button>
  );
}

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

function MenuItem({ icon, label, description, href, onClick, className = '' }: MenuItemProps) {
  const baseClasses = "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left";
  const classes = `${baseClasses} ${className}`;

  const content = (
    <>
      <div className="p-2 rounded-lg bg-gray-100">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={classes}>
      {content}
    </button>
  );
}