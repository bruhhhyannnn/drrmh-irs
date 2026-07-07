'use client';

import type { SettingsTable } from '@/actions/settings';
import {
  useCampus,
  useClusters,
  useCreateSetting,
  useSettingsTable,
  useUpdateSetting,
} from '@/components/hooks/use-settings';
import { Button, Input, Label, Select } from '@/components/ui';
import {
  campusSchema,
  casualtyConditionSchema,
  clusterSchema,
  damageConditionSchema,
  eventStatusSchema,
  positionSchema,
  unitSchema,
  userTypeSchema,
} from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const SCHEMA_MAP = {
  clusters: clusterSchema,
  units: unitSchema,
  positions: positionSchema,
  user_types: userTypeSchema,
  event_statuses: eventStatusSchema,
  casualty_conditions: casualtyConditionSchema,
  damage_conditions: damageConditionSchema,
  campus: campusSchema,
} as const;

// Tables that require a cluster_id foreign key
const NEEDS_CLUSTER: SettingsTable[] = ['units'];

const NEEDS_CAMPUS: SettingsTable[] = ['clusters'];

type AnyFormData = z.infer<(typeof SCHEMA_MAP)[SettingsTable]>;

interface SettingsFormProps {
  title: string;
  table: SettingsTable;
  editId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SettingsForm({ title, table, editId, onSuccess, onCancel }: SettingsFormProps) {
  const isEdit = !!editId;
  const needsCluster = NEEDS_CLUSTER.includes(table);
  const needsCampus = NEEDS_CAMPUS.includes(table);

  const { data: items } = useSettingsTable(table);
  const { data: clusters = [] } = useClusters();
  const { data: campus = [] } = useCampus();
  const createMutation = useCreateSetting(table);
  const updateMutation = useUpdateSetting(table);

  const schema = SCHEMA_MAP[table];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnyFormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (isEdit && items) {
      const item = items.find((i: Record<string, unknown>) => i.id === editId);
      if (item) {
        reset({
          name: String(item.name ?? ''),
          is_active: Boolean(item.is_active),
          ...(needsCluster && { cluster_id: String(item.cluster_id ?? '') }),
          ...(needsCampus && { campus_id: String(item.campus_id ?? '') }),
        } as AnyFormData);
      }
    }
  }, [isEdit, items, editId, reset, needsCluster]);

  const onSubmit = async (data: AnyFormData) => {
    if (isEdit) {
      await updateMutation.mutateAsync({ id: editId!, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onSuccess?.();
  };

  const singularTitle = title.replace(/s$/, '');
  const clusterOptions = (clusters as { id: string; name: string; is_active: boolean }[])
    .filter((c) => c.is_active)
    .map((c) => ({
      value: c.id,
      label: c.name,
    }));

  const campusOptions = (campus as { id: string; name: string; is_active: boolean }[])
    .filter((c) => c.is_active)
    .map((c) => ({
      value: c.id,
      label: c.name,
    }));

  const nameError = (errors as Record<string, { message?: string }>).name;
  const clusterError = (errors as Record<string, { message?: string }>).cluster_id;
  const campusError = (errors as Record<string, { message?: string }>).campus_id;

  return (
    <div className="space-y-6">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        {isEdit ? 'Edit' : 'Add'} {singularTitle}
      </h4>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Name"
          required
          placeholder={`Enter ${singularTitle.toLowerCase()} name`}
          error={!!nameError}
          hint={nameError?.message}
          {...register('name')}
        />

        {needsCluster && (
          <Select
            label="Cluster"
            required
            options={clusterOptions}
            placeholder="Select cluster..."
            error={!!clusterError}
            hint={clusterError?.message}
            {...register('cluster_id')}
          />
        )}

        {needsCampus && (
          <Select
            label="Campus"
            required
            options={campusOptions}
            placeholder="Select campus..."
            error={!!campusError}
            hint={campusError?.message}
            {...register('campus_id')}
          />
        )}

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_active"
            {...register('is_active')}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="is_active" className="mb-0">
            Active
          </Label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            loadingText="Saving..."
          >
            {isEdit ? 'Update' : 'Create'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
