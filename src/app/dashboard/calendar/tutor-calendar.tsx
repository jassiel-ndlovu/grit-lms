import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Trash2, X, ChevronLeft, ChevronRight, Users, BookOpen, AlertCircle, Video, Clock, MapPin } from 'lucide-react';
import { $Enums } from '@/generated/prisma';
import { useEvents } from '@/context/EventContext';
import { useCourses } from '@/context/CourseContext';
import { useProfile } from '@/context/ProfileContext';

interface EventFormData {
  title: string;
  description: string;
  type: $Enums.EventType;
  date: string;
  time: string;
  link: string;
  courseId: string;
  location?: string;
  duration?: number;
  useLink: boolean;
  useLocation: boolean;
  useDuration: boolean;
}

const TutorSchedulePage: React.FC = () => {
  const { profile } = useProfile();
  const { courses, fetchCoursesByTutorId, loading: coursesLoading } = useCourses();
  const { 
    events, 
    loading, 
    updating, 
    message,
    fetchEventsByCourse, 
    createEvent, 
    updateEvent, 
    deleteEvent,
    clearMessage 
  } = useEvents();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<AppTypes.CourseEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    type: $Enums.EventType.LECTURE,
    date: '',
    time: '',
    link: '',
    courseId: '',
    location: '',
    duration: 60,
    useLink: false,
    useLocation: false,
    useDuration: false
  });

  // Fetch courses for the tutor
  useEffect(() => {
    if (profile?.id) {
      fetchCoursesByTutorId(profile.id);
    }
  }, [profile?.id, fetchCoursesByTutorId]);

  // Fetch events when selected course changes
  useEffect(() => {
    if (selectedCourse !== 'all') {
      fetchEventsByCourse(selectedCourse);
    }
  }, [selectedCourse, fetchEventsByCourse]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        clearMessage();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, clearMessage]);

  // Validate form function
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Required fields validation
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.courseId) errors.courseId = 'Course selection is required';
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.time) errors.time = 'Time is required';
    
    // URL validation if useLink is enabled
    if (formData.useLink && formData.link) {
      try {
        new URL(formData.link);
      } catch {
        errors.link = 'Please enter a valid URL';
      }
    }
    
    // Duration validation if useDuration is enabled
    if (formData.useDuration && (formData.duration === undefined || formData.duration <= 0)) {
      errors.duration = 'Duration must be a positive number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventTypeIcon = (type: $Enums.EventType) => {
    switch (type) {
      case $Enums.EventType.LECTURE: return <BookOpen className="w-4 h-4" />;
      case $Enums.EventType.TEST: return <AlertCircle className="w-4 h-4" />;
      case $Enums.EventType.LIVE: return <Video className="w-4 h-4" />;
      case $Enums.EventType.MEETING: return <Users className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const getEventTypeColor = (type: $Enums.EventType) => {
    switch (type) {
      case $Enums.EventType.LECTURE: return 'bg-blue-500';
      case $Enums.EventType.TEST: return 'bg-red-500';
      case $Enums.EventType.EXAM: return 'bg-red-600';
      case $Enums.EventType.SUBMISSION: return 'bg-orange-500';
      case $Enums.EventType.LIVE: return 'bg-green-500';
      case $Enums.EventType.MEETING: return 'bg-purple-500';
      case $Enums.EventType.REMINDER: return 'bg-yellow-500';
      case $Enums.EventType.HOLIDAY: return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getTodaysEvents = useCallback(() => {
    const today = new Date();
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === today.toDateString();
    });
  }, [events]);

  const openModal = (event?: AppTypes.CourseEvent, date?: Date) => {
    setFormErrors({});
    
    if (event) {
      setIsEditMode(true);
      setSelectedEvent(event);
      const eventDate = new Date(event.date);
      setFormData({
        title: event.title,
        description: event.description || '',
        type: event.type,
        date: eventDate.toISOString().split('T')[0],
        time: eventDate.toTimeString().slice(0, 5),
        link: event.link || '',
        courseId: event.courseId,
        location: event.location || '',
        duration: event.duration || 60,
        useLink: !!event.link,
        useLocation: !!event.location,
        useDuration: !!event.duration
      });
    } else {
      setIsEditMode(false);
      setSelectedEvent(null);
      const defaultDate = date || new Date();
      setFormData({
        title: '',
        description: '',
        type: $Enums.EventType.LECTURE,
        date: defaultDate.toISOString().split('T')[0],
        time: '09:00',
        link: '',
        courseId: selectedCourse !== 'all' ? selectedCourse : courses[0]?.id || '',
        location: '',
        duration: 60,
        useLink: false,
        useLocation: false,
        useDuration: false
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setIsEditMode(false);
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      const eventDateTime = new Date(`${formData.date}T${formData.time}`);
      
      // Prepare event data with optional fields only if they're enabled
      const eventData: Partial<AppTypes.CourseEvent> = {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        type: formData.type,
        date: eventDateTime,
        courseId: formData.courseId,
        link: formData.useLink ? formData.link.trim() || null : null,
        location: formData.useLocation ? (formData.location as string).trim() || null : null,
        duration: formData.useDuration ? formData.duration : null
      };

      if (isEditMode && selectedEvent) {
        await updateEvent(selectedEvent.id, eventData);
      } else {
        await createEvent(formData.courseId, eventData);
      }
      
      closeModal();
    } catch (error) {
      console.error('Error saving event:', error);
      setFormErrors({ submit: 'Failed to save event. Please try again.' });
    }
  };

  const handleDelete = async () => {
    if (selectedEvent && window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteEvent(selectedEvent.id);
        closeModal();
      } catch (error) {
        console.error('Error deleting event:', error);
        setFormErrors({ submit: 'Failed to delete event. Please try again.' });
      }
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 h-32"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = getEventsForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();

      days.push(
        <div
          key={day}
          className={`p-2 h-32 border border-gray-200 cursor-pointer ${
            isToday ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
          }`}
          onClick={() => openModal(undefined, date)}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
            {day}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-24">
            {dayEvents.map(event => (
              <div
                key={event.id}
                className={`text-xs p-1 rounded text-white ${getEventTypeColor(event.type)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(event);
                }}
              >
                <div className="flex items-center gap-1">
                  {getEventTypeIcon(event.type)}
                  <span className="truncate">{event.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return days;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <div className="lg:col-span-3">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Management</h1>
            <p className="text-gray-600">Manage your course events and schedule</p>
          </div>

          {/* Message Alert */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {message.content}
            </div>
          )}

          {/* Controls */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <h2 className="text-xl font-semibold text-gray-900">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={coursesLoading}
                >
                  <option value="all">All Courses</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => openModal()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={coursesLoading || courses.length === 0}
                >
                  <Plus className="w-4 h-4" />
                  Add Event
                </button>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-lg shadow-sm">
            {/* Week headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-4 text-center font-medium text-gray-700 bg-gray-50">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {renderCalendarDays()}
            </div>
          </div>
        </div>

        {/* Sidebar with today's events */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Today&apos;s Events</h2>
            
            {getTodaysEvents().length === 0 ? (
              <p className="text-gray-500 text-sm">No events scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {getTodaysEvents().map(event => {
                  const eventDate = new Date(event.date);
                  return (
                    <div 
                      key={event.id} 
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => openModal(event)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{event.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs ${getEventTypeColor(event.type)} text-white`}>
                          {event.type}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatTime(eventDate)}
                        {event.duration && ` • ${event.duration} min`}
                      </div>
                      {event.location && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1" />
                          {event.location}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditMode ? 'Edit Event' : 'Create Event'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Required Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.courseId}
                  onChange={(e) => setFormData(prev => ({ ...prev, courseId: e.target.value }))}
                  className={`w-full p-3 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.courseId ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
                {formErrors.courseId && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.courseId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={`w-full p-3 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Event title"
                  required
                />
                {formErrors.title && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Event description (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as $Enums.EventType }))}
                  className="w-full p-3 border border-gray-300 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {Object.values($Enums.EventType).map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className={`w-full p-3 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.date ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {formErrors.date && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.date}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className={`w-full p-3 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.time ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {formErrors.time && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.time}</p>
                  )}
                </div>
              </div>

              {/* Optional Fields with Toggles */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Optional Fields</h4>
                
                {/* Duration Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-gray-700">Include Duration</label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      useDuration: !prev.useDuration,
                      duration: !prev.useDuration ? 60 : undefined
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      formData.useDuration ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      formData.useDuration ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {formData.useDuration && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.duration || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        duration: parseInt(e.target.value) || undefined 
                      }))}
                      className={`w-full p-3 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.duration ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min="1"
                      placeholder="60"
                    />
                    {formErrors.duration && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.duration}</p>
                    )}
                  </div>
                )}

                {/* Location Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-gray-700">Include Location</label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      useLocation: !prev.useLocation,
                      location: !prev.useLocation ? '' : undefined
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      formData.useLocation ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      formData.useLocation ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {formData.useLocation && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full p-3 border border-gray-300 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Event location"
                    />
                  </div>
                )}

                {/* Link Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-gray-700">Include Link</label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      useLink: !prev.useLink,
                      link: !prev.useLink ? '' : ""
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      formData.useLink ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      formData.useLink ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {formData.useLink && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Link URL
                    </label>
                    <input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                      className={`w-full p-3 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.link ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="https://example.com"
                    />
                    {formErrors.link && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.link}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Error */}
              {formErrors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{formErrors.submit}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading || updating}
                  className="flex-1 bg-blue-600 text-white text-sm py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updating ? 'Saving...' : (isEditMode ? 'Update Event' : 'Create Event')}
                </button>

                {isEditMode && selectedEvent && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-3 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorSchedulePage;