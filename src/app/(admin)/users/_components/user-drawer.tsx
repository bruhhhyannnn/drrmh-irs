'use client';

import {
  Drawer,
  OTHER_OPTION,
  OTHER_VALUE,
  PasswordInput,
  SegmentedControl,
  SelectField,
  SwitchField,
  TextInput,
} from '@/components/ds';
import { useCampusClusters } from '@/components/hooks/use-campus';
import { useCampus, usePositions, useUnits, useUserTypes } from '@/components/hooks/use-settings';
import { useCreateUser, useUpdateUser, useUser } from '@/components/hooks/use-users';
import { cn, userCreateSchema, userEditSchema, type UserCreateFormData } from '@/lib';
import { useAuthStore } from '@/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  DrawerBody,
  DrawerButton,
  DrawerButtons,
  DrawerSection,
  FormField,
  FormGrid,
  KvList,
} from '../../_components/drawer-parts';
import { useIsSuperAdmin } from '../../_components/shell/campus-switcher';
import { Skeleton } from '../../_components/ui';
import { formatDate } from '../../_lib/format';

// The same rules as passwordSchema in src/lib/schemas.ts, ticked as the password is typed.
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: '1 uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: '1 number', test: (p: string) => /[0-9]/.test(p) },
  { label: '1 special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const TYPE_LABELS: Record<string, string> = {
  'ERT Member': 'ERT',
  Administrator: 'Admin',
  'Super Admin': 'Super Admin',
};

type FormValues = UserCreateFormData;

/** Add user / Edit user, grouped into Name, Account, Assignment and Access. */
export function UserDrawer({
  open,
  onClose,
  userId,
  reports,
}: {
  open: boolean;
  onClose: () => void;
  userId?: string;
  /** Reports this user submitted (edit only). */
  reports?: number;
}) {
  const { data: user, isPending } = useUser(userId);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isEdit = !!userId;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title={isEdit ? 'Edit user' : 'Add user'}
      footer={
        <DrawerButtons>
          <DrawerButton variant="outline" onClick={onClose}>
            Cancel
          </DrawerButton>
          <DrawerButton
            type="submit"
            form="user-form"
            loading={createUser.isPending || updateUser.isPending}
          >
            {isEdit ? 'Update user' : 'Create user'}
          </DrawerButton>
        </DrawerButtons>
      }
    >
      {isEdit && (isPending || !user) ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <UserForm
          user={isEdit ? (user ?? null) : null}
          reports={reports}
          createUser={createUser}
          updateUser={updateUser}
          onDone={onClose}
        />
      )}
    </Drawer>
  );
}

type UserRow = NonNullable<ReturnType<typeof useUser>['data']>;

