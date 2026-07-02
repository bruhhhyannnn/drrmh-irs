'use client';

import { PageBreadcrumb } from '@/components/common';
import {
  useCampus,
  useCampusEvents,
  useCampusHeadcountPerEvent,
  useDeleteCampus,
} from '@/components/hooks/use-campus';
import { Badge, ConfirmDialog, Dropdown, DropdownItem, Modal, Spinner } from '@/components/ui';
import { useThemeStore } from '@/store';
import { ChevronDown, Inbox, Pencil, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CampusForm } from '../campus-form';

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
  const deleteCampusMutation = useDeleteCampus();

  const [clustersDropdownOpen, setClustersDropdownOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [editId, setEditId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClose = () => {
    setIsModalOpen(false);
    setEditId('');
  };

  const handleEdit = (id: string) => {
    setEditId(id);
    setIsModalOpen(true);
  };

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

  if (loadingCampusEvents)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );

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

        <div className="absolute right-2 top-0 flex items-center gap-2">
          <button
            onClick={() => handleEdit(campus.id)}
            className="hover:text-brand-600 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-all duration-100 hover:bg-transparent hover:border-transparent"
          >
            <Pencil size={24} />
          </button>

          <button
            onClick={() => setDeleteId(campus.id)}
            className="hover:text-error-500 text-gray-400 transition-all duration-100 focus:outline-none hover:bg-transparent hover:border-transparent"
          >
            <Trash2 size={24} />
          </button>
        </div>

        <Modal isOpen={isModalOpen} onClose={handleClose}>
          <CampusForm editId={editId} onSuccess={handleClose} onCancel={handleClose} />
        </Modal>

        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId('')}
          onConfirm={() =>
            deleteCampusMutation.mutate(deleteId, { onSuccess: () => setDeleteId('') })
          }
          title="Delete campus"
          message="This campus will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          isLoading={deleteCampusMutation.isPending}
        />

        {/* Charts */}
        {selectedEvent && (
          <div className="mt-5">
            <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {campus.name} {selectedEvent.name} Demographics
              </h1>
              <div className="mt-2 flex justify-between">
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
                    className="h-6"
                  >
                    {selectedEvent.status.name}
                  </Badge>
                )}
              </div>

              {/* Headcount Pie Charts */}
              <div className="flex flex-wrap flex-1 items-center justify-center mt-4">
                {['completed', 'ongoing'].includes(
                  selectedEvent?.status?.name?.toLowerCase() ?? ''
                ) ? (
                  <>
                    {headcountPerEventData.length > 0 && totalCount > 0 ? (
                      <div>
                        <div className="flex flex-wrap">
                          <div>
                            {/* Clusters Dropdown */}
                            <div>
                              <button
                                onClick={() => setClustersDropdownOpen((p) => !p)}
                                className="dropdown-toggle gap-2 flex items-center text-gray-700 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 shadow-theme-xs h-6 rounded-lg border bg-gray-50 px-4 focus:ring-3 focus:outline-none"
                              >
                                <span className="text-sm font-medium lg:block">Select Cluster</span>
                                <ChevronDown
                                  size={16}
                                  className={`transition-transform duration-200 ${clustersDropdownOpen ? 'rotate-180' : ''}`}
                                />
                              </button>

                              <Dropdown
                                isOpen={clustersDropdownOpen}
                                onClose={() => setClustersDropdownOpen(false)}
                                className="w-60 p-2 left-4"
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
                            </div>

                            {/* Units Dropdown */}
                            <div className="mt-4">
                              <button
                                onClick={() => setUnitsDropdownOpen((p) => !p)}
                                className="dropdown-toggle gap-2 flex items-center text-gray-700 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 shadow-theme-xs h-6 rounded-lg border bg-gray-50 px-4 focus:ring-3 focus:outline-none"
                              >
                                <span className="text-sm font-medium lg:block">Select Unit</span>
                                <ChevronDown
                                  size={16}
                                  className={`transition-transform duration-200 ${unitsDropdownOpen ? 'rotate-180' : ''}`}
                                />
                              </button>

                              <Dropdown
                                isOpen={unitsDropdownOpen}
                                onClose={() => setUnitsDropdownOpen(false)}
                                className="w-60 p-2 left-4"
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
                            </div>
                          </div>
                          <ResponsiveContainer width="50%" height={200}>
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
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 w-full mt-2">
                          {headcountPerEventData.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{
                                  backgroundColor: colors(index, headcountPerEventData.length),
                                }}
                              />
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {entry.name}
                              </span>
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

              {/* Damage Condtion Pie Charts */}
              <div className="flex flex-wrap flex-1 items-center justify-center"></div>
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
