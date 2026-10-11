'use client';

import {
  Button,
  Drawer,
  FOCUS_RING,
  Switch,
  SwitchField,
  TextArea,
  TextInput,
} from '@/components/ds';
import { useCampuses } from '@/components/hooks/use-campus';
import {
  useAddCampusPopulationCategory,
  useCampusPopulationCategoryAssignments,
  useCampusPopulationCategoryCounts,
  useCreatePopulationCategory,
  useDeleteCampusPopulationCategory,
  usePopulationCategories,
  useReorderCampusPopulationCategories,
  useUpdateCampusPopulationCategory,
  useUpdatePopulationCategory,
} from '@/components/hooks/use-population-categories';
import { cn, populationCategorySchema, type PopulationCategoryFormData } from '@/lib';
import { zodResolver } from '@hookform/resolvers/zod';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import {
  GRID_ROW,
  gridTracks,
  IconAction,
  ListCard,
  ListTabs,
  MobileCard,
  NameCell,
  RowActions,
  TableCell,
  TableHead,
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
import { Chip, Mono, Skeleton } from '../../_components/ui';
import { plural } from '../../_lib/format';

type Assignment = NonNullable<
  ReturnType<typeof useCampusPopulationCategoryAssignments>['data']
>[number];

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || `field_${Date.now()}`;
}

/**
 * One campus at a time, picked from tabs with field counts. Rows are dragged by their handle
 * (mouse, pen or touch) or moved with the arrow keys; the order is the order of the headcount
 * fields in the ERT and bystander forms, and it is saved on drop.
 */
export function PopulationFields() {
  const scopedId = useScopedCampusId();
  const { data: campuses = [], isPending } = useCampuses();
  const { data: counts = [] } = useCampusPopulationCategoryCounts();
  const [picked, setPicked] = useState('');

  const active = campuses.filter((c) => c.is_active);
  const countFor = (id: string) => counts.find((c) => c.campus_id === id)?.count ?? 0;
  const campusId =
    (picked && active.some((c) => c.id === picked) && picked) ||
    (scopedId && active.some((c) => c.id === scopedId) && scopedId) ||
    active.find((c) => countFor(c.id) > 0)?.id ||
    active[0]?.id ||
    '';

  if (isPending) return <Skeleton className="h-96" />;
  if (!active.length) {
    return (
      <ListCard>
        <p className="px-5 py-12 text-center text-[14px] text-gray-500">
          Add a campus first. Each campus keeps its own headcount fields.
        </p>
      </ListCard>
    );
  }

  return (
    <ListCard>
      <ListTabs
        label="Campus"
        value={campusId}
        onChange={setPicked}
        tabs={active.map((c) => ({ key: c.id, label: c.name, count: countFor(c.id) }))}
      />
      <CampusFields
        key={campusId}
        campusId={campusId}
        campusName={active.find((c) => c.id === campusId)?.name ?? 'this campus'}
      />
    </ListCard>
  );
}

