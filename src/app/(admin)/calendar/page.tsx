'use client';

import { PageBreadcrumb } from '@/components/common';
import { useEvents } from '@/components/hooks/use-events';
import { Badge } from '@/components/ui';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: allEvents = [] } = useEvents();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const events = allEvents.filter(
    (e) =>
      e.started_at && isWithinInterval(new Date(e.started_at), { start: monthStart, end: monthEnd })
  );

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const paddingDays = Array(monthStart.getDay()).fill(null);

  const getEventsForDay = (day: Date) =>
    events.filter((e) => e.started_at && isSameDay(new Date(e.started_at), day));

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Calendar" />

      {/* Events this month */}
      {events.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Events this month ({events.length})
          </h3>
          <div className="space-y-2">
            {events.map((event) => (
              <Link key={event.id} href={`/events/details?id=${event.id}`}>
                <div
                  key={event.id}
                  className="flex items-center justify-between mt-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-white/5 dark:bg-white/3 transition-all hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {event.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.started_at ? format(new Date(event.started_at), 'MMM d, h:mm a') : '—'}
                    </p>
                  </div>
                  <Badge
                    color={
                      event.status.name === 'ongoing'
                        ? 'success'
                        : event.status.name === 'completed'
                          ? 'primary'
                          : 'warning'
                    }
                    size="sm"
                  >
                    {event.status.name}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="shadow-theme-sm rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
        {/* Calendar header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-white/5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-white/5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {paddingDays.map((_, i) => (
            <div
              key={`pad-${i}`}
              className="min-h-25 border-r border-b border-gray-100 dark:border-white/3"
            />
          ))}

          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={day.toISOString()}
                className="min-h-25 border-r border-b border-gray-100 p-2 dark:border-white/3"
              >
                <div className="mb-1">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                      isToday
                        ? 'bg-brand-500 text-white'
                        : isCurrentMonth
                          ? 'text-gray-800 dark:text-white'
                          : 'text-gray-300 dark:text-gray-600'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 truncate rounded px-1.5 py-0.5 text-xs font-medium"
                    >
                      {event.name}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p className="text-xs text-gray-400">+{dayEvents.length - 2} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
