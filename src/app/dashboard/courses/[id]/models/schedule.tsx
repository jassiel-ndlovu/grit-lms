import { $Enums } from "@/generated/prisma";
import { formatDate } from "@/lib/functions";
import { AlertCircle, CalendarX, Download, Play, Users } from "lucide-react";

type ScheduleProps = {
  events: AppTypes.CourseEvent[];
  loading?: false;
}

export default function Schedule({ events, loading = false }: ScheduleProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Course Schedule</h2>
        <button className="px-4 py-2 border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
          <Download className="h-4 w-4 mr-1 inline" />
          Export Calendar
        </button>
      </div>

      <div className="bg-white border border-gray-200">
        <div className="divide-y divide-gray-200">
          {loading ? (
            <ScheduleSkeleton />
          ) : events.length === 0 ? (
            <NoItemsCard />
          ) : (
            events.map(event => (
              <div key={event.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${event.type === $Enums.EventType.LIVE ? 'bg-green-100 text-green-600' :
                      event.type === $Enums.EventType.MEETING ? 'bg-blue-100 text-blue-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                      {event.type === $Enums.EventType.LIVE ? <Play className="h-4 w-4" /> :
                        event.type === $Enums.EventType.MEETING ? <Users className="h-4 w-4" /> :
                          <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{event.title}</h3>
                      <p className="text-sm text-gray-600">{formatDate(new Date(event.date))}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {event.type === $Enums.EventType.LIVE && (
                      <button className="px-3 py-1 bg-green-600 text-white text-sm hover:bg-green-700">
                        Join Session
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- No Items Card ---------------- */
function NoItemsCard() {
  return (
    <div className="p-10 text-center text-gray-600">
      <div className="flex flex-col items-center space-y-3">
        <div className="p-4 bg-gray-100 rounded-full">
          <CalendarX className="h-8 w-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No Events Found</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Your course doesn’t have any scheduled sessions yet. Check back later
          for updates or contact your instructor.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Skeleton Loader ---------------- */
function ScheduleSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-gray-200 rounded-full" />
            <div className="space-y-2">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-8 w-24 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}