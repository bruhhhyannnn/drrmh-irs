'use client';

import {
  useCreatePopulationCategory,
  usePopulationCategories,
  useUpdatePopulationCategory,
} from '@/components/hooks/use-population-categories';
import { Button, Checkbox, Input, Textarea } from '@/components/ui';
import { populationCategorySchema, type PopulationCategoryFormData } from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface PopulationCategoryFormProps {
  editId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PopulationCategoryForm({
  editId,
  onSuccess,
  onCancel,
}: PopulationCategoryFormProps) {
  const isEdit = !!editId;
  const { data: categories } = usePopulationCategories();
  const createMutation = useCreatePopulationCategory();
  const updateMutation = useUpdatePopulationCategory();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PopulationCategoryFormData>({
    resolver: zodResolver(populationCategorySchema),
    defaultValues: { code: '', name: '', description: '', is_active: true },
  });

  useEffect(() => {
    if (isEdit && categories) {
      const item = categories.find((c) => c.id === editId);
      if (item) {
        reset({
          code: item.code,
          name: item.name,
          description: item.description ?? '',
          is_active: item.is_active,
        });
      }
    }
  }, [isEdit, categories, editId, reset]);

  const onSubmit = async (data: PopulationCategoryFormData) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: editId!, data });
        toast.success('Category updated');
      } else {
        await createMutation.mutateAsync(data);
        toast.success('Category created');
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        {isEdit ? 'Edit' : 'Add'} Category
      </h4>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Code"
          required
          disabled={isEdit}
          placeholder="e.g. dormitory_residents"
          hint={
            errors.code?.message ??
            (isEdit
              ? 'Code cannot be changed once created.'
              : 'Lowercase letters, numbers, underscores. Used internally, not shown to users.')
          }
          error={!!errors.code}
          {...register('code')}
        />

        <Input
          label="Name"
          required
          placeholder="e.g. Dormitory Residents"
          error={!!errors.name}
          hint={errors.name?.message}
          {...register('name')}
        />

        <Textarea
          label="Description"
          placeholder="Optional notes about this category"
          rows={3}
          error={!!errors.description}
          hint={errors.description?.message}
          {...register('description')}
        />

        <Checkbox id="is_active" label="Active" {...register('is_active')} />

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
