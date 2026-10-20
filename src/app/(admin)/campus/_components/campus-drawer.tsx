'use client';

import { Drawer, SwitchField, TextInput } from '@/components/ds';
import { useCreateCampus, useUpdateCampus } from '@/components/hooks/use-campus';
import { campusSchema, type CampusFormData } from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  DrawerBody,
  DrawerButton,
  DrawerButtons,
  FormField,
  FormGrid,
} from '../../_components/drawer-parts';

/** Add campus / Edit campus: a name and Active, on by default. */
export function CampusDrawer({
  open,
  onClose,
  campus,
}: {
  open: boolean;
  onClose: () => void;
  campus?: { id: string; name: string; is_active: boolean } | null;
}) {
  const createCampus = useCreateCampus();
  const updateCampus = useUpdateCampus();

  const save = async (data: CampusFormData) => {
    try {
      if (campus) {
        await updateCampus.mutateAsync({ id: campus.id, data });
        toast.success('Campus updated');
      } else {
        await createCampus.mutateAsync(data);
        toast.success(`${data.name} added`);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The campus could not be saved.');
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title={campus ? 'Edit campus' : 'Add campus'}
      subtitle="Shows in the campus switcher and campus pickers."
      footer={
        <DrawerButtons>
          <DrawerButton variant="outline" onClick={onClose}>
            Cancel
          </DrawerButton>
          <DrawerButton
            type="submit"
            form="campus-form"
            loading={createCampus.isPending || updateCampus.isPending}
          >
            {campus ? 'Update campus' : 'Create campus'}
          </DrawerButton>
        </DrawerButtons>
      }
    >
      <CampusForm campus={campus} onSave={save} />
    </Drawer>
  );
}

function CampusForm({
  campus,
  onSave,
}: {
  campus?: { id: string; name: string; is_active: boolean } | null;
  onSave: (data: CampusFormData) => Promise<void>;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CampusFormData>({
    resolver: zodResolver(campusSchema),
    defaultValues: { name: campus?.name ?? '', is_active: campus?.is_active ?? true },
  });

  const onSubmit = handleSubmit(onSave);

  return (
    <form id="campus-form" onSubmit={onSubmit} noValidate>
      <DrawerBody>
        <FormGrid>
          <FormField
            id="campus-name"
            label="Campus name"
            hint="Required"
            error={errors.name?.message}
          >
            <TextInput
              id="campus-name"
              placeholder="e.g. UP Cebu"
              autoComplete="off"
              invalid={!!errors.name}
              aria-describedby={errors.name ? 'campus-name-error' : undefined}
              {...register('name')}
            />
          </FormField>
          <div className="md:col-span-2">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <SwitchField
                  id="campus-active"
                  label="Active"
                  description="Inactive campuses are hidden from the event form."
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </FormGrid>
      </DrawerBody>
    </form>
  );
}
