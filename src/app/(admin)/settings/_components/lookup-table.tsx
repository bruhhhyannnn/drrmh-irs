'use client';

import type { SettingsTable } from '@/actions/settings';
import { Drawer, SelectField, Switch, SwitchField, TextInput } from '@/components/ds';
import {
  useCampus,
  useCreateSetting,
  useDeleteSetting,
  useSettingsTable,
  useUpdateSetting,
} from '@/components/hooks/use-settings';
import {
  casualtyConditionSchema,
  clusterSchema,
  damageConditionSchema,
  positionSchema,
  unitSchema,
} from '@/lib';
import { useAuthStore } from '@/store';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import {
  DataTable,
  FilterSelect,
  IconAction,
  ListCard,
  ListCount,
  ListToolbar,
  MobileCard,
  NameCell,
  NumberCell,
  RowActions,
  SearchField,
  TextCell,
  type Column,
} from '../../_components/data-list';
import {
  DrawerBody,
  DrawerButton,
  DrawerButtons,
  FormField,
  FormGrid,
} from '../../_components/drawer-parts';
import { useScopedCampusId } from '../../_components/shell/campus-switcher';
import { Card } from '../../_components/ui';
import { formatDate, plural } from '../../_lib/format';
import { capitalize } from '../../_lib/status';

/** A row of any lookup table, with what the actions include for clusters and units. */
interface LookupRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string | Date;
  campus_id?: string;
  cluster_id?: string;
  campus?: { name: string };
  cluster?: { name: string; campus_id: string };
  _count?: Partial<
    Record<'units' | 'users' | 'reports' | 'casualties' | 'bystander_reports', number>
  >;
}

const SCHEMAS = {
  clusters: clusterSchema,
  units: unitSchema,
  positions: positionSchema,
  casualty_conditions: casualtyConditionSchema,
  damage_conditions: damageConditionSchema,
} as const;

/** "3 units, 12 users and 40 reports are linked to it." — what still points at this row. */
function linkedWarning(row: LookupRow) {
  const c = row._count ?? {};
  const counts = [
    [c.units, 'unit', 'units'],
    [c.users, 'user', 'users'],
    [c.casualties, 'casualty', 'casualties'],
    [c.reports, 'report', 'reports'],
    [c.bystander_reports, 'bystander report', 'bystander reports'],
  ].filter(([n]) => !!n) as [number, string, string][];
  if (!counts.length) return undefined;
  const parts = counts.map(([n, one, many]) => plural(n, one, many));
  const text =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  const many = counts.length > 1 || counts[0][0] > 1;
  return `${text} ${many ? 'are' : 'is'} linked to it. If it can't be deleted, turn it off instead to hide it without losing that history.`;
}

