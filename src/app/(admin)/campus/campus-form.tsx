'use client';

import { PageBreadcrumb } from '@/components/common';
import { useCampus, useCreateCampus, useUpdateCampus } from '@/components/hooks/use-campus';
import { Button, Input, Label, Spinner } from '@/components/ui';
import { campusSchema, type CampusFormData } from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface CampusFormProps {
  editId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CampusForm({ editId, onSuccess, onCancel }: CampusFormProps) {
  const router = useRouter();
  const isEdit = !!editId;

  const { data: existingCampus, isLoading: isCampusLoading } = useCampus(editId);
  const createCampus = useCreateCampus();
  const updateCampus = useUpdateCampus();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CampusFormData>({
    resolver: zodResolver(campusSchema),
  });

  useEffect(() => {
    if (existingCampus) {
      reset({
        name: existingCampus.name,
        is_active: existingCampus.is_active ?? undefined,
      });
    }
  }, [existingCampus, reset]);

  const onSubmit = handleSubmit((data) => {
    if (isEdit) {
      updateCampus.mutate(
        {
          id: editId!,
          data: {
            name: data.name,
            is_active: data.is_active,
          },
        },
        {
          onSuccess: () => {
            toast.success('Campus updated');
            onSuccess ? onSuccess() : router.push('/campus');
          },
          onError: (err) => toast.error(err.message),
        }
      );
    } else {
      createCampus.mutate(
        {
          name: data.name,
          is_active: data.is_active,
        },
        {
          onSuccess: () => {
            toast.success('Campus created');
            onSuccess ? onSuccess() : router.push('/campus');
          },
          onError: (err) => toast.error(err.message),
        }
      );
    }
  });

  const isPending = isSubmitting || createCampus.isPending || updateCampus.isPending;

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle={isEdit ? 'Edit Campus' : 'Add Campus'} />

      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/3">
        {isEdit && isCampusLoading ? (
          <Spinner center />
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <Input
              label="Campus Name"
              id="Campus Name"
              required
              placeholder="e.g. UP Manila"
              error={!!errors.name}
              hint={errors.name?.message}
              {...register('name')}
            />

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
              <Button type="submit" isLoading={isPending} loadingText="Saving...">
                {isEdit ? 'Update Campus' : 'Create Campus'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => (onCancel ? onCancel() : router.push('/campus'))}
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
