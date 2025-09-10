import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, ExternalLink, Users, BookOpen, AlertCircle, Video, FileText, Bell, Filter, Search, MapPin, User, CalendarDays, Grid3X3, List, Timer, GraduationCap, Bookmark, Share2, X } from 'lucide-react';
import { $Enums } from '@/generated/prisma';
import { useProfile } from '@/context/ProfileContext';
import { useEvents } from '@/context/EventContext';
import { useCourses } from '@/context/CourseContext';

type ViewMode = 'month' | 'week' | 'day';

const StudentSchedulePage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<AppTypes.CourseEvent[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedEvent, setSelectedEvent] = useState<AppTypes.CourseEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<$Enums.EventType | 'ALL'>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<AppTypes.CourseEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get contexts
  const { profile } = useProfile();
  const { fetchEventsByCourse } = useEvents();
  const { fetchCoursesByStudentId } = useCourses();

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.id) return;
      
      setIsLoading(true);
      try {
        // Fetch courses for the student
        const studentCourses = await fetchCoursesByStudentId(profile.id) as AppTypes.Course[];
        if (studentCourses) {
          // Fetch events for each course
          const eventsPromises = studentCourses.map(course => 
            fetchEventsByCourse(course.id)
          );
          
          const eventsResults = await Promise.all(eventsPromises);
          const allEvents = eventsResults.flat().filter(Boolean) as AppTypes.CourseEvent[];
          
          // Process events to add reminderSet property if it doesn't exist
          const processedEvents = allEvents.map(event => ({
            ...event,
            date: new Date(event.date) // Ensure date is a Date object
          }));
          
          setEvents(processedEvents);
          
          // Set upcoming events (next 7 days)
          const today = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(today.getDate() + 7);
          
          const upcoming = processedEvents
            .filter(event => event.date >= today && event.date <= nextWeek)
            .sort((a, b) => a.date.getTime() - b.date.getTime());
          
          setUpcomingEvents(upcoming);
        }
      } catch (error) {
        console.error('Error fetching schedule data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [profile?.id, fetchCoursesByStudentId, fetchEventsByCourse]);

  // Filtered events based on search and filter
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           event.course.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === 'ALL' || event.type === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [events, searchQuery, filterType]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    return filteredEvents
      .filter(event => event.date.toDateString() === selectedDate.toDateString())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredEvents, selectedDate]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      dates.push(day);
    }
    return dates;
  };

  const getEventTypeIcon = (type: $Enums.EventType) => {
    switch (type) {
      case $Enums.EventType.LECTURE: return <BookOpen className="w-4 h-4" />;
      case $Enums.EventType.TEST: return <AlertCircle className="w-4 h-4" />;
      case $Enums.EventType.EXAM: return <GraduationCap className="w-4 h-4" />;
      case $Enums.EventType.LIVE: return <Video className="w-4 h-4" />;
      case $Enums.EventType.MEETING: return <Users className="w-4 h-4" />;
      case $Enums.EventType.SUBMISSION: return <FileText className="w-4 h-4" />;
      case $Enums.EventType.REMINDER: return <Bell className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const getEventTypeColor = (type: $Enums.EventType) => {
    switch (type) {
      case $Enums.EventType.LECTURE: return 'bg-blue-500 border-blue-600';
      case $Enums.EventType.TEST: return 'bg-orange-500 border-orange-600';
      case $Enums.EventType.EXAM: return 'bg-red-500 border-red-600';
      case $Enums.EventType.SUBMISSION: return 'bg-purple-500 border-purple-600';
      case $Enums.EventType.LIVE: return 'bg-green-500 border-green-600';
      case $Enums.EventType.MEETING: return 'bg-indigo-500 border-indigo-600';
      case $Enums.EventType.REMINDER: return 'bg-yellow-500 border-yellow-600';
      case $Enums.EventType.HOLIDAY: return 'bg-gray-500 border-gray-600';
      default: return 'bg-gray-400 border-gray-500';
    }
  };

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => 
      event.date.toDateString() === date.toDateString()
    );
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') {
        newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (viewMode === 'week') {
        newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      } else {
        newDate.setDate(prev.getDate() + (direction === 'next' ? 1 : -1));
      }
      return newDate;
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-ZA', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${mins}m`;
  };

  const isEventToday = (event: AppTypes.CourseEvent) => {
    return event.date.toDateString() === new Date().toDateString();
  };

  const isEventPast = (event: AppTypes.CourseEvent) => {
    return event.date < new Date();
  };

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 h-24 border border-gray-100"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = getEventsForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = date.toDateString() === selectedDate.toDateString();

      days.push(
        <div
          key={day}
          className={`p-2 h-24 border border-gray-100 cursor-pointer transition-all ${
            isToday ? 'bg-blue-50 border-blue-200' : 
            isSelected ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50'
          }`}
          onClick={() => setSelectedDate(date)}
        >
          <div className={`text-sm font-medium mb-1 ${
            isToday ? 'text-blue-600' : 
            isSelected ? 'text-indigo-600' : 'text-gray-900'
          }`}>
            {day}
          </div>
          <div className="space-y-1 overflow-hidden">
            {dayEvents.slice(0, 2).map(event => (
              <div
                key={event.id}
                className={`text-xs p-1 rounded text-white ${getEventTypeColor(event.type)} truncate`}
                title={event.title}
              >
                {event.title}
              </div>
            ))}
            {dayEvents.length > 2 && (
              <div className="text-xs text-gray-500 font-medium">
                +{dayEvents.length - 2} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-4 text-center font-semibold text-gray-700 text-sm border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-8 bg-gray-50">
          <div className="p-4 border-r border-gray-200"></div>
          {weekDates.map((date, index) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();
            
            return (
              <div 
                key={index} 
                className={`p-4 text-center cursor-pointer transition-all border-r border-gray-200 last:border-r-0 ${
                  isToday ? 'bg-blue-50 text-blue-600' : 
                  isSelected ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100'
                }`}
                onClick={() => setSelectedDate(date)}
              >
                <div className="text-sm font-semibold">
                  {date.toLocaleDateString('en-ZA', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          <div className="grid grid-cols-8">
            <div className="border-r border-gray-200">
              {hours.map(hour => (
                <div key={hour} className="h-12 p-2 text-xs text-gray-500 border-b border-gray-100">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
              ))}
            </div>
            
            {weekDates.map((date, dateIndex) => (
              <div key={dateIndex} className="border-r border-gray-200 last:border-r-0">
                {hours.map(hour => {
                  const hourEvents = getEventsForDate(date).filter(event => event.date.getHours() === hour);
                  
                  return (
                    <div key={hour} className="h-12 border-b border-gray-100 relative">
                      {hourEvents.map(event => (
                        <div
                          key={event.id}
                          className={`absolute left-1 right-1 top-1 bottom-1 rounded text-xs text-white p-1 cursor-pointer ${getEventTypeColor(event.type)} truncate`}
                          onClick={() => setSelectedEvent(event)}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = getEventsForDate(selectedDate);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedDate.toLocaleDateString('en-ZA', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'} scheduled
            </p>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(event => event.date.getHours() === hour);
            
            return (
              <div key={hour} className="border-b border-gray-100 flex">
                <div className="w-20 p-3 text-xs text-gray-500 bg-gray-50 border-r border-gray-200">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                <div className="flex-1 min-h-[60px] p-2">
                  {hourEvents.map(event => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg mb-2 cursor-pointer transition-all hover:shadow-md ${getEventTypeColor(event.type)} text-white`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getEventTypeIcon(event.type)}
                          <span className="font-medium">{event.title}</span>
                        </div>
                        <span className="text-xs opacity-90">
                          {formatTime(event.date)}
                          {event.duration && ` (${formatDuration(event.duration)})`}
                        </span>
                      </div>
                      <p className="text-xs opacity-90 mt-1">{event.course.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-t-transparent border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Main Content */}
        <div className="flex-1 flex flex-col p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
                <p className="text-gray-600 text-sm mt-1">
                  {viewMode === 'month' && currentDate.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
                  {viewMode === 'week' && `Week of ${getWeekDates(currentDate)[0].toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}`}
                  {viewMode === 'day' && selectedDate.toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                  />
                </div>

                {/* Filter */}
                <div className="relative">
                  <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Filter className="w-4 h-4" />
                    Filter
                  </button>
                  
                  {isFilterOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="p-2">
                        {['ALL', ...Object.values($Enums.EventType)].map(type => (
                          <button
                            key={type}
                            onClick={() => {
                              setFilterType(type as $Enums.EventType | 'ALL');
                              setIsFilterOpen(false);
                            }}
                            className={`w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100 transition-colors ${
                              filterType === type ? 'bg-blue-50 text-blue-600' : ''
                            }`}
                          >
                            {type === 'ALL' ? 'All Events' : type.charAt(0) + type.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateDate('prev')}
                  className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-gray-200 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => {
                    setCurrentDate(new Date());
                    setSelectedDate(new Date());
                  }}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors font-medium"
                >
                  Today
                </button>
                
                <button
                  onClick={() => navigateDate('next')}
                  className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-gray-200 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('month')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm ${
                    viewMode === 'month' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  Month
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm ${
                    viewMode === 'week' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Week
                </button>
                <button
                  onClick={() => setViewMode('day')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm ${
                    viewMode === 'day' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Day
                </button>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          <div className="flex-1">
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'day' && renderDayView()}
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Panel Header */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {selectedDate.toLocaleDateString('en-ZA', { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric' 
              })}
            </h2>
            <p className="text-sm text-gray-600">
              {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'event' : 'events'} scheduled
            </p>
          </div>

          {/* Events List */}
          <div className="flex-1 overflow-y-auto">
            {selectedDateEvents.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No events today</p>
                <p className="text-sm">Your schedule is clear for this day.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {selectedDateEvents.map(event => {
                  const isPast = isEventPast(event);
                  const isToday = isEventToday(event);
                  
                  return (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                        isPast ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getEventTypeColor(event.type)} text-white`}>
                            {getEventTypeIcon(event.type)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{event.title}</h3>
                            <p className="text-sm text-gray-600">{event.course.name}</p>
                          </div>
                        </div>
                        
                        <button
                          className={`p-1 rounded transition-colors text-gray-400 hover:text-gray-600`}
                        >
                          <Bell className={`w-4 h-4`} />
                        </button>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {formatTime(event.date)}
                            {event.duration && ` • ${formatDuration(event.duration)}`}
                          </span>
                        </div>
                        
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{event.course.tutor.fullName}</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 mt-3 line-clamp-2">
                        {event.description}
                      </p>
                      
                      <div className="flex items-center justify-between mt-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isPast ? 'bg-gray-100 text-gray-600' : 
                          isToday ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {isPast ? 'Past' : isToday ? 'Today' : 'Upcoming'}
                        </span>
                        
                        {event.link && (
                          <a
                            href={event.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Join
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Events Section */}
          <div className="border-t border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Upcoming This Week
            </h3>
            
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedDate(event.date);
                      setSelectedEvent(event);
                    }}
                  >
                    <div className={`p-1.5 rounded ${getEventTypeColor(event.type)} text-white`}>
                      {getEventTypeIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {event.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {event.date.toLocaleDateString('en-ZA', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })} • {formatTime(event.date)}
                      </p>
                    </div>
                    <button
                      className={`p-1 transition-colors text-gray-400 hover:text-gray-600`}
                    >
                      <Bell className={`w-3 h-3`} />
                    </button>
                  </div>
                ))}
                
                {upcomingEvents.length > 3 && (
                  <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-2">
                    View all {upcomingEvents.length} upcoming events
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/30 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="relative">
                <div className={`h-32 ${getEventTypeColor(selectedEvent.type)} rounded-t-xl flex items-end p-6`}>
                  <div className="text-white">
                    <div className="flex items-center gap-3 mb-2">
                      {getEventTypeIcon(selectedEvent.type)}
                      <span className="text-sm font-medium opacity-90">
                        {selectedEvent.type.charAt(0) + selectedEvent.type.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold">{selectedEvent.title}</h2>
                    <p className="text-sm opacity-90 mt-1">{selectedEvent.course.name}</p>
                  </div>
                  
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Event Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">Time</span>
                      </div>
                      <p className="text-gray-900">
                        {selectedEvent.date.toLocaleDateString('en-ZA', { 
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                      <p className="text-gray-600">
                        {formatTime(selectedEvent.date)}
                        {selectedEvent.duration && ` (${formatDuration(selectedEvent.duration)})`}
                      </p>
                    </div>

                    {selectedEvent.location && (
                      <div>
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                          <MapPin className="w-4 h-4" />
                          <span className="font-medium">Location</span>
                        </div>
                        <p className="text-gray-900">{selectedEvent.location}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <User className="w-4 h-4" />
                        <span className="font-medium">Instructor</span>
                      </div>
                      <p className="text-gray-900">{selectedEvent.course.tutor.fullName}</p>
                      <p className="text-gray-600 text-sm">{selectedEvent.course.tutor.email}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <BookOpen className="w-4 h-4" />
                        <span className="font-medium">Course</span>
                      </div>
                      <p className="text-gray-900">{selectedEvent.course.name}</p>
                      {selectedEvent.course.description && (
                        <p className="text-gray-600 text-sm">{selectedEvent.course.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{selectedEvent.description}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-4">
                    <button
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-gray-100 text-gray-700 text-sm hover:bg-gray-200`}
                    >
                      <Bell className={`w-4 h-4`} />
                      {'Set Reminder'}
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors">
                      <Bookmark className="w-4 h-4" />
                      Save Event
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors">
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>

                  {selectedEvent.link && (
                    <a
                      href={selectedEvent.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {selectedEvent.type === $Enums.EventType.LIVE || selectedEvent.type === $Enums.EventType.MEETING ? 'Join Meeting' : 
                       selectedEvent.type === $Enums.EventType.TEST || selectedEvent.type === $Enums.EventType.EXAM ? 'Take Test' : 
                       selectedEvent.type === $Enums.EventType.SUBMISSION ? 'Submit Assignment' : 'Open Link'}
                    </a>
                  )}
                </div>

                {/* Event Status */}
                <div className="flex items-center justify-center">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                    isEventPast(selectedEvent) ? 'bg-gray-100 text-gray-600' : 
                    isEventToday(selectedEvent) ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {isEventPast(selectedEvent) ? 'This event has ended' : 
                     isEventToday(selectedEvent) ? 'Happening today' : 'Upcoming event'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentSchedulePage;