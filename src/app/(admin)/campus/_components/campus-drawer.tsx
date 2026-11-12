'use client';

import { Drawer, SwitchField, TextInput } from '@/components/ds';
import {
  useCampusLogos,
  useCreateCampus,
  useSetCampusLogo,
  useUpdateCampus,
} from '@/components/hooks/use-campus';
import { campusSchema, type CampusFormData } from '@/lib';
import { ownCampusLogo } from '@/lib/campus-logo';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  DrawerBody,
  DrawerButton,
  DrawerButtons,
  FormField,
  FormGrid,
} from '../../_components/drawer-parts';
import { LogoField, type LogoChoice } from './logo-field';

/**
 * Add campus / Edit campus: the logo, a name and Active (on by default). The logo is saved
 * after the campus, so a logo problem never loses the campus.
 */
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
  const setLogo = useSetCampusLogo();

  const save = async (data: CampusFormData, logo: LogoChoice) => {
    let saved: { id: string };
    try {
      saved = campus
        ? await updateCampus.mutateAsync({ id: campus.id, data })
        : await createCampus.mutateAsync(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The campus could not be saved.');
      return;
    }
    if (logo.kind !== 'keep') {
      try {
        await setLogo.mutateAsync({
          campusId: saved.id,
          logo: logo.kind === 'new' ? logo.blob : null,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'The logo could not be saved.');
        onClose();
        return;
      }
    }
    toast.success(campus ? 'Campus updated' : `${data.name} added`);
    onClose();
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
            loading={createCampus.isPending || updateCampus.isPending || setLogo.isPending}
          >
            {campus ? 'Update campus' : 'Add campus'}
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
  onSave: (data: CampusFormData, logo: LogoChoice) => Promise<void>;
}) {
  const { data: logos } = useCampusLogos();
  const [logo, setLogo] = useState<LogoChoice>({ kind: 'keep' });
  const uploaded = (campus && logos?.byId[campus.id]) || null;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CampusFormData>({
    resolver: zodResolver(campusSchema),
    defaultValues: { name: campus?.name ?? '', is_active: campus?.is_active ?? true },
  });

  const onSubmit = handleSubmit((data) => onSave(data, logo));

  return (
    <form id="campus-form" onSubmit={onSubmit} noValidate>
      <DrawerBody>
        <FormGrid>
          <LogoField
            current={uploaded}
            fallback={campus ? ownCampusLogo(campus.name) : null}
            value={logo}
            onChange={setLogo}
          />
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
                  description="Shows in the campus switcher and campus pickers."
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
