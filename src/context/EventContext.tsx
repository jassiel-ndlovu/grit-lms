/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface EventContextType {
  events: AppTypes.CourseEvent[];
  currentEvent: AppTypes.CourseEvent | null;
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchEventsByCourse: (courseId: string) => Promise<void | AppTypes.CourseEvent[]>;
  fetchEventById: (eventId: string) => Promise<void | AppTypes.CourseEvent>;
  createEvent: (courseId: string, eventData: Partial<AppTypes.CourseEvent>) => Promise<AppTypes.CourseEvent | void>;
  updateEvent: (eventId: string, updates: Partial<AppTypes.CourseEvent>) => Promise<AppTypes.CourseEvent | void>;
  deleteEvent: (eventId: string) => Promise<void>;
  clearMessage: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) throw new Error("useEvents must be used within an EventProvider");
  return context;
};

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const [events, setEvents] = useState<AppTypes.CourseEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<AppTypes.CourseEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchEventsByCourse = useCallback(async (courseId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/events?courseId=${courseId}`);
      setEvents(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to fetch events", {
          title: "Fetch Error",
          duration: 5000,
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEventById = useCallback(async (eventId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/events/${eventId}`);
      setCurrentEvent(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to fetch event", {
          title: "Fetch Error",
          duration: 5000,
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const createEvent = useCallback(
    async (courseId: string, eventData: Partial<AppTypes.CourseEvent>) => {
      setLoading(true);
      clearMessage();
      try {
        const res = await axios.post(`/api/events`, { ...eventData, courseId });
        setEvents((prev) => [...prev, res.data]);
        setMessage(
          Message.success("Event created successfully", {
            duration: 3000,
          })
        );
        return res.data;
      } catch (err: any) {
        setMessage(
          Message.error(err.response?.data?.message || "Failed to create event", {
            title: "Creation Error",
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [clearMessage]
  );

  const updateEvent = useCallback(
    async (eventId: string, updates: Partial<AppTypes.CourseEvent>) => {
      setLoading(true);
      setUpdating(true);
      clearMessage();
      try {
        const res = await axios.put(`/api/events/${eventId}`, updates);
        setEvents((prev) => prev.map((e) => (e.id === eventId ? res.data : e)));
        setMessage(
          Message.success("Event updated successfully", {
            duration: 3000,
          })
        );
        return res.data;
      } catch (err: any) {
        setMessage(
          Message.error(err.response?.data?.message || "Failed to update event", {
            title: "Update Error",
          })
        );
      } finally {
        setLoading(false);
        setUpdating(false);
      }
    },
    [clearMessage]
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      setLoading(true);
      clearMessage();
      try {
        await axios.delete(`/api/events/${eventId}`);
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setMessage(
          Message.success("Event deleted successfully", {
            duration: 3000,
          })
        );
      } catch (err: any) {
        setMessage(
          Message.error(err.response?.data?.message || "Failed to delete event", {
            title: "Deletion Error",
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [clearMessage]
  );

  return (
    <EventContext.Provider
      value={{
        events,
        currentEvent,
        loading,
        updating,
        message,
        fetchEventsByCourse,
        fetchEventById,
        createEvent,
        updateEvent,
        deleteEvent,
        clearMessage,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};
