'use client';

import type { SettingsTable } from '@/actions/settings';
import {
  Drawer,
  FOCUS_RING,
  SegmentedControl,
  SelectField,
  Switch,
  SwitchField,
  TextInput,
} from '@/components/ds';
import {
  useCampus,
  useCreateSetting,
  useDeleteSetting,
  useSettingsTable,
  useUpdateSetting,
} from '@/components/hooks/use-settings';
import {
  buildingSchema,
  casualtyConditionSchema,
  clusterSchema,
  cn,
  damageConditionSchema,
  positionSchema,
  unitSchema,
} from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, ArrowUpDown, Info, Pencil, Trash2 } from 'lucide-react';
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
  Pager,
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
import { useIsSuperAdmin, useScopedCampusId } from '../../_components/shell/campus-switcher';
import { Card, Mono } from '../../_components/ui';
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
  /** Buildings: the unit they belong to, and their floors. */
  unit_id?: string;
  floor_count?: number;
  unit?: { name: string; cluster_id: string; cluster: { name: string; campus_id: string } };
  _count?: Partial<
    Record<
      | 'units'
      | 'users'
      | 'reports'
      | 'casualties'
      | 'bystander_reports'
      | 'assessments'
      | 'buildings',
      number
    >
  >;
}

const SCHEMAS = {
  clusters: clusterSchema,
  units: unitSchema,
  buildings: buildingSchema,
  positions: positionSchema,
  casualty_conditions: casualtyConditionSchema,
  damage_conditions: damageConditionSchema,
} as const;

/**
 * What the Used by column counts per table (DRRM-040): a row with none of them is unused, so
 * deleting it changes nothing else.
 */
const USED_BY: Partial<
  Record<
    SettingsTable,
    { key: 'users' | 'units' | 'reports' | 'buildings'; one: string; many: string }[]
  >
> = {
  clusters: [
    { key: 'users', one: 'user', many: 'users' },
    { key: 'units', one: 'unit', many: 'units' },
    { key: 'reports', one: 'report', many: 'reports' },
  ],
  units: [
    { key: 'users', one: 'user', many: 'users' },
    { key: 'reports', one: 'report', many: 'reports' },
    { key: 'buildings', one: 'building', many: 'buildings' },
  ],
  positions: [{ key: 'users', one: 'user', many: 'users' }],
};

type UseFilter = 'all' | 'used' | 'unused';

/** How much points at the row, by the table's Used by counts. */
function usedTotal(table: SettingsTable, row: LookupRow) {
  return (USED_BY[table] ?? []).reduce((n, u) => n + (row._count?.[u.key] ?? 0), 0);
}

