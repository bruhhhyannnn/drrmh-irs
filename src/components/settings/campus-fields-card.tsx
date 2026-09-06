'use client';

import {
  useAddCampusPopulationCategory,
  useCampusPopulationCategoryAssignments,
  useCreatePopulationCategory,
  useDeleteCampusPopulationCategory,
  useReorderCampusPopulationCategories,
  useUpdateCampusPopulationCategory,
} from '@/components/hooks/use-population-categories';
import { Badge, Button, Checkbox, ConfirmDialog, Input, Modal } from '@/components/ui';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PopulationCategoryForm } from './population-category-form';

type Category = { id: string; code: string; name: string; is_active: boolean };

interface CampusFieldsCardProps {
  campusId: string;
  campusName: string;
  categories: Category[];
}

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || `field_${Date.now()}`;
}

export function CampusFieldsCard({ campusId, campusName, categories }: CampusFieldsCardProps) {
  const { data: assignments, isPending } = useCampusPopulationCategoryAssignments(campusId);
  const addMutation = useAddCampusPopulationCategory(campusId);
  const createCategoryMutation = useCreatePopulationCategory();
  const updateLinkMutation = useUpdateCampusPopulationCategory(campusId);
  const deleteMutation = useDeleteCampusPopulationCategory(campusId);
  const reorderMutation = useReorderCampusPopulationCategories(campusId);

  const [fieldName, setFieldName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteAssignmentId, setDeleteAssignmentId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  const assignedIds = useMemo(
    () => new Set((assignments ?? []).map((a) => a.category_id)),
    [assignments]
  );

  // Categories not yet on this campus — suggested via the datalist so an admin can
  // reuse a name that already exists elsewhere instead of accidentally duplicating it.
  const availableToAdd = useMemo(
    () => categories.filter((c) => c.is_active && !assignedIds.has(c.id)),
    [categories, assignedIds]
  );

  const handleAdd = async () => {
    const trimmed = fieldName.trim();
    if (!trimmed) return;

    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing && assignedIds.has(existing.id)) {
      toast.error(`"${trimmed}" is already added to ${campusName}.`);
      return;
    }

    setIsAdding(true);
    try {
      const categoryId = existing
        ? existing.id
        : (await createCategoryMutation.mutateAsync({ code: slugify(trimmed), name: trimmed })).id;
      await addMutation.mutateAsync(categoryId);
      setFieldName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add field');
    } finally {
      setIsAdding(false);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    if (!assignments) return;
    const target = index + direction;
    if (target < 0 || target >= assignments.length) return;
    const reordered = [...assignments];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderMutation.mutate(reordered.map((a) => a.id));
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">{campusName}</h4>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase dark:border-gray-800">
              <th className="py-2 pr-3 font-medium">Order</th>
              <th className="py-2 pr-3 font-medium">Field</th>
              <th className="py-2 pr-3 font-medium">Code</th>
              <th className="py-2 pr-3 font-medium">Active</th>
              <th className="py-2 pr-3 font-medium">Required</th>
              <th className="py-2 pr-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : !assignments?.length ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-400">
                  No fields assigned yet
                </td>
              </tr>
            ) : (
              assignments.map((a, index) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-50 last:border-0 dark:border-gray-800/60"
                >
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <button
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-white"
                        disabled={index === 0 || reorderMutation.isPending}
                        onClick={() => handleMove(index, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-white"
                        disabled={index === assignments.length - 1 || reorderMutation.isPending}
                        onClick={() => handleMove(index, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-medium text-gray-800 dark:text-white/90">
                    {a.category.name}
                  </td>
                  <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{a.category.code}</td>
                  <td className="py-2 pr-3">
                    <Badge color={a.category.is_active ? 'success' : 'error'} size="sm">
                      {a.category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <Checkbox
                      checked={a.is_required}
                      disabled={updateLinkMutation.isPending}
                      onChange={(e) =>
                        updateLinkMutation.mutate({
                          id: a.id,
                          data: { is_required: e.target.checked },
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-3">
                      <button
                        title="Edit this category"
                        className="hover:text-brand-500 text-gray-400"
                        onClick={() => setEditCategoryId(a.category.id)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        title="Delete this field from this campus"
                        className="hover:text-error-500 text-gray-400"
                        onClick={() => setDeleteAssignmentId(a.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            placeholder="New or existing field name..."
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            list={`available-categories-${campusId}`}
          />
          <datalist id={`available-categories-${campusId}`}>
            {availableToAdd.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!fieldName.trim()}
          isLoading={isAdding}
          startIcon={<Plus size={14} />}
        >
          Add
        </Button>
      </div>

      <ConfirmDialog
        isOpen={!!deleteAssignmentId}
        onClose={() => setDeleteAssignmentId('')}
        onConfirm={() =>
          deleteMutation.mutate(deleteAssignmentId, {
            onSuccess: () => setDeleteAssignmentId(''),
            onError: (err) => toast.error(err.message),
          })
        }
        title="Remove field from campus"
        message="This field will be removed from this campus's report form. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />

      <Modal isOpen={!!editCategoryId} onClose={() => setEditCategoryId('')}>
        <PopulationCategoryForm
          editId={editCategoryId}
          onSuccess={() => setEditCategoryId('')}
          onCancel={() => setEditCategoryId('')}
        />
      </Modal>
    </div>
  );
}
