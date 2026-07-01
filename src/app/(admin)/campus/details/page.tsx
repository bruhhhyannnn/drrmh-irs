'use client';

import { PageBreadcrumb } from '@/components/common';
import {
  useCampus,
  useCampusEvents,
  useCampusHeadcountPerEvent,
} from '@/components/hooks/use-campus';
import { Badge, Dropdown, DropdownItem, Spinner } from '@/components/ui';
import { useThemeStore } from '@/store';
import { ChevronDown, Inbox } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface Event {
  id: string;
  name: string;
  status: {
    name: string;
  };
}

export default function CampusDetailsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CampusDetailsContent />
    </Suspense>
  );
}

function CampusDetailsContent() {
  const searchParams = useSearchParams();
  const campusId = searchParams.get('id') ?? undefined;

  const { data: campus, isPending: loadingCampus } = useCampus(campusId);

  const { data: campusEvents = [], isPending: loadingCampusEvents } = useCampusEvents(campusId);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const { data: event } = useCampusHeadcountPerEvent(selectedEvent?.id ?? '', campusId ?? '');
  const headcountPerEventData = [
    {
      name: 'Faculty Members',
      value: event?.reduce((sum, item) => sum + item.facultyMembersCount, 0),
    },
    { name: 'Admin Members', value: event?.reduce((sum, item) => sum + item.adminMembersCount, 0) },
    { name: 'Reps Members', value: event?.reduce((sum, item) => sum + item.repMembersCount, 0) },
    { name: 'RA Members', value: event?.reduce((sum, item) => sum + item.raMembersCount, 0) },
    { name: 'Students', value: event?.reduce((sum, item) => sum + item.studentsCount, 0) },
    {
      name: 'Philcare Staff',
      value: event?.reduce((sum, item) => sum + item.philcareStaffCount, 0),
    },
    {
      name: 'Security Personnel',
      value: event?.reduce((sum, item) => sum + item.securityPersonelCount, 0),
    },
    {
      name: 'Construction Workers',
      value: event?.reduce((sum, item) => sum + item.constructionWorkersCount, 0),
    },
    { name: 'Tenants', value: event?.reduce((sum, item) => sum + item.tenantsCount, 0) },
    {
      name: 'Health Workers',
      value: event?.reduce((sum, item) => sum + item.healthWorkersCount, 0),
    },
    {
      name: 'Non Academic Staff',
      value: event?.reduce((sum, item) => sum + item.nonAcademicStaffCount, 0),
    },
    { name: 'Guests', value: event?.reduce((sum, item) => sum + item.guestsCount, 0) },
  ];
  const totalCount = event?.reduce((sum, item) => sum + item.totalCount, 0) ?? 0;
  const { theme } = useThemeStore();

  const colors = (index: number, total: number) => {
    const hue = (index / total) * 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  useEffect(() => {
    if (!selectedEvent && campusEvents.length > 0) {
      setSelectedEvent(campusEvents[0]);
    }
  }, [campusEvents, selectedEvent]);

  const handleSelect = (event: Event) => {
    setSelectedEvent(event);
    setEventsDropdownOpen(false);
  };

  if (loadingCampus)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );

  if (!campus) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-gray-400">Campus not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Campus Details" />

      <div className="relative">
        <button
          onClick={() => setEventsDropdownOpen((p) => !p)}
          className="dropdown-toggle gap-2 flex items-center text-gray-700 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 shadow-theme-xs h-11 rounded-lg border bg-gray-100 px-4 focus:ring-3 focus:outline-none"
        >
          <span className="text-sm font-medium lg:block">
            {selectedEvent ? selectedEvent.name : 'Select event...'}
          </span>
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${eventsDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <Dropdown
          isOpen={eventsDropdownOpen}
          onClose={() => setEventsDropdownOpen(false)}
          className="w-60 p-2 left-0"
        >
          {campusEvents.map((e) => (
            <DropdownItem key={e.id} onClick={() => handleSelect(e)}>
              <div className="items-start border-b border-gray-100 pb-1 dark:border-gray-800">
                <p className="text-start text-sm font-medium truncate text-gray-900 dark:text-white">
                  {e.name}
                </p>
              </div>
            </DropdownItem>
          ))}
        </Dropdown>

        {selectedEvent && (
          <div className="mt-5">
            <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedEvent.name}
              </h1>
              <div className="mt-2">
                {selectedEvent.status.name && (
                  <Badge
                    color={
                      selectedEvent.status.name === 'ongoing'
                        ? 'success'
                        : selectedEvent.status.name === 'completed'
                          ? 'primary'
                          : 'warning'
                    }
                    size="sm"
                  >
                    {selectedEvent.status.name}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap flex-1 items-center justify-center">
                {['completed', 'ongoing'].includes(
                  selectedEvent?.status?.name?.toLowerCase() ?? ''
                ) ? (
                  <>
                    {headcountPerEventData.length > 0 && totalCount > 0 ? (
                      <div>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={headcountPerEventData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                              cornerRadius={4}
                            >
                              {headcountPerEventData.map((_, index) => (
                                <Cell
                                  key={index}
                                  fill={colors(index, headcountPerEventData.length)}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background:
                                  theme === 'dark'
                                    ? 'rgba(17,24,39,0.95)'
                                    : 'rgba(255,255,255,0.95)',
                                border:
                                  theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb',
                                borderRadius: '8px',
                                color: theme === 'dark' ? '#f9fafb' : '#111827',
                                fontSize: '14px',
                              }}
                              itemStyle={{ color: theme === 'dark' ? '#f9fafb' : '#111827' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-2 w-full mt-2">
                          {headcountPerEventData.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{
                                  backgroundColor: colors(index, headcountPerEventData.length),
                                }}
                              />
                              <span className="text-sm">{entry.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 w-full">
                        <EmptyState message="No headcount data." />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-5 w-full">
                    <EmptyState message={`${selectedEvent?.status?.name} event`} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 dark:border-white/10 dark:bg-white/5">
      <Inbox className="mb-2 text-gray-300 dark:text-gray-600" size={24} />
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
