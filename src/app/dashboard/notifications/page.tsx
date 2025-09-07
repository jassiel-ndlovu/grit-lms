"use client";

import { useActivityLog } from "@/context/ActivityLogContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useProfile } from "@/context/ProfileContext";
import { $Enums } from "@/generated/prisma";
import { formatDate } from "@/lib/functions";
import { Bell, Check, CheckCheck, Activity, BookOpen, FileText, GraduationCap, MessageSquare, Upload, Settings, Search, Eye, EyeOff, Clock, CheckCircle, LogIn, LogOut, Award, Send } from "lucide-react";
import { useEffect, useState } from "react";

export default function NotificationsPage() {
  const { 
    notifications, 
    loading: notificationsLoading, 
    fetchAllUserNotifications, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();
  
  const { 
    activities, 
    loading: activitiesLoading, 
    fetchAllUserActivities 
  } = useActivityLog();
  
  const { profile, session } = useProfile();

  const [activeTab, setActiveTab] = useState<'notifications' | 'activity'>('notifications');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    if (profile?.id && session?.user?.id) {
      fetchAllUserNotifications(profile.id);
      fetchAllUserActivities(session.user.id);
    }
  }, [profile?.id, session?.user?.id, fetchAllUserNotifications, fetchAllUserActivities]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case $Enums.NotificationType.COURSE_UPDATE:
        return <BookOpen className="w-5 h-5" />;
      case $Enums.NotificationType.LESSON_CREATED:
        return <FileText className="w-5 h-5" />;
      case $Enums.NotificationType.TEST_CREATED:
      case $Enums.NotificationType.TEST_DUE:
      case $Enums.NotificationType.TEST_GRADED:
        return <GraduationCap className="w-5 h-5" />;
      case $Enums.NotificationType.SUBMISSION_CREATED:
      case $Enums.NotificationType.SUBMISSION_DUE:
      case $Enums.NotificationType.SUBMISSION_GRADED:
        return <Upload className="w-5 h-5" />;
      case $Enums.NotificationType.MESSAGE:
        return <MessageSquare className="w-5 h-5" />;
      case $Enums.NotificationType.SYSTEM:
        return <Settings className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === $Enums.NotificationPriority.URGENT) {
      return "bg-red-50 border-red-200 text-red-700";
    }
    if (priority === $Enums.NotificationPriority.HIGH) {
      return "bg-orange-50 border-orange-200 text-orange-700";
    }
    
    switch (type) {
      case $Enums.NotificationType.COURSE_UPDATE:
        return "bg-blue-50 border-blue-200 text-blue-700";
      case $Enums.NotificationType.TEST_GRADED:
      case $Enums.NotificationType.SUBMISSION_GRADED:
        return "bg-green-50 border-green-200 text-green-700";
      case $Enums.NotificationType.TEST_DUE:
      case $Enums.NotificationType.SUBMISSION_DUE:
        return "bg-amber-50 border-amber-200 text-amber-700";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700";
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case $Enums.ActivityType.LESSON_COMPLETED:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case $Enums.ActivityType.TEST_COMPLETED:
        return <GraduationCap className="w-5 h-5 text-blue-600" />;
      case $Enums.ActivityType.ASSIGNMENT_SUBMITTED:
        return <Upload className="w-5 h-5 text-purple-600" />;
      case $Enums.ActivityType.GRADE_RECEIVED:
        return <Award className="w-5 h-5 text-yellow-600" />;
      case $Enums.ActivityType.MESSAGE_SENT:
        return <Send className="w-5 h-5 text-blue-600" />;
      case $Enums.ActivityType.MESSAGE_RECEIVED:
        return <MessageSquare className="w-5 h-5 text-green-600" />;
      case $Enums.ActivityType.LOGIN:
        return <LogIn className="w-5 h-5 text-slate-600" />;
      case $Enums.ActivityType.LOGOUT:
        return <LogOut className="w-5 h-5 text-slate-600" />;
      default:
        return <Activity className="w-5 h-5 text-slate-600" />;
    }
  };

  const getActivityDescription = (activity: AppTypes.ActivityLog) => {
    switch (activity.action) {
      case $Enums.ActivityType.LESSON_COMPLETED:
        return "Completed a lesson";
      case $Enums.ActivityType.TEST_COMPLETED:
        return "Completed a test";
      case $Enums.ActivityType.ASSIGNMENT_SUBMITTED:
        return "Submitted an assignment";
      case $Enums.ActivityType.GRADE_RECEIVED:
        return "Received a grade";
      case $Enums.ActivityType.MESSAGE_SENT:
        return "Sent a message";
      case $Enums.ActivityType.MESSAGE_RECEIVED:
        return "Received a message";
      case $Enums.ActivityType.LOGIN:
        return "Signed in";
      case $Enums.ActivityType.LOGOUT:
        return "Signed out";
      default:
        return activity.action;
    }
  };

  const filteredNotifications = notifications
    .filter(notification => {
      if (showUnreadOnly && notification.isRead) return false;
      if (filterType !== 'all' && notification.type !== filterType) return false;
      if (searchTerm && !notification.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !notification.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredActivities = activities
    .filter(activity => {
      if (searchTerm && !getActivityDescription(activity).toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllAsRead = async () => {
    if (profile?.id) {
      await markAllAsRead(profile.id);
    }
  };

  if (notificationsLoading || activitiesLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="bg-white rounded-2xl p-8">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Notifications & Activity</h1>
              <p className="text-sm text-slate-600">
                Stay updated with your latest notifications and recent activity
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors duration-200"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
              
              <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-slate-200">
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
                    activeTab === 'notifications'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  Notifications
                  {unreadCount > 0 && (
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      activeTab === 'notifications' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
                    activeTab === 'activity'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  Activity
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-3xl border border-slate-200/60 p-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search notifications or activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
              </div>

              {/* Notification Type Filter */}
              {activeTab === 'notifications' && (
                <>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-slate-300 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="all">All Types</option>
                    <option value={$Enums.NotificationType.COURSE_UPDATE}>Course Updates</option>
                    <option value={$Enums.NotificationType.LESSON_CREATED}>New Lessons</option>
                    <option value={$Enums.NotificationType.TEST_CREATED}>New Tests</option>
                    <option value={$Enums.NotificationType.TEST_DUE}>Test Due</option>
                    <option value={$Enums.NotificationType.TEST_GRADED}>Test Graded</option>
                    <option value={$Enums.NotificationType.SUBMISSION_CREATED}>New Submissions</option>
                    <option value={$Enums.NotificationType.SUBMISSION_DUE}>Submission Due</option>
                    <option value={$Enums.NotificationType.SUBMISSION_GRADED}>Submission Graded</option>
                    <option value={$Enums.NotificationType.MESSAGE}>Messages</option>
                    <option value={$Enums.NotificationType.SYSTEM}>System</option>
                  </select>

                  {/* Unread Only Toggle */}
                  <button
                    onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-medium transition-all duration-200 ${
                      showUnreadOnly
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {showUnreadOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    Unread Only
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-3xl border border-slate-200/60 overflow-hidden">
          {activeTab === 'notifications' ? (
            <div>
              {/* Notifications Header */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-xl">
                      <Bell className="w-5 h-5 text-blue-600" />
                    </div>
                    Notifications
                    {filteredNotifications.length > 0 && (
                      <span className="text-slate-500 font-normal">({filteredNotifications.length})</span>
                    )}
                  </h2>
                </div>
              </div>

              {/* Notifications List */}
              <div className="divide-y divide-slate-100">
                {filteredNotifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No notifications found</h3>
                    <p className="text-slate-500 text-sm">
                      {showUnreadOnly 
                        ? "You have no unread notifications" 
                        : searchTerm 
                        ? "No notifications match your search" 
                        : "You're all caught up!"}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-6 hover:bg-slate-50/50 transition-colors duration-200 ${
                        !notification.isRead ? 'bg-blue-50/30 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl border ${getNotificationColor(notification.type, notification.priority)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div>
                              <h3 className="font-semibold text-slate-900 mb-1">{notification.title}</h3>
                              <p className="text-slate-600 text-sm leading-relaxed">{notification.message}</p>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {notification.priority === $Enums.NotificationPriority.URGENT && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                  Urgent
                                </span>
                              )}
                              {notification.priority === $Enums.NotificationPriority.HIGH && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                  High
                                </span>
                              )}
                              {!notification.isRead && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors duration-200"
                                  title="Mark as read"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(notification.createdAt)}
                            </div>
                            {notification.readAt && (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                Read {formatDate(notification.readAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Activity Header */}
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-xl">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  Recent Activity
                  {filteredActivities.length > 0 && (
                    <span className="text-slate-500 font-normal">({filteredActivities.length})</span>
                  )}
                </h2>
              </div>

              {/* Activity List */}
              <div className="divide-y divide-slate-100">
                {filteredActivities.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Activity className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No recent activity</h3>
                    <p className="text-slate-500">Your activity will appear here as you use the platform</p>
                  </div>
                ) : (
                  filteredActivities.map((activity) => (
                    <div key={activity.id} className="p-6 hover:bg-slate-50/50 transition-colors duration-200">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          {getActivityIcon(activity.action)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900 mb-1">
                                {getActivityDescription(activity)}
                              </p>
                              {activity.meta && (
                                <p className="text-sm text-slate-500">
                                  {typeof activity.meta === 'object' ? JSON.stringify(activity.meta) : activity.meta}
                                </p>
                              )}
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(activity.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}