function CampusFields({ campusId, campusName }: { campusId: string; campusName: string }) {
  const { data: assignments = [], isPending } = useCampusPopulationCategoryAssignments(campusId);
  const { data: categories = [] } = usePopulationCategories();
  const reorder = useReorderCampusPopulationCategories(campusId);
  const updateLink = useUpdateCampusPopulationCategory(campusId);
  const removeLink = useDeleteCampusPopulationCategory(campusId);
  const addLink = useAddCampusPopulationCategory(campusId);
  const createCategory = useCreatePopulationCategory();
  const [fieldName, setFieldName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [removing, setRemoving] = useState<Assignment | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const tableRows = useRef<(HTMLDivElement | null)[]>([]);
  const cardRows = useRef<(HTMLLIElement | null)[]>([]);

  const assignedIds = new Set(assignments.map((a) => a.category_id));
  const suggestions = categories.filter((c) => c.is_active && !assignedIds.has(c.id));

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= assignments.length) return;
    const ids = assignments.map((a) => a.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    reorder.mutate(ids, { onError: () => toast.error('The new order could not be saved.') });
    setAnnouncement(
      `${assignments[from].category.name} moved to position ${to + 1} of ${ids.length}.`
    );
  };

  /** The row under the pointer, from whichever list (table or cards) is on screen. */
  const rowAt = (clientY: number) => {
    const visible = [tableRows.current, cardRows.current].find((list) => list[0]?.offsetParent);
    if (!visible) return null;
    for (let i = 0; i < visible.length; i++) {
      const rect = visible[i]?.getBoundingClientRect();
      if (rect && clientY < rect.top + rect.height / 2) return i;
    }
    return visible.length - 1;
  };

  const handleProps = (index: number, name: string) => ({
    type: 'button' as const,
    'aria-label': `Move ${name}, position ${index + 1} of ${assignments.length}`,
    title: 'Drag to reorder, or use the arrow keys',
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ from: index, over: index });
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag) return;
      const over = rowAt(e.clientY);
      if (over !== null && over !== drag.over) setDrag({ ...drag, over });
    },
    onPointerUp: () => {
      if (drag) move(drag.from, drag.over);
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        move(index, index + (e.key === 'ArrowUp' ? -1 : 1));
      }
    },
  });

  /** The drop line: under the target when moving down, over it when moving up. */
  const dropStyle = (index: number) => {
    if (!drag || drag.over !== index || drag.from === index) return undefined;
    return { boxShadow: drag.from < index ? 'inset 0 -3px 0 #a11d1d' : 'inset 0 3px 0 #a11d1d' };
  };

  const add = async () => {
    const name = fieldName.trim();
    if (!name) return;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing && assignedIds.has(existing.id)) {
      toast.error(`${name} is already one of ${campusName}'s fields.`);
      return;
    }
    setAdding(true);
    try {
      const categoryId =
        existing?.id ?? (await createCategory.mutateAsync({ code: slugify(name), name })).id;
      await addLink.mutateAsync(categoryId);
      setFieldName('');
      toast.success(`${name} added to ${campusName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The field could not be added.');
    } finally {
      setAdding(false);
    }
  };

  const columns: Column<Assignment>[] = [
    { key: 'order', header: 'Order', width: '96px', cell: () => null },
    { key: 'field', header: 'Field', width: 'minmax(0,1.4fr)', cell: () => null },
    { key: 'code', header: 'Code', width: 'minmax(0,1.2fr)', hideOnTablet: true, cell: () => null },
    { key: 'required', header: 'Required', width: '68px', cell: () => null },
    { key: 'status', header: 'Status', width: '88px', hideOnTablet: true, cell: () => null },
    { key: 'actions', header: '', width: '72px', align: 'right', cell: () => null },
  ];
  const isActive = (a: Assignment) => a.is_active && a.category.is_active;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 md:px-5">
        <span className="text-[13px] font-medium text-pretty text-gray-500">
          {assignments.length
            ? `${plural(assignments.length, 'field', 'fields')}, in the order ERT members see them. Drag a row by its handle to move it.`
            : `${campusName} has no fields yet, so ERT headcount has nothing to fill in. Add the first one below.`}
        </span>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {isPending ? (
        <div className="flex flex-col gap-2 px-4 pb-4 md:px-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        assignments.length > 0 && (
          <>
            <div
              role="table"
              aria-label={`${campusName} population fields`}
              className="hidden md:block"
            >
              <TableHead columns={columns} />
              {assignments.map((a, i) => (
                <div
                  key={a.id}
                  ref={(el) => {
                    tableRows.current[i] = el;
                  }}
                  role="row"
                  style={{ ...gridTracks(columns), ...dropStyle(i) }}
                  className={cn(
                    GRID_ROW,
                    'min-h-16 border-b border-[#eaecf0] py-2.5',
                    drag?.from === i && 'opacity-45',
                    !isActive(a) && 'bg-gray-25'
                  )}
                >
                  <TableCell column={columns[0]}>
                    <div className="flex items-center gap-1.5">
                      <button
                        {...handleProps(i, a.category.name)}
                        className={cn(
                          'grid h-9 w-7.5 cursor-grab touch-none place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing',
                          FOCUS_RING
                        )}
                      >
                        <GripVertical size={18} aria-hidden />
                      </button>
                      <Mono className="text-[13px] font-semibold text-gray-600">{i + 1}</Mono>
                    </div>
                  </TableCell>
                  <TableCell column={columns[1]}>
                    <NameCell
                      primary={a.category.name}
                      secondary={
                        <span className="font-landing-mono lg:hidden">{a.category.code}</span>
                      }
                    />
                  </TableCell>
                  <TableCell column={columns[2]}>
                    <Mono className="truncate text-[14px] font-semibold text-gray-600">
                      {a.category.code}
                    </Mono>
                  </TableCell>
                  <TableCell column={columns[3]}>
                    <Switch
                      checked={a.is_required}
                      label={`${a.category.name} required`}
                      onChange={(v) => updateLink.mutate({ id: a.id, data: { is_required: v } })}
                    />
                  </TableCell>
                  <TableCell column={columns[4]}>
                    <Chip tone={isActive(a) ? 'green' : 'grey'} dot>
                      {isActive(a) ? 'Active' : 'Inactive'}
                    </Chip>
                  </TableCell>
                  <TableCell column={columns[5]}>
                    <RowActions>
                      <IconAction
                        label="Edit field"
                        icon={<Pencil size={18} aria-hidden />}
                        onClick={() => setEditing({ open: true, id: a.category_id })}
                      />
                      <IconAction
                        label={`Remove from ${campusName}`}
                        icon={<Trash2 size={18} aria-hidden />}
                        onClick={() => setRemoving(a)}
                      />
                    </RowActions>
                  </TableCell>
                </div>
              ))}
            </div>

            <ul
              aria-label={`${campusName} population fields`}
              className="flex flex-col gap-2.5 px-3 pb-3 md:hidden"
            >
              {assignments.map((a, i) => (
                <li
                  key={a.id}
                  ref={(el) => {
                    cardRows.current[i] = el;
                  }}
                  style={dropStyle(i)}
                  className={cn('rounded-[18px]', drag?.from === i && 'opacity-45')}
                >
                  <MobileCard
                    handle={
                      <button
                        {...handleProps(i, a.category.name)}
                        className={cn(
                          '-my-2.5 -mr-1 -ml-2 grid h-11 w-7 shrink-0 cursor-grab touch-none place-items-center text-gray-500',
                          FOCUS_RING
                        )}
                      >
                        <GripVertical size={18} aria-hidden />
                      </button>
                    }
                    title={`${i + 1}. ${a.category.name}`}
                    subtitle={<Mono>{a.category.code}</Mono>}
                    meta={[
                      { label: 'Required', value: a.is_required ? 'Yes' : 'No' },
                      {
                        label: 'Status',
                        value: isActive(a) ? 'Active' : 'Inactive',
                        tone: isActive(a) ? 'green' : 'grey',
                      },
                    ]}
                    actions={[
                      {
                        label: 'Edit',
                        icon: <Pencil size={16} aria-hidden />,
                        onClick: () => setEditing({ open: true, id: a.category_id }),
                      },
                      {
                        label: 'Remove',
                        icon: <Trash2 size={16} aria-hidden />,
                        onClick: () => setRemoving(a),
                        variant: 'danger',
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </>
        )
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        className="flex flex-wrap items-center gap-2.5 rounded-b-[22px] border-t border-[#eaecf0] bg-gray-50 px-4 py-4 md:px-5"
      >
        <label htmlFor="new-field" className="sr-only">
          New or existing field name
        </label>
        <TextInput
          id="new-field"
          list={`fields-${campusId}`}
          placeholder="New or existing field name…"
          autoComplete="off"
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
          className="h-11 min-w-0 flex-[1_1_220px] rounded-[14px] text-[14px]"
        />
        <datalist id={`fields-${campusId}`}>
          {suggestions.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          loading={adding}
          disabled={!fieldName.trim()}
        >
          <Plus size={16} aria-hidden />
          Add field
        </Button>
      </form>

      <FieldDrawer
        open={editing.open}
        categoryId={editing.id}
        onClose={() => setEditing((e) => ({ ...e, open: false }))}
      />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          removeLink.mutate(removing.id, {
            onSuccess: () => {
              toast.success(`${removing.category.name} removed from ${campusName}`);
              setRemoving(null);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={removeLink.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title={`Remove this field from ${campusName}?`}
        name={removing?.category.name}
        body={`will no longer be asked in ${campusName}'s headcount. Reports that already counted it keep their numbers.`}
        confirmLabel="Remove field"
      />
    </>
  );
}