/** "38 users 210 reports 3 buildings", or an outlined Unused. */
function UsedBy({ table, row }: { table: SettingsTable; row: LookupRow }) {
  const parts = (USED_BY[table] ?? []).filter((u) => (row._count?.[u.key] ?? 0) > 0);
  if (!parts.length) {
    return (
      <span className="inline-flex h-6 items-center rounded-full border border-dashed border-gray-400 px-2.5 text-[13px] font-semibold text-gray-600">
        Unused
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-0.5 text-[15px] leading-[1.4] text-gray-700">
      {parts.map((u) => {
        const n = row._count?.[u.key] ?? 0;
        return (
          <span key={u.key} className="whitespace-nowrap">
            <Mono className="font-bold text-gray-900">{n.toLocaleString()}</Mono>{' '}
            {n === 1 ? u.one : u.many}
          </span>
        );
      })}
    </span>
  );
}

/** "3 units, 12 users and 40 reports are linked to it." — what still points at this row. */
function linkedWarning(row: LookupRow) {
  const c = row._count ?? {};
  const counts = [
    [c.units, 'unit', 'units'],
    [c.users, 'user', 'users'],
    [c.casualties, 'casualty', 'casualties'],
    [c.reports, 'report', 'reports'],
    [c.bystander_reports, 'bystander report', 'bystander reports'],
    [c.assessments, 'assessment', 'assessments'],
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
  const [page, setPage] = useState(1);
  const [use, setUse] = useState<UseFilter>('all');
  // Used by sorts most used first, then least; off keeps the list by name.
  const [sortUsed, setSortUsed] = useState<'none' | 'desc' | 'asc'>('none');
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
  const isBuildings = table === 'buildings';
  const allCampuses = !campusId;
  const scopedClusters = (clusters as LookupRow[]).filter(
    (c) => !campusId || c.campus_id === campusId
  );

  const usage = USED_BY[table];
  const inScope = ((data ?? []) as LookupRow[]).filter((r) => {
    if (isClusters && campusId && r.campus_id !== campusId) return false;
    if (isUnits && campusId && r.cluster?.campus_id !== campusId) return false;
    if (isUnits && clusterId && r.cluster_id !== clusterId) return false;
    if (isBuildings && campusId && r.unit?.cluster.campus_id !== campusId) return false;
    if (isBuildings && clusterId && r.unit?.cluster_id !== clusterId) return false;
    return !query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase());
  });
  const unusedCount = usage ? inScope.filter((r) => usedTotal(table, r) === 0).length : 0;
  const filtered =
    usage && use !== 'all'
      ? inScope.filter((r) => (usedTotal(table, r) === 0) === (use === 'unused'))
      : inScope;
  const rows =
    usage && sortUsed !== 'none'
      ? [...filtered].sort((a, b) =>
          sortUsed === 'desc'
            ? usedTotal(table, b) - usedTotal(table, a)
            : usedTotal(table, a) - usedTotal(table, b)
        )
      : filtered;
  const pickUse = (next: UseFilter) => {
    setUse(next);
    setPage(1);
  };
  const totalPages = Math.max(1, Math.ceil(rows.length / 10));
  const current = Math.min(page, totalPages);
  const shown = rows.slice((current - 1) * 10, current * 10);

  const setActive = (row: LookupRow, isActive: boolean) =>
    update.mutate(
      { id: row.id, data: { is_active: isActive } },
      {
        onSuccess: () => toast.success(`${row.name} is now ${isActive ? 'active' : 'inactive'}`),
        onError: (err) => toast.error(err.message),
      }
    );

  const parentOf = (r: LookupRow) =>
    isClusters
      ? r.campus?.name
      : isUnits
        ? r.cluster?.name
        : isBuildings && r.unit
          ? `${r.unit.name} · ${r.unit.cluster.name}`
          : undefined;

  const columns: Column<LookupRow>[] = [
    {
      key: 'name',
      header: 'Name',
      width: isClusters || isUnits || isBuildings ? 'minmax(0,1.4fr)' : 'minmax(0,2fr)',
      cell: (r) => <NameCell primary={r.name} />,
    },
    ...(isBuildings
      ? [
          {
            key: 'unit',
            header: 'Unit',
            width: 'minmax(0,1.4fr)',
            cell: (r: LookupRow) => (
              <NameCell muted primary={r.unit?.name ?? '—'} secondary={r.unit?.cluster.name} />
            ),
          },
          {
            key: 'floors',
            header: 'Floors',
            width: '64px',
            align: 'right' as const,
            cell: (r: LookupRow) => <NumberCell value={r.floor_count ?? 1} />,
          },
        ]
      : []),
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
    ...(usage
      ? [
          {
            key: 'used-by',
            header: (
              <button
                type="button"
                onClick={() =>
                  setSortUsed((s) => (s === 'none' ? 'desc' : s === 'desc' ? 'asc' : 'none'))
                }
                aria-label={`Used by, ${sortUsed === 'none' ? 'not sorted' : sortUsed === 'desc' ? 'most used first' : 'least used first'}. Change the sort`}
                className={cn(
                  'inline-flex items-center gap-1 rounded font-semibold hover:text-gray-900',
                  sortUsed !== 'none' && 'text-gray-900',
                  FOCUS_RING
                )}
              >
                Used by
                {sortUsed === 'desc' ? (
                  <ArrowDown size={13} aria-hidden />
                ) : sortUsed === 'asc' ? (
                  <ArrowUp size={13} aria-hidden />
                ) : (
                  <ArrowUpDown size={13} aria-hidden className="text-gray-400" />
                )}
              </button>
            ),
            width: 'minmax(0,1.3fr)',
            cell: (r: LookupRow) => <UsedBy table={table} row={r} />,
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
            // Red only when nothing points at it; in use, the dialog says what does.
            tone={usage && usedTotal(table, r) === 0 ? 'danger' : undefined}
          />
        </RowActions>
      ),
    },
  ];

  if (error) {
    return (
      <Card className="p-6 text-[17px] text-error-700">
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
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
          />
          {(isUnits || isBuildings) && (
            <FilterSelect
              label="Cluster"
              allLabel="All clusters"
              value={clusterId}
              onChange={(v) => {
                setClusterId(v);
                setPage(1);
              }}
              options={scopedClusters.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
          {usage ? (
            <div className="ml-auto">
              <span id={`${table}-use-label`} className="sr-only">
                Show
              </span>
              <SegmentedControl
                name={`${table}-use`}
                labelledBy={`${table}-use-label`}
                value={use}
                onChange={(v) => pickUse(v as UseFilter)}
                options={[
                  { value: 'all', label: <UseOption label="All" count={inScope.length} /> },
                  {
                    value: 'used',
                    label: <UseOption label="In use" count={inScope.length - unusedCount} />,
                  },
                  { value: 'unused', label: <UseOption label="Unused" count={unusedCount} /> },
                ]}
              />
            </div>
          ) : (
            <ListCount loading={isPending}>
              {plural(rows.length, singular, noun.split(' ').pop()!)}
            </ListCount>
          )}
        </ListToolbar>
        {usage && unusedCount > 0 && use !== 'unused' && (
          <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-[14px] border border-line bg-gray-25 px-3.5 py-3 text-[15px] leading-[1.45] text-gray-700 md:mx-5">
            <Info size={18} aria-hidden className="mt-0.5 shrink-0 text-gray-500" />
            <p>
              <span className="font-bold text-gray-900">
                {plural(unusedCount, singular, noun.split(' ').pop()!)}{' '}
                {unusedCount === 1 ? 'is' : 'are'} unused
              </span>
              : no{' '}
              {listNames(
                usage.map((u) => u.many),
                'or'
              )}{' '}
              point at {unusedCount === 1 ? 'it' : 'them'}, so deleting{' '}
              {unusedCount === 1 ? 'it' : 'them'} changes nothing else.{' '}
              <button
                type="button"
                onClick={() => pickUse('unused')}
                className={cn(
                  'text-brand-500 rounded font-semibold underline decoration-2 underline-offset-3 hover:text-brand-600',
                  FOCUS_RING
                )}
              >
                Show unused
              </button>
            </p>
          </div>
        )}
        <DataTable
          label={label}
          columns={columns}
          rows={shown}
          rowKey={(r) => r.id}
          loading={isPending}
          rowClassName={(r) => (r.is_active ? undefined : 'bg-gray-25')}
          empty={query ? `No ${noun} match “${query}”.` : `No ${noun} yet.`}
          card={(r) => (
            <MobileCard
              title={r.name}
              subtitle={parentOf(r)}
              meta={[
                ...(usage ? [{ label: 'Used by', value: <UsedBy table={table} row={r} /> }] : []),
                ...(isBuildings ? [{ label: 'Floors', value: r.floor_count ?? 1 }] : []),
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
        <Pager page={current} totalPages={totalPages} onChange={setPage} />
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

type LookupForm = {
  name: string;
  is_active: boolean;
  campus_id?: string;
  cluster_id?: string;
  unit_id?: string;
  floor_count?: number;
};

/** Add / Edit for any lookup table: a name, the parent for clusters, units and buildings, a
 * building's floors, and Active. */
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
  const isSuperAdmin = useIsSuperAdmin();
  // The top-bar campus for super admins; an administrator's own campus.
  const campusId = useScopedCampusId();
  const { data: campuses = [] } = useCampus();
  const needsCampus = table === 'clusters';
  const needsCluster = table === 'units';
  const isBuilding = table === 'buildings';
  const { data: allUnits = [] } = useSettingsTable('units');
  // A building moves between the campus's units; "Unit · Cluster" tells same-named units apart.
  const unitOptions = (allUnits as LookupRow[])
    .filter((u) => !campusId || u.cluster?.campus_id === campusId)
    .filter((u) => u.is_active || u.id === row?.unit_id)
    .map((u) => ({ value: u.id, label: `${u.name} · ${u.cluster?.name ?? ''}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

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
        campus_id: row?.campus_id ?? campusId,
      }),
      ...(needsCluster && { cluster_id: row?.cluster_id ?? '' }),
      ...(isBuilding && { unit_id: row?.unit_id ?? '', floor_count: row?.floor_count ?? 1 }),
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
          {/* Administrators add clusters to their own campus. */}
          {needsCampus && isSuperAdmin && (
            <FormField
              id="lookup-campus"
              label="Campus"
              hint="Required"
              error={errors.campus_id?.message}
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
          {isBuilding && (
            <>
              <FormField
                id="lookup-unit"
                label="College / Department / Unit"
                hint="Required"
                error={errors.unit_id?.message}
              >
                <Controller
                  control={control}
                  name="unit_id"
                  render={({ field }) => (
                    <SelectField
                      id="lookup-unit"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={unitOptions}
                      placeholder="Select unit"
                      required
                      invalid={!!errors.unit_id}
                      describedBy={errors.unit_id ? 'lookup-unit-error' : undefined}
                    />
                  )}
                />
              </FormField>
              <FormField
                id="lookup-floors"
                label="Floors"
                hint="Required"
                error={errors.floor_count?.message}
              >
                <TextInput
                  id="lookup-floors"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={200}
                  step={1}
                  invalid={!!errors.floor_count}
                  aria-describedby={errors.floor_count ? 'lookup-floors-error' : undefined}
                  {...register('floor_count')}
                />
              </FormField>
            </>
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

/** A segment's label with its count. */
function UseOption({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {label}
      <Mono className="text-[13px] font-semibold text-gray-500">{count}</Mono>
    </span>
  );
}

/** "users, reports or buildings". */
function listNames(names: string[], joiner: string) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}`;
}
