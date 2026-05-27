'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUser, useCreateUser, useUpdateUser } from '@/hooks';
import { useClusters, useUnits, usePositions, useUserTypes } from '@/hooks';
import {
  userCreateSchema,
  userEditSchema,
  type UserCreateFormData,
  type UserEditFormData,
} from '@/lib';
import { PageBreadcrumb } from '@/components/common';
import { Input, Label, Select, Button, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';

interface UserFormProps {
  editId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function UserForm({ editId, onSuccess, onCancel }: UserFormProps) {
  const router = useRouter();
  const isEdit = !!editId;

  const { data: existingUser, isLoading: isUserLoading } = useUser(editId);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const { data: clusters = [] } = useClusters();
  const { data: positions = [] } = usePositions();
  const { data: userTypes = [] } = useUserTypes();

  // Cluster is local state — used only to filter the units dropdown
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const { data: units = [] } = useUnits(selectedClusterId || undefined);

  const schema = isEdit ? userEditSchema : userCreateSchema;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateFormData | UserEditFormData>({
    resolver: zodResolver(schema),
  });

  // Populate form when editing
  useEffect(() => {
    if (existingUser) {
      reset({
        first_name: existingUser.first_name,
        middle_name: existingUser.middle_name ?? '',
        last_name: existingUser.last_name,
        suffix: existingUser.suffix ?? '',
        username: existingUser.username,
        email: existingUser.email,
        unit_id: existingUser.unit_id ?? '',
        position_id: existingUser.position_id ?? '',
        user_type_id: existingUser.user_type_id,
        is_active: existingUser.is_active,
      });
      // Pre-select the cluster so the units dropdown is populated
      if (existingUser.unit?.cluster_id) {
        setSelectedClusterId(existingUser.unit.cluster_id);
      }
    }
  }, [existingUser, reset]);

  const onSubmit = handleSubmit((data) => {
    const clean = {
      ...data,
      middle_name: data.middle_name || null,
      suffix: data.suffix || null,
      unit_id: data.unit_id || null,
      position_id: data.position_id || null,
    };

    // Update user
    if (isEdit) {
      const { password: _, ...updateData } = clean as UserCreateFormData;
      updateUser.mutate(
        { id: editId!, data: updateData },
        {
          onSuccess: () => {
            toast.success('User updated');
            onSuccess ? onSuccess() : router.push('/users');
          },
          onError: (err) => toast.error(err.message),
        }
      );
    }
    // Creation of new user
    else {
      createUser.mutate(clean as UserCreateFormData, {
        onSuccess: () => {
          toast.success(`User created ${getValues('email')}}`);
          onSuccess ? onSuccess() : router.push('/users');
        },
        onError: (err) => toast.error(err.message),
      });
    }
  });

  const clusterOptions = clusters.map((c) => ({ value: c.id, label: c.name }));
  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }));
  const positionOptions = positions.map((p) => ({ value: p.id, label: p.name }));
  const userTypeOptions = userTypes.map((t) => ({ value: t.id, label: t.name }));

  const isPending = isSubmitting || createUser.isPending || updateUser.isPending;

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle={isEdit ? 'Edit User' : 'Add User'} />

      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/3">
        {isEdit && isUserLoading ? (
          <Spinner center />
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Personal Info */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label required>First Name</Label>
                <Input
                  error={!!errors.first_name}
                  hint={errors.first_name?.message}
                  {...register('first_name')}
                />
              </div>
              <div>
                <Label>Middle Name</Label>
                <Input {...register('middle_name')} />
              </div>
              <div>
                <Label required>Last Name</Label>
                <Input
                  error={!!errors.last_name}
                  hint={errors.last_name?.message}
                  {...register('last_name')}
                />
              </div>
              <div>
                <Label>Suffix</Label>
                <Input placeholder="Jr., Sr., III" {...register('suffix')} />
              </div>
            </div>

            {/* Account Info */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label required>Username</Label>
                <Input
                  error={!!errors.username}
                  hint={errors.username?.message}
                  {...register('username')}
                />
              </div>
              <div>
                <Label required>Email</Label>
                <Input
                  type="email"
                  error={!!errors.email}
                  hint={errors.email?.message}
                  {...register('email')}
                />
              </div>
              {!isEdit && (
                <div className="sm:col-span-2">
                  <Label required>Password</Label>
                  <Input
                    type="password"
                    placeholder="Min. 8 characters"
                    error={!!(errors as { password?: { message?: string } }).password}
                    hint={(errors as { password?: { message?: string } }).password?.message}
                    {...register('password' as keyof (UserCreateFormData | UserEditFormData))}
                  />
                </div>
              )}
            </div>

            {/* Role & Assignment */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label>Cluster</Label>
                <Select
                  options={clusterOptions}
                  placeholder="Select cluster..."
                  value={selectedClusterId}
                  onChange={(e) => {
                    setSelectedClusterId(e.target.value);
                    setValue('unit_id', '');
                  }}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select
                  options={unitOptions}
                  placeholder="Select unit..."
                  value={watch('unit_id') ?? ''}
                  onChange={(e) => setValue('unit_id', e.target.value)}
                  error={!!errors.unit_id}
                />
              </div>
              <div>
                <Label>Position</Label>
                <Select
                  options={positionOptions}
                  placeholder="Select position..."
                  value={watch('position_id') ?? ''}
                  onChange={(e) => setValue('position_id', e.target.value)}
                  error={!!errors.position_id}
                />
              </div>
              <div>
                <Label required>User Type</Label>
                <Select
                  options={userTypeOptions}
                  placeholder="Select type..."
                  value={watch('user_type_id') ?? ''}
                  onChange={(e) => setValue('user_type_id', e.target.value)}
                  error={!!errors.user_type_id}
                  hint={errors.user_type_id?.message}
                />
              </div>
            </div>

            {/* Status */}
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
                {isEdit ? 'Update User' : 'Create User'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => (onCancel ? onCancel() : router.push('/users'))}
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
