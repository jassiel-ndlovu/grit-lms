/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "./ProfileContext";

interface NotificationContextType {
  notifications: AppTypes.Notification[];
  loading: boolean;
  message: Message | null;
  fetchNotifications: (studentId: string) => Promise<void>;
  fetchNotificationsByCourseIds: (courseIds: string[]) => Promise<void>;
  fetchAllUserNotifications: (studentId: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (studentId: string) => Promise<void>;
  clearMessage: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { fetchCoursesByStudentId } = useCourses();
  const { profile } = useProfile();
  const [notifications, setNotifications] = useState<AppTypes.Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => setMessage(null), []);

  // Fetch notifications for a specific user
  const fetchNotifications = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/notifications?studentId=${studentId}`);
      setNotifications(res.data);
    } catch (err: any) {
      setMessage(Message.error("Failed to fetch notifications"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch notifications for specific course IDs
  const fetchNotificationsByCourseIds = useCallback(async (courseIds: string[]) => {
    if (courseIds.length === 0) return;
    
    setLoading(true);
    try {
      const queryParams = courseIds.map(id => `courseIds=${id}`).join('&');
      const res = await axios.get(`/api/notifications?${queryParams}`);
      setNotifications(res.data);
    } catch (err: any) {
      setMessage(Message.error("Failed to fetch course notifications"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all notifications for a user (both personal and course-related)
  const fetchAllUserNotifications = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      // First, get the user's courses
      const userCourses = await fetchCoursesByStudentId(studentId) as AppTypes.Course[];
      const courseIds = userCourses.map(course => course.id);
      
      // Fetch both user-specific and course-specific notifications in one request
      const queryParams = [
        `studentId=${studentId}`,
        ...courseIds.map(id => `courseIds=${id}`)
      ].join('&');
      
      const res = await axios.get(`/api/notifications?${queryParams}`);

      setNotifications(res.data);
    } catch (err: any) {
      setMessage(Message.error("Failed to fetch all notifications"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchCoursesByStudentId]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await axios.put(`/api/notifications/${id}`, { isRead: true });
      setNotifications((prev) => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {
      setMessage(Message.error("Failed to update notification"));
    }
  }, []);

  const markAllAsRead = useCallback(async (studentId: string) => {
    try {
      await axios.put('/api/notifications', { studentId });
      setNotifications((prev) => prev.map(n => ({ ...n, isRead: true })));
    } catch {
      setMessage(Message.error("Failed to mark all notifications as read"));
    }
  }, []);

  useEffect(() => {
    if (profile?.id) {
      fetchAllUserNotifications(profile.id);
    }
  }, [profile?.id, fetchAllUserNotifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      loading,
      message,
      fetchNotifications,
      fetchNotificationsByCourseIds,
      fetchAllUserNotifications,
      markAsRead,
      markAllAsRead,
      clearMessage
    }}>
      {children}
    </NotificationContext.Provider>
  );
};