export function LookupTable({
  table,
  label,
  singular,
  noun,
  adding,
  onAddingChange,
}: {
  table: SettingsTable;
  label: string;
  singular: string;
  noun: string;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}) {
  const campusId = useScopedCampusId();
  const { data, isPending, error } = useSettingsTable(table);
  const { data: clusters = [] } = useSettingsTable('clusters');
  const update = useUpdateSetting(table);
  const remove = useDeleteSetting(table);
  const [query, setQuery] = useState('');
  const [clusterId, setClusterId] = useState('');
  // The row stays set while the drawer slides out, so its title doesn't flip to Add.
  const [drawer, setDrawer] = useState<{ open: boolean; row: LookupRow | null }>({
    open: false,
    row: null,
  });
  const [deleting, setDeleting] = useState<LookupRow | null>(null);

  // The page header's Add button.
  useEffect(() => {
    if (!adding) return;
    setDrawer({ open: true, row: null });
    onAddingChange(false);
  }, [adding, onAddingChange]);
  const setEditing = (row: LookupRow) => setDrawer({ open: true, row });

  const isClusters = table === 'clusters';
  const isUnits = table === 'units';
  const allCampuses = !campusId;
  const scopedClusters = (clusters as LookupRow[]).filter(
    (c) => !campusId || c.campus_id === campusId
  );

  const rows = ((data ?? []) as LookupRow[]).filter((r) => {
    if (isClusters && campusId && r.campus_id !== campusId) return false;
    if (isUnits && campusId && r.cluster?.campus_id !== campusId) return false;
    if (isUnits && clusterId && r.cluster_id !== clusterId) return false;
    return !query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  const setActive = (row: LookupRow, isActive: boolean) =>
    update.mutate(
      { id: row.id, data: { is_active: isActive } },
      {
        onSuccess: () => toast.success(`${row.name} is now ${isActive ? 'active' : 'inactive'}`),
        onError: (err) => toast.error(err.message),
      }
    );

  const parentOf = (r: LookupRow) =>
    isClusters ? r.campus?.name : isUnits ? r.cluster?.name : undefined;

  const columns: Column<LookupRow>[] = [
    {
      key: 'name',
      header: 'Name',
      width: isClusters || isUnits ? 'minmax(0,1.4fr)' : 'minmax(0,2fr)',
      cell: (r) => <NameCell primary={r.name} />,
    },
    ...(isClusters && allCampuses
      ? [
          {
            key: 'campus',
            header: 'Campus',
            width: 'minmax(0,1fr)',
            cell: (r: LookupRow) => <TextCell>{r.campus?.name ?? '—'}</TextCell>,
          },
        ]
      : []),
    ...(isUnits
      ? [
          {
            key: 'cluster',
            header: 'Cluster',
            width: 'minmax(0,1fr)',
            cell: (r: LookupRow) => <TextCell>{r.cluster?.name ?? '—'}</TextCell>,
          },
        ]
      : []),
    ...(isClusters
      ? [
          {
            key: 'units',
            header: 'Units',
            width: '56px',
            align: 'right' as const,
            cell: (r: LookupRow) => <NumberCell value={r._count?.units ?? 0} />,
          },
        ]
      : []),
    {
      key: 'created',
      header: 'Created',
      width: 'minmax(0,1fr)',
      cell: (r) => <TextCell>{formatDate(r.created_at)}</TextCell>,
    },
    {
      key: 'active',
      header: 'Active',
      width: '56px',
      cell: (r) => (
        <Switch
          checked={r.is_active}
          label={`${r.name} active`}
          onChange={(v) => setActive(r, v)}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '72px',
      align: 'right',
      cell: (r) => (
        <RowActions>
          <IconAction
            label="Edit"
            icon={<Pencil size={18} aria-hidden />}
            onClick={() => setEditing(r)}
          />
          <IconAction
            label="Delete"
            icon={<Trash2 size={18} aria-hidden />}
            onClick={() => setDeleting(r)}
          />
        </RowActions>
      ),
    },
  ];

  if (error) {
    return (
      <Card className="p-6 text-[15px] text-[#b42318]">
        The {noun} couldn&apos;t be loaded: {error.message}
      </Card>
    );
  }

  return (
    <>
      <ListCard>
        <ListToolbar>
          <SearchField
            label={`Search ${noun}`}
            placeholder={`Search ${noun}…`}
            value={query}
            onChange={setQuery}
          />
          {isUnits && (
            <FilterSelect
              label="Cluster"
              allLabel="All clusters"
              value={clusterId}
              onChange={setClusterId}
              options={scopedClusters.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
          <ListCount>{plural(rows.length, singular, noun.split(' ').pop()!)}</ListCount>
        </ListToolbar>
        <DataTable
          label={label}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={isPending}
          rowClassName={(r) => (r.is_active ? undefined : 'bg-gray-25')}
          empty={query ? `No ${noun} match “${query}”.` : `No ${noun} yet.`}
          card={(r) => (
            <MobileCard
              title={r.name}
              subtitle={parentOf(r)}
              meta={[
                ...(isClusters
                  ? [
                      {
                        label: 'Units',
                        value: r._count?.units ?? 0,
                        tone: r._count?.units ? ('default' as const) : ('muted' as const),
                      },
                    ]
                  : []),
                { label: 'Created', value: formatDate(r.created_at) },
                {
                  label: 'Status',
                  value: r.is_active ? 'Active' : 'Inactive',
                  tone: r.is_active ? ('green' as const) : ('grey' as const),
                },
              ]}
              actions={[
                {
                  label: 'Edit',
                  icon: <Pencil size={16} aria-hidden />,
                  onClick: () => setEditing(r),
                },
                {
                  label: 'Delete',
                  icon: <Trash2 size={16} aria-hidden />,
                  onClick: () => setDeleting(r),
                  variant: 'danger',
                },
              ]}
            />
          )}
        />
      </ListCard>

      <LookupDrawer
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        table={table}
        singular={singular}
        row={drawer.row}
        clusters={scopedClusters}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`${deleting.name} deleted`);
              setDeleting(null);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={remove.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title={`Delete this ${singular}?`}
        name={deleting?.name}
        body="will be permanently deleted. This cannot be undone."
        warning={deleting ? linkedWarning(deleting) : undefined}
        confirmLabel={`Delete ${singular}`}
      />
    </>
  );
}

type LookupForm = { name: string; is_active: boolean; campus_id?: string; cluster_id?: string };

/** Add / Edit for any lookup table: a name, the parent for clusters and units, and Active. */
function LookupDrawer({
  open,
  onClose,
  table,
  singular,
  row,
  clusters,
}: {
  open: boolean;
  onClose: () => void;
  table: SettingsTable;
  singular: string;
  row: LookupRow | null;
  clusters: LookupRow[];
}) {
  const create = useCreateSetting(table);
  const update = useUpdateSetting(table);

  const save = async (data: LookupForm) => {
    try {
      if (row) {
        await update.mutateAsync({ id: row.id, data });
        toast.success(`${capitalize(singular)} updated`);
      } else {
        await create.mutateAsync(data);
        toast.success(`${data.name} added`);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `The ${singular} could not be saved.`);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title={`${row ? 'Edit' : 'Add'} ${singular}`}
      footer={
        <DrawerButtons>
          <DrawerButton variant="outline" onClick={onClose}>
            Cancel
          </DrawerButton>
          <DrawerButton
            type="submit"
            form="lookup-form"
            loading={create.isPending || update.isPending}
          >
            {row ? `Update ${singular}` : `Create ${singular}`}
          </DrawerButton>
        </DrawerButtons>
      }
    >
      <LookupFormBody
        table={table}
        singular={singular}
        row={row}
        clusters={clusters}
        onSave={save}
      />
    </Drawer>
  );
}

function LookupFormBody({
  table,
  singular,
  row,
  clusters,
  onSave,
}: {
  table: SettingsTable;
  singular: string;
  row: LookupRow | null;
  clusters: LookupRow[];
  onSave: (data: LookupForm) => Promise<void>;
}) {
  const { userProfile } = useAuthStore();
  const isSuperAdmin = userProfile?.user_type?.name === 'Super Admin';
  const campusId = useScopedCampusId();
  const { data: campuses = [] } = useCampus();
  const needsCampus = table === 'clusters';
  const needsCluster = table === 'units';

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LookupForm>({
    resolver: zodResolver(SCHEMAS[table as keyof typeof SCHEMAS] as never),
    defaultValues: {
      name: row?.name ?? '',
      is_active: row?.is_active ?? true,
      ...(needsCampus && {
        campus_id: row?.campus_id ?? (isSuperAdmin ? campusId : (userProfile?.campus_id ?? '')),
      }),
      ...(needsCluster && { cluster_id: row?.cluster_id ?? '' }),
    },
  });

  return (
    <form id="lookup-form" onSubmit={handleSubmit(onSave)} noValidate>
      <DrawerBody>
        <FormGrid>
          <FormField id="lookup-name" label="Name" hint="Required" error={errors.name?.message}>
            <TextInput
              id="lookup-name"
              placeholder={`Enter ${singular} name`}
              autoComplete="off"
              invalid={!!errors.name}
              aria-describedby={errors.name ? 'lookup-name-error' : undefined}
              {...register('name')}
            />
          </FormField>
          {needsCampus && (
            <FormField
              id="lookup-campus"
              label="Campus"
              hint="Required"
              error={errors.campus_id?.message}
              help={!isSuperAdmin ? 'Clusters are added to your campus.' : undefined}
            >
              <Controller
                control={control}
                name="campus_id"
                render={({ field }) => (
                  <SelectField
                    id="lookup-campus"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={campuses
                      .filter((c) => c.is_active || c.id === field.value)
                      .map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Select campus"
                    required
                    disabled={!isSuperAdmin}
                    invalid={!!errors.campus_id}
                    describedBy={errors.campus_id ? 'lookup-campus-error' : undefined}
                  />
                )}
              />
            </FormField>
          )}
          {needsCluster && (
            <FormField
              id="lookup-cluster"
              label="Cluster"
              hint="Required"
              error={errors.cluster_id?.message}
            >
              <Controller
                control={control}
                name="cluster_id"
                render={({ field }) => (
                  <SelectField
                    id="lookup-cluster"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={clusters
                      .filter((c) => c.is_active || c.id === field.value)
                      .map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Select cluster"
                    required
                    invalid={!!errors.cluster_id}
                    describedBy={errors.cluster_id ? 'lookup-cluster-error' : undefined}
                  />
                )}
              />
            </FormField>
          )}
          <div className="md:col-span-2">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <SwitchField
                  id="lookup-active"
                  label="Active"
                  description="Turn off to hide it without deleting it."
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
