/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";
import { useCourses } from "@/context/CourseContext";
import { useSession } from "next-auth/react";
import { $Enums } from "@/generated/prisma";

interface ActivityLogContextType {
  activities: AppTypes.ActivityLog[];
  loading: boolean;
  message: Message | null;
  fetchActivities: (userId: string) => Promise<void>;
  fetchActivitiesByCourseIds: (courseIds: string[]) => Promise<void>;
  fetchAllUserActivities: (userId: string) => Promise<void>;
  logActivity: (activityData: {
    action: $Enums.ActivityType;
    targetId?: string;
    meta?: any;
  }) => Promise<void>;
  clearMessage: () => void;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

export const useActivityLog = () => {
  const ctx = useContext(ActivityLogContext);
  if (!ctx) throw new Error("useActivityLog must be used within an ActivityLogProvider");
  return ctx;
};

export const ActivityLogProvider = ({ children }: { children: ReactNode }) => {
  const { data: session } = useSession();
  const { fetchCoursesByStudentId } = useCourses();
  const [activities, setActivities] = useState<AppTypes.ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => setMessage(null), []);

  // Fetch activities for a specific user
  const fetchActivities = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/activity?userId=${userId}`);
      setActivities(res.data);
    } catch (err: any) {
      setMessage(Message.error("Failed to fetch activity log"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch activities for specific course IDs
  const fetchActivitiesByCourseIds = useCallback(async (courseIds: string[]) => {
    if (courseIds.length === 0) return;
    
    setLoading(true);
    try {
      const queryParams = courseIds.map(id => `courseIds=${id}`).join('&');
      const res = await axios.get(`/api/activity?${queryParams}`);
      setActivities(res.data);
    } catch (err: any) {
      setMessage(Message.error("Failed to fetch course activities"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all activities for a user (both personal and course-related)
  const fetchAllUserActivities = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      // First, get the user's courses
      const userCourses = await fetchCoursesByStudentId(userId) as AppTypes.Course[];
      const courseIds = userCourses.map(course => course.id);
      
      // Fetch both user-specific and course-related activities in one request
      const queryParams = [
        `userId=${userId}`,
        ...courseIds.map(id => `courseIds=${id}`)
      ].join('&');
      
      const res = await axios.get(`/api/activity?${queryParams}`);
      setActivities(res.data);
    } catch (err: any) {
      setMessage(Message.error("Failed to fetch all activities"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchCoursesByStudentId]);

  // Log a new activity
  const logActivity = useCallback(async (activityData: {
    action: string;
    targetId?: string;
    meta?: any;
  }) => {
    if (!session?.user?.id) return;

    try {
      const response = await axios.post('/api/activity', {
        userId: session.user.id,
        ...activityData
      });

      // Add the new activity to the beginning of the list
      setActivities(prev => [response.data, ...prev.slice(0, 49)]); // Keep only latest 50
    } catch (err: any) {
      setMessage(Message.error("Failed to log activity"));
      console.error(err);
    }
  }, [session?.user?.id]);

  // Auto-fetch activities when user logs in
  useEffect(() => {
    if (session?.user?.id) {
      fetchAllUserActivities(session.user.id);
    }
  }, [session?.user?.id, fetchAllUserActivities]);

  return (
    <ActivityLogContext.Provider value={{
      activities,
      loading,
      message,
      fetchActivities,
      fetchActivitiesByCourseIds,
      fetchAllUserActivities,
      logActivity,
      clearMessage
    }}>
      {children}
    </ActivityLogContext.Provider>
  );
};