function UserForm({
  user,
  reports,
  createUser,
  updateUser,
  onDone,
}: {
  user: UserRow | null;
  reports?: number;
  createUser: ReturnType<typeof useCreateUser>;
  updateUser: ReturnType<typeof useUpdateUser>;
  onDone: () => void;
}) {
  const { userProfile } = useAuthStore();
  const isSuperAdmin = useIsSuperAdmin();
  const { data: campuses = [] } = useCampus();
  const { data: positions = [] } = usePositions();
  const { data: userTypes = [] } = useUserTypes();

  const ertTypeId = userTypes.find((t) => t.name === 'ERT Member')?.id ?? '';
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(user ? (userEditSchema as never) : userCreateSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      middle_name: user?.middle_name ?? '',
      suffix: user?.suffix ?? '',
      email: user?.email ?? '',
      username: user?.username ?? '',
      password: '',
      confirmPassword: '',
      campus_id: user?.campus_id ?? (isSuperAdmin ? '' : (userProfile?.campus_id ?? '')),
      cluster_id: user?.cluster_id ?? user?.unit?.cluster_id ?? null,
      unit_id: user?.unit_id ?? null,
      position_id: user?.position_id ?? null,
      custom_unit_name: '',
      custom_position_name: '',
      user_type_id: user?.user_type_id ?? ertTypeId,
      is_active: user?.is_active ?? true,
    },
  });

  // New users start as ERT once the user types have loaded.
  useEffect(() => {
    if (!getValues('user_type_id') && ertTypeId) setValue('user_type_id', ertTypeId);
  }, [ertTypeId, getValues, setValue]);

  const campusId = useWatch({ control, name: 'campus_id' });
  const clusterId = useWatch({ control, name: 'cluster_id' });
  const typeId = useWatch({ control, name: 'user_type_id' });
  const password = useWatch({ control, name: 'password' }) ?? '';
  const { data: clusters = [] } = useCampusClusters(campusId ?? '');
  const { data: units = [] } = useUnits(clusterId || undefined, { enabled: !!clusterId });
  // "Other (please specify)" picked: a name field opens under the selects.
  const [unitOther, setUnitOther] = useState(false);
  const [positionOther, setPositionOther] = useState(false);

  const typeOptions = userTypes
    .filter((t) => t.name in TYPE_LABELS && t.is_active)
    // Administrators can't make super admins.
    .filter((t) => isSuperAdmin || t.name !== 'Super Admin' || t.id === user?.user_type_id)
    .sort(
      (a, b) => Object.keys(TYPE_LABELS).indexOf(a.name) - Object.keys(TYPE_LABELS).indexOf(b.name)
    )
    .map((t) => ({ value: t.id, label: TYPE_LABELS[t.name] }));
  const isErt = typeId === ertTypeId;

  const onSubmit = handleSubmit(async (data) => {
    // ERT members report for a cluster and unit; admins don't need one.
    if (isErt && !data.cluster_id) {
      setError('cluster_id', { message: 'Pick a cluster for an ERT member.' });
      return;
    }
    const unitName = unitOther ? data.custom_unit_name?.trim() : '';
    const positionName = positionOther ? data.custom_position_name?.trim() : '';
    if (unitOther && !unitName) {
      setError('custom_unit_name', { message: 'Enter the unit name.' });
      return;
    }
    if (positionOther && !positionName) {
      setError('custom_position_name', { message: 'Enter the position name.' });
      return;
    }
    const profile = {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      middle_name: data.middle_name?.trim() || null,
      suffix: data.suffix?.trim() || null,
      email: data.email.trim(),
      username: data.username.trim(),
      campus_id: data.campus_id,
      cluster_id: data.cluster_id || null,
      unit_id: unitOther ? null : data.unit_id || null,
      position_id: positionOther ? null : data.position_id || null,
      custom_unit_name: unitName || null,
      custom_position_name: positionName || null,
      user_type_id: data.user_type_id,
      is_active: data.is_active,
    };
    try {
      if (user) {
        await updateUser.mutateAsync({ id: user.id, data: profile });
        toast.success('User updated');
      } else {
        await createUser.mutateAsync({ ...profile, password: data.password });
        toast.success(`${profile.first_name} ${profile.last_name} can now sign in`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The user could not be saved.');
    }
  });

  const describedBy = (id: string, error?: unknown) => (error ? `${id}-error` : undefined);

  return (
    <form id="user-form" onSubmit={onSubmit} noValidate>
      <DrawerBody>
        {user && (
          <DrawerSection title="Activity">
            <KvList
              rows={[
                { label: 'Reports', value: `${reports ?? 0} submitted` },
                { label: 'Profile', value: user.is_profile_complete ? 'Complete' : 'Incomplete' },
                { label: 'Member since', value: formatDate(user.created_at) },
              ]}
            />
          </DrawerSection>
        )}

        <DrawerSection title="Name">
          <FormGrid>
            <FormField
              id="user-first"
              label="First name"
              hint="Required"
              half
              error={errors.first_name?.message}
            >
              <TextInput
                id="user-first"
                placeholder="e.g. Juan"
                autoComplete="off"
                invalid={!!errors.first_name}
                aria-describedby={describedBy('user-first', errors.first_name)}
                {...register('first_name')}
              />
            </FormField>
            <FormField id="user-middle" label="Middle name" hint="Optional" half>
              <TextInput
                id="user-middle"
                placeholder="e.g. Santos"
                autoComplete="off"
                {...register('middle_name')}
              />
            </FormField>
            <FormField
              id="user-last"
              label="Last name"
              hint="Required"
              half
              error={errors.last_name?.message}
            >
              <TextInput
                id="user-last"
                placeholder="e.g. Dela Cruz"
                autoComplete="off"
                invalid={!!errors.last_name}
                aria-describedby={describedBy('user-last', errors.last_name)}
                {...register('last_name')}
              />
            </FormField>
            <FormField id="user-suffix" label="Suffix" hint="Optional" half>
              <TextInput
                id="user-suffix"
                placeholder="e.g. Jr., III"
                autoComplete="off"
                {...register('suffix')}
              />
            </FormField>
          </FormGrid>
        </DrawerSection>

        <DrawerSection title="Account">
          <FormGrid>
            <FormField id="user-email" label="Email" hint="Required" error={errors.email?.message}>
              <TextInput
                id="user-email"
                type="email"
                placeholder="e.g. jdelacruz@up.edu.ph"
                autoComplete="off"
                invalid={!!errors.email}
                aria-describedby={describedBy('user-email', errors.email)}
                {...register('email')}
              />
            </FormField>
            <FormField
              id="user-username"
              label="Username"
              hint="Required"
              error={errors.username?.message}
            >
              <TextInput
                id="user-username"
                placeholder="e.g. jdelacruz"
                autoComplete="off"
                invalid={!!errors.username}
                aria-describedby={describedBy('user-username', errors.username)}
                {...register('username')}
              />
            </FormField>
            {!user && (
              <>
                <FormField
                  id="user-password"
                  label="Password"
                  hint="Required"
                  half
                  error={errors.password?.message}
                >
                  <PasswordInput
                    id="user-password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    className="font-landing-mono placeholder:font-landing"
                    invalid={!!errors.password}
                    aria-describedby={
                      describedBy('user-password', errors.password) ?? 'user-password-rules'
                    }
                    {...register('password')}
                  />
                </FormField>
                <FormField
                  id="user-confirm"
                  label="Confirm password"
                  hint="Required"
                  half
                  error={errors.confirmPassword?.message}
                >
                  <PasswordInput
                    id="user-confirm"
                    placeholder="Retype password"
                    autoComplete="new-password"
                    invalid={!!errors.confirmPassword}
                    aria-describedby={describedBy('user-confirm', errors.confirmPassword)}
                    {...register('confirmPassword')}
                  />
                </FormField>
                <ul
                  id="user-password-rules"
                  className="grid grid-cols-1 gap-x-4 gap-y-2 md:col-span-2 md:grid-cols-2"
                >
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={cn(
                          'flex items-center gap-2 text-[13px] font-medium',
                          ok ? 'text-success-700' : 'text-gray-600'
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-4.5 shrink-0 place-items-center rounded-full',
                            ok ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-400'
                          )}
                        >
                          {ok ? (
                            <Check size={12} strokeWidth={3} />
                          ) : (
                            <Minus size={12} strokeWidth={3} />
                          )}
                        </span>
                        {rule.label}
                        <span className="sr-only">{ok ? ' — done' : ' — not yet'}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </FormGrid>
        </DrawerSection>

        <DrawerSection title="Assignment">
          <FormGrid>
            {/* Administrators add users to their own campus. */}
            {isSuperAdmin && (
              <FormField
                id="user-campus"
                label="Campus"
                hint="Required"
                half
                error={errors.campus_id?.message}
              >
                <Controller
                  control={control}
                  name="campus_id"
                  render={({ field }) => (
                    <SelectField
                      id="user-campus"
                      value={field.value ?? ''}
                      onChange={(value) => {
                        field.onChange(value);
                        setValue('cluster_id', null);
                        setValue('unit_id', null);
                        setUnitOther(false);
                      }}
                      options={campuses
                        .filter((c) => c.is_active || c.id === field.value)
                        .map((c) => ({ value: c.id, label: c.name }))}
                      placeholder="Select campus"
                      required
                      invalid={!!errors.campus_id}
                      describedBy={describedBy('user-campus', errors.campus_id)}
                    />
                  )}
                />
              </FormField>
            )}
            <FormField
              id="user-cluster"
              label="Cluster"
              hint={isErt ? 'Required' : 'Optional'}
              half
              error={errors.cluster_id?.message}
            >
              <Controller
                control={control}
                name="cluster_id"
                render={({ field }) => (
                  <SelectField
                    id="user-cluster"
                    value={field.value ?? ''}
                    onChange={(value) => {
                      field.onChange(value || null);
                      setValue('unit_id', null);
                      setUnitOther(false);
                    }}
                    options={clusters
                      .filter((c) => c.is_active || c.id === field.value)
                      .map((c) => ({ value: c.id, label: c.name }))}
                    placeholder={campusId ? 'Select cluster' : 'Pick the campus first'}
                    emptyLabel="No cluster"
                    required={isErt}
                    disabled={!campusId}
                    invalid={!!errors.cluster_id}
                    describedBy={describedBy('user-cluster', errors.cluster_id)}
                  />
                )}
              />
            </FormField>
            {/* Some clusters have no units, so Unit is optional for everyone. */}
            <FormField id="user-unit" label="Unit" hint="Optional" half>
              <Controller
                control={control}
                name="unit_id"
                render={({ field }) => (
                  <SelectField
                    id="user-unit"
                    value={unitOther ? OTHER_VALUE : (field.value ?? '')}
                    onChange={(value) => {
                      setUnitOther(value === OTHER_VALUE);
                      field.onChange(value === OTHER_VALUE ? null : value || null);
                    }}
                    options={[
                      ...units
                        .filter((u) => u.is_active || u.id === field.value)
                        .map((u) => ({ value: u.id, label: u.name })),
                      OTHER_OPTION,
                    ]}
                    placeholder={clusterId ? 'No unit' : 'Pick the cluster first'}
                    emptyLabel="No unit"
                    disabled={!clusterId}
                  />
                )}
              />
            </FormField>
            <FormField id="user-position" label="Position" hint="Optional" half={isSuperAdmin}>
              <Controller
                control={control}
                name="position_id"
                render={({ field }) => (
                  <SelectField
                    id="user-position"
                    value={positionOther ? OTHER_VALUE : (field.value ?? '')}
                    onChange={(value) => {
                      setPositionOther(value === OTHER_VALUE);
                      field.onChange(value === OTHER_VALUE ? null : value || null);
                    }}
                    options={[
                      ...positions
                        .filter((p) => p.is_active || p.id === field.value)
                        .map((p) => ({ value: p.id, label: p.name })),
                      OTHER_OPTION,
                    ]}
                    placeholder="Select position"
                    emptyLabel="No position"
                  />
                )}
              />
            </FormField>
            {unitOther && (
              <FormField
                id="user-unit-name"
                label="Unit name"
                hint="Required"
                error={errors.custom_unit_name?.message}
              >
                <TextInput
                  id="user-unit-name"
                  autoFocus
                  placeholder="e.g. Room 500s"
                  autoComplete="off"
                  invalid={!!errors.custom_unit_name}
                  aria-describedby={describedBy('user-unit-name', errors.custom_unit_name)}
                  {...register('custom_unit_name')}
                />
              </FormField>
            )}
            {positionOther && (
              <FormField
                id="user-position-name"
                label="Position name"
                hint="Required"
                error={errors.custom_position_name?.message}
              >
                <TextInput
                  id="user-position-name"
                  autoFocus
                  placeholder="e.g. Safety Officer"
                  autoComplete="organization-title"
                  invalid={!!errors.custom_position_name}
                  aria-describedby={describedBy('user-position-name', errors.custom_position_name)}
                  {...register('custom_position_name')}
                />
              </FormField>
            )}
          </FormGrid>
        </DrawerSection>

        <DrawerSection title="Access">
          <FormGrid>
            <FormField
              id="user-type"
              label="User type"
              hint="Required"
              labelAs="span"
              error={errors.user_type_id?.message}
            >
              <Controller
                control={control}
                name="user_type_id"
                render={({ field }) => (
                  <SegmentedControl
                    name="user-type"
                    labelledBy="user-type-label"
                    options={typeOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
            <div className="md:col-span-2">
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <SwitchField
                    id="user-active"
                    label="Active"
                    description="Can be changed later from the Users list."
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </FormGrid>
        </DrawerSection>
      </DrawerBody>
    </form>
  );
}
