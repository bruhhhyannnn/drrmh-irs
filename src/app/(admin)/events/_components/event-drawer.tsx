'use client';

import {
  Drawer,
  FOCUS_RING,
  SegmentedControl,
  SelectField,
  TextArea,
  TextInput,
} from '@/components/ds';
import { useCampuses } from '@/components/hooks/use-campus';
import { useCreateEvents, useEvent, useUpdateEvent } from '@/components/hooks/use-events';
import { useEventStatuses } from '@/components/hooks/use-settings';
import { cn, eventSchema, type EventFormData } from '@/lib';
import { useAuthStore } from '@/store';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Prisma } from '@prisma/client';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import { CheckBox } from '../../_components/confirm-dialog';
import {
  DrawerBody,
  DrawerButton,
  DrawerButtons,
  FormField,
  FormGrid,
} from '../../_components/drawer-parts';
import { Skeleton } from '../../_components/ui';
import { capitalize, eventStatusKey } from '../../_lib/status';

const STATUS_ORDER = ['upcoming', 'ongoing', 'completed'];

/** `yyyy-MM-ddTHH:mm` in local time, for a datetime-local input. */
function toLocalInput(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

type Mode = { kind: 'add'; defaultCampusId?: string } | { kind: 'edit'; eventId: string };

/**
 * Add event / Edit event. Add can tick several campuses and creates the same event once per
 * campus; Edit keeps one campus, since each event has its own reports.
 */
export function EventDrawer({
  open,
  onClose,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
}) {
  const isEdit = mode.kind === 'edit';
  const { data: event, isPending } = useEvent(isEdit ? mode.eventId : undefined);
  const createEvents = useCreateEvents();
  const updateEvent = useUpdateEvent();
  // How many campuses are ticked, for "Create 3 events".
  const [campusCount, setCampusCount] = useState(1);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title={isEdit ? 'Edit event' : 'Add event'}
      footer={
        <DrawerButtons>
          <DrawerButton variant="outline" onClick={onClose}>
            Cancel
          </DrawerButton>
          <DrawerButton
            type="submit"
            form="event-form"
            loading={createEvents.isPending || updateEvent.isPending}
          >
            {isEdit
              ? 'Update event'
              : campusCount > 1
                ? `Create ${campusCount} events`
                : 'Create event'}
          </DrawerButton>
        </DrawerButtons>
      }
    >
      {isEdit && (isPending || !event) ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <EventForm
          event={isEdit ? (event ?? null) : null}
          defaultCampusId={mode.kind === 'add' ? mode.defaultCampusId : undefined}
          createEvents={createEvents}
          updateEvent={updateEvent}
          onCampusCount={setCampusCount}
          onDone={onClose}
        />
      )}
    </Drawer>
  );
}

type EventRow = NonNullable<ReturnType<typeof useEvent>['data']>;

