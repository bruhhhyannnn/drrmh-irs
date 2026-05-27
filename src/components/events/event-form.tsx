'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEvent, useCreateEvent, useUpdateEvent, useEventStatuses, useLocations } from '@/hooks';
import { eventSchema, type EventFormData } from '@/lib';
import { useAuthStore } from '@/store';
import { PageBreadcrumb } from '@/components/common';
import { Input, Label, Select, Textarea, Button, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';

interface EventFormProps {
  editId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const toDatetimeLocal = (val?: string | Date | null) => {
  if (!val) return '';
  const date = new Date(val);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function EventForm({ editId, onSuccess, onCancel }: EventFormProps) {
  const router = useRouter();
  const isEdit = !!editId;
  const userId = useAuthStore((s) => s.userProfile?.id);

  const { data: existingEvent, isLoading: isEventLoading } = useEvent(editId);
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const { data: eventStatuses = [] } = useEventStatuses();
  const { data: locations = [] } = useLocations();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
  });

  useEffect(() => {
    if (existingEvent) {
      reset({
        name: existingEvent.name,
        description: existingEvent.description ?? '',
        quarter: existingEvent.quarter ?? '',
        started_at: toDatetimeLocal(existingEvent.started_at),
        ended_at: toDatetimeLocal(existingEvent.ended_at),
        location_id: existingEvent.location_id ?? '',
        status_id: existingEvent.status_id,
      });
    }
  }, [existingEvent, reset]);

  const onSubmit = handleSubmit((data) => {
    const startedAt = data.started_at ? new Date(data.started_at) : null;
    const endedAt = data.ended_at ? new Date(data.ended_at) : null;

    if (isEdit) {
      updateEvent.mutate(
        {
          id: editId!,
          data: {
            name: data.name,
            description: data.description || null,
            quarter: data.quarter || null,
            started_at: startedAt,
            ended_at: endedAt,
            status: { connect: { id: data.status_id } },
            location: data.location_id
              ? { connect: { id: data.location_id } }
              : { disconnect: true },
          },
        },
        {
          onSuccess: () => {
            toast.success('Event updated');
            onSuccess ? onSuccess() : router.push('/events');
          },
          onError: (err) => toast.error(err.message),
        }
      );
    } else {
      createEvent.mutate(
        {
          name: data.name,
          description: data.description || undefined,
          quarter: data.quarter || undefined,
          ...(startedAt && { started_at: startedAt }),
          ...(endedAt && { ended_at: endedAt }),
          status: { connect: { id: data.status_id } },
          ...(data.location_id && { location: { connect: { id: data.location_id } } }),
          ...(userId && { user: { connect: { id: userId } } }),
        },
        {
          onSuccess: () => {
            toast.success('Event created');
            onSuccess ? onSuccess() : router.push('/events');
          },
          onError: (err) => toast.error(err.message),
        }
      );
    }
  });

  const statusOptions = eventStatuses.map((s) => ({ value: s.id, label: s.name }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  const isPending = isSubmitting || createEvent.isPending || updateEvent.isPending;

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle={isEdit ? 'Edit Event' : 'Add Event'} />

      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/3">
        {isEdit && isEventLoading ? (
          <Spinner center />
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label required>Event Name</Label>
              <Input error={!!errors.name} hint={errors.name?.message} {...register('name')} />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea rows={3} {...register('description')} />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label>Quarter</Label>
                <Input placeholder="e.g. Q1 2025" {...register('quarter')} />
              </div>
              <div>
                <Label required>Status</Label>
                <Select
                  options={statusOptions}
                  placeholder="Select status..."
                  error={!!errors.status_id}
                  hint={errors.status_id?.message}
                  {...register('status_id')}
                />
              </div>
              <div>
                <Label>Started At</Label>
                <Input type="datetime-local" {...register('started_at')} />
              </div>
              <div>
                <Label>Ended At</Label>
                <Input type="datetime-local" {...register('ended_at')} />
              </div>
            </div>

            <div>
              <Label>Location</Label>
              <Select
                options={locationOptions}
                placeholder="Select location..."
                {...register('location_id')}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={isPending} loadingText="Saving...">
                {isEdit ? 'Update Event' : 'Create Event'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => (onCancel ? onCancel() : router.push('/events'))}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