/** Edit field: shared by every campus that uses it. Required stays per campus, in the table. */
function FieldDrawer({
  open,
  categoryId,
  onClose,
}: {
  open: boolean;
  categoryId: string;
  onClose: () => void;
}) {
  const { data: categories = [] } = usePopulationCategories();
  const update = useUpdatePopulationCategory();
  const category = categories.find((c) => c.id === categoryId);

  const save = async (data: PopulationCategoryFormData) => {
    try {
      // The code is fixed once created: reports and the legacy headcount columns use it.
      const { code: _code, ...rest } = data;
      await update.mutateAsync({
        id: categoryId,
        data: { ...rest, description: rest.description ?? '' },
      });
      toast.success('Field updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The field could not be saved.');
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title="Edit field"
      subtitle="Shared by every campus that uses this field."
      footer={
        <DrawerButtons>
          <DrawerButton variant="outline" onClick={onClose}>
            Cancel
          </DrawerButton>
          <DrawerButton type="submit" form="field-form" loading={update.isPending}>
            Update field
          </DrawerButton>
        </DrawerButtons>
      }
    >
      {category ? <FieldForm category={category} onSave={save} /> : <Skeleton className="h-60" />}
    </Drawer>
  );
}

function FieldForm({
  category,
  onSave,
}: {
  category: { code: string; name: string; description: string | null; is_active: boolean };
  onSave: (data: PopulationCategoryFormData) => Promise<void>;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PopulationCategoryFormData>({
    resolver: zodResolver(populationCategorySchema),
    defaultValues: {
      code: category.code,
      name: category.name,
      description: category.description ?? '',
      is_active: category.is_active,
    },
  });
  return (
    <form id="field-form" onSubmit={handleSubmit(onSave)} noValidate>
      <DrawerBody>
        <FormGrid>
          <FormField id="field-name" label="Name" hint="Required" error={errors.name?.message}>
            <TextInput
              id="field-name"
              autoComplete="off"
              invalid={!!errors.name}
              aria-describedby={errors.name ? 'field-name-error' : undefined}
              {...register('name')}
            />
          </FormField>
          <FormField
            id="field-code"
            label="Code"
            hint="Required"
            help="Lowercase with underscores, e.g. dormitory_residents. It can't be changed once created."
          >
            <TextInput
              id="field-code"
              disabled
              className="font-landing-mono"
              {...register('code')}
            />
          </FormField>
          <FormField id="field-description" label="Description" hint="Optional">
            <TextArea
              id="field-description"
              placeholder="Optional notes about this field"
              {...register('description')}
            />
          </FormField>
          <div className="md:col-span-2">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <SwitchField
                  id="field-active"
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