function EventForm({
  event,
  defaultCampusId,
  createEvents,
  updateEvent,
  onCampusCount,
  onDone,
}: {
  event: EventRow | null;
  defaultCampusId?: string;
  createEvents: ReturnType<typeof useCreateEvents>;
  updateEvent: ReturnType<typeof useUpdateEvent>;
  onCampusCount: (count: number) => void;
  onDone: () => void;
}) {
  const { userProfile } = useAuthStore();
  const isSuperAdmin = userProfile?.user_type?.name === 'Super Admin';
  const { data: campuses = [] } = useCampuses();
  const { data: statuses = [] } = useEventStatuses();

  const statusOptions = statuses
    .filter((s) => s.is_active)
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(eventStatusKey(a.name)) - STATUS_ORDER.indexOf(eventStatusKey(b.name))
    )
    .map((s) => ({ value: s.id, label: capitalize(s.name) }));
  const upcomingId = statuses.find((s) => eventStatusKey(s.name) === 'upcoming')?.id ?? '';
  const completedId = statuses.find((s) => eventStatusKey(s.name) === 'completed')?.id;
  const activeCampuses = campuses.filter((c) => c.is_active || c.id === event?.campus_id);

  // Administrators create events for their own campus only.
  const fixedCampusId = !isSuperAdmin ? (userProfile?.campus_id ?? '') : '';
  const initialCampuses = event
    ? [event.campus_id]
    : fixedCampusId
      ? [fixedCampusId]
      : defaultCampusId
        ? [defaultCampusId]
        : [];

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: event?.name ?? '',
      quarter: event?.quarter ?? '',
      description: event?.description ?? '',
      campus_ids: initialCampuses,
      status_id: event?.status_id ?? upcomingId,
      started_at: toLocalInput(event?.started_at),
      ended_at: toLocalInput(event?.ended_at),
    },
  });

  const name = useWatch({ control, name: 'name' });
  const picked = useWatch({ control, name: 'campus_ids' }) ?? [];
  const statusId = useWatch({ control, name: 'status_id' });

  useEffect(() => onCampusCount(Math.max(1, picked.length)), [picked.length, onCampusCount]);

  // New events start as Upcoming once the statuses have loaded.
  useEffect(() => {
    if (!getValues('status_id') && upcomingId) setValue('status_id', upcomingId);
  }, [upcomingId, getValues, setValue]);

  const onSubmit = handleSubmit(async (data) => {
    const startedAt = data.started_at ? new Date(data.started_at) : null;
    const endedAt = data.ended_at ? new Date(data.ended_at) : null;
    const completing = data.status_id === completedId;
    try {
      if (event) {
        const wasCompleted = event.status_id === completedId;
        const update: Prisma.EventUpdateInput = {
          name: data.name.trim(),
          description: data.description || null,
          quarter: data.quarter || null,
          campus: { connect: { id: data.campus_ids[0] } },
          started_at: startedAt,
          ended_at: completing && !wasCompleted && !endedAt ? new Date() : endedAt,
          status: { connect: { id: data.status_id } },
          // Who completed it is kept while it stays completed, set when it becomes completed,
          // and cleared when it is reopened.
          ...(completing && !wasCompleted && userProfile?.id
            ? { completer: { connect: { id: userProfile.id } } }
            : !completing && wasCompleted
              ? { completer: { disconnect: true } }
              : {}),
        };
        await updateEvent.mutateAsync({ id: event.id, data: update });
        toast.success('Event updated');
      } else {
        const created = await createEvents.mutateAsync({
          campusIds: data.campus_ids,
          data: {
            name: data.name.trim(),
            description: data.description || null,
            quarter: data.quarter || null,
            started_at: startedAt,
            ended_at: completing && !endedAt ? new Date() : endedAt,
            status_id: data.status_id,
            user_id: userProfile?.id ?? null,
            completed_by: completing ? (userProfile?.id ?? null) : null,
          },
        });
        toast.success(created.length > 1 ? `${created.length} events created` : 'Event created');
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The event could not be saved.');
    }
  });

  const campusName = (id: string) => campuses.find((c) => c.id === id)?.name ?? 'this campus';
  const shownName = name?.trim() || 'this event';

  return (
    <form id="event-form" onSubmit={onSubmit} noValidate>
      <DrawerBody>
        <FormGrid>
          <FormField
            id="event-name"
            label="Event name"
            hint="Required"
            half
            error={errors.name?.message}
          >
            <TextInput
              id="event-name"
              placeholder="e.g. Q1 2027 NSED"
              autoComplete="off"
              invalid={!!errors.name}
              aria-describedby={errors.name ? 'event-name-error' : undefined}
              {...register('name')}
            />
          </FormField>
          <FormField id="event-quarter" label="Quarter" hint="Optional" half>
            <TextInput
              id="event-quarter"
              placeholder="e.g. Q1 2027"
              autoComplete="off"
              {...register('quarter')}
            />
          </FormField>

          {event || !isSuperAdmin ? (
            <FormField
              id="event-campus"
              label="Campus"
              hint="Required"
              error={errors.campus_ids?.message}
              help={!isSuperAdmin ? 'Events are created for your campus.' : undefined}
            >
              <Controller
                control={control}
                name="campus_ids"
                render={({ field }) => (
                  <SelectField
                    id="event-campus"
                    value={field.value[0] ?? ''}
                    onChange={(value) => field.onChange(value ? [value] : [])}
                    options={activeCampuses.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Select campus"
                    required
                    disabled={!isSuperAdmin}
                    invalid={!!errors.campus_ids}
                  />
                )}
              />
            </FormField>
          ) : (
            <FormField
              id="event-campuses"
              label="Campuses"
              hint="Required"
              labelAs="span"
              error={errors.campus_ids?.message}
              help={
                picked.length > 1
                  ? `Creates ${picked.length} events named ${shownName}, one per campus. Each campus reports on its own event.`
                  : picked.length === 1
                    ? `Creates one event for ${campusName(picked[0])}.`
                    : 'Pick at least one campus.'
              }
            >
              <Controller
                control={control}
                name="campus_ids"
                render={({ field }) => (
                  <CampusChecklist
                    campuses={activeCampuses.filter((c) => c.is_active)}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          )}

          <FormField
            id="event-status"
            label="Status"
            hint="Required"
            labelAs="span"
            error={errors.status_id?.message}
            help="ERT members can only report on ongoing events."
          >
            <Controller
              control={control}
              name="status_id"
              render={({ field }) => (
                <SegmentedControl
                  name="event-status"
                  labelledBy="event-status-label"
                  options={statusOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>
          {statusId === completedId && !event?.ended_at && (
            <p className="-mt-2 text-[13px] text-gray-500 md:col-span-2">
              Without an end time, the event ends now when you save.
            </p>
          )}

          <FormField id="event-start" label="Starts" half>
            <TextInput id="event-start" type="datetime-local" {...register('started_at')} />
          </FormField>
          <FormField id="event-end" label="Ends" half error={errors.ended_at?.message}>
            <TextInput
              id="event-end"
              type="datetime-local"
              invalid={!!errors.ended_at}
              aria-describedby={errors.ended_at ? 'event-end-error' : undefined}
              {...register('ended_at')}
            />
          </FormField>
          <FormField id="event-description" label="Description" hint="Optional">
            <TextArea
              id="event-description"
              placeholder="e.g. Nationwide Simultaneous Earthquake Drill, first quarter."
              {...register('description')}
            />
          </FormField>
        </FormGrid>
      </DrawerBody>
    </form>
  );
}

/** All campuses on top, then one checkbox per campus. */
function CampusChecklist({
  campuses,
  value,
  onChange,
}: {
  campuses: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const all = campuses.length > 0 && campuses.every((c) => value.includes(c.id));
  const some = value.length > 0 && !all;
  const toggle = (id: string) =>
    onChange(
      value.includes(id)
        ? value.filter((v) => v !== id)
        : campuses.filter((c) => value.includes(c.id) || c.id === id).map((c) => c.id)
    );

  return (
    <div
      role="group"
      aria-labelledby="event-campuses-label"
      className="flex flex-col overflow-hidden rounded-2xl border border-gray-300 bg-white"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={all ? true : some ? 'mixed' : false}
        onClick={() => onChange(all ? [] : campuses.map((c) => c.id))}
        className={cn(
          'flex min-h-13 items-center gap-3 border-b border-[#eaecf0] bg-gray-50 px-4 text-left',
          FOCUS_RING,
          'focus-visible:-outline-offset-3'
        )}
      >
        <CheckBox checked={all} partial={some} />
        <span className="flex-1 text-[15px] font-semibold">All campuses</span>
        <span className="text-[13px] font-medium text-gray-500">
          {value.length} of {campuses.length}
        </span>
      </button>
      <div className="grid grid-cols-1 gap-x-4 px-4 py-1 md:grid-cols-2">
        {campuses.map((c) => (
          <button
            key={c.id}
            type="button"
            role="checkbox"
            aria-checked={value.includes(c.id)}
            onClick={() => toggle(c.id)}
            className={cn('flex min-h-12 items-center gap-3 rounded-lg text-left', FOCUS_RING)}
          >
            <CheckBox checked={value.includes(c.id)} />
            <span className="text-[15px] font-medium">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
