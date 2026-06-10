'use client';

import { Button, Input, Modal, Select } from '@/components/ui';
import { type CasualtyFormData, type MissingPersonFormData } from '@/lib';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export type CasualtyRow = CasualtyFormData & { id?: string };
export type MissingPersonRow = MissingPersonFormData & { id?: string };

// ─── Missing Person Modal ─────────────────────────────────────────────────────
export interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  persons: MissingPersonRow[];
  onSave: (persons: MissingPersonRow[]) => void;
}

export function PersonModal({ isOpen, onClose, persons, onSave }: PersonModalProps) {
  const [list, setList] = useState<MissingPersonRow[]>([]);
  const [draft, setDraft] = useState<MissingPersonRow>({ name: '', age: 0, sex: 'unknown' });

  useEffect(() => {
    if (isOpen) {
      setList(persons);
      setDraft({ name: '', age: 0, sex: 'unknown' });
    }
  }, [isOpen]);

  const addPerson = () => {
    if (!draft.name.trim()) return;
    setList((l) => [...l, { ...draft }]);
    setDraft({ name: '', age: 0, sex: 'unknown' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-md">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">
        Missing Persons
      </h3>

      {list.length > 0 && (
        <div className="mb-4 max-h-52 space-y-2 overflow-y-auto">
          {list.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                  {p.name || <span className="italic text-gray-400">Unnamed</span>}
                </p>
                <p className="text-xs capitalize text-gray-400">
                  {p.sex} · {p.age} yrs
                </p>
              </div>
              <button
                type="button"
                onClick={() => setList((l) => l.filter((_, idx) => idx !== i))}
                className="hover:text-error-500 ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`space-y-3 ${list.length > 0 ? 'border-t border-gray-100 pt-4 dark:border-white/5' : ''}`}
      >
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Add a person</p>
        <Input
          label="Full Name"
          placeholder="Full name"
          value={draft.name}
          onChange={(e) => setDraft((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="Age"
            min={0}
            placeholder="0"
            className="placeholder:text-gray-800 dark:placeholder:text-gray-200"
            value={draft.age === 0 ? '' : draft.age}
            onKeyDown={(e) => {
              if (e.key === '-') e.preventDefault();
            }}
            onChange={(e) => {
              const val = e.target.value;
              const parsed = val === '' ? 0 : parseInt(val, 10);
              setDraft((f) => ({ ...f, age: Math.max(0, parsed) }));
            }}
          />
          <Select
            label="Sex"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unknown', label: 'Unknown' },
            ]}
            value={draft.sex}
            onChange={(e) =>
              setDraft((f) => ({ ...f, sex: e.target.value as MissingPersonRow['sex'] }))
            }
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPerson}
          startIcon={<Plus size={13} />}
          className="w-full"
        >
          Add Person
        </Button>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onSave(list);
            onClose();
          }}
        >
          Done{list.length > 0 && ` (${list.length})`}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Casualty Modal ───────────────────────────────────────────────────────────
export interface CasualtyModalProps {
  isOpen: boolean;
  onClose: () => void;
  casualties: CasualtyRow[];
  conditionOptions: { value: string; label: string }[];
  onSave: (casualties: CasualtyRow[]) => void;
}

export function CasualtyModal({
  isOpen,
  onClose,
  casualties,
  conditionOptions,
  onSave,
}: CasualtyModalProps) {
  const [list, setList] = useState<CasualtyRow[]>([]);
  const [draft, setDraft] = useState<CasualtyRow>({
    condition_id: '',
    name: '',
    age: 0,
    sex: 'unknown',
  });

  useEffect(() => {
    if (isOpen) {
      setList(casualties);
      setDraft({ condition_id: '', name: '', age: 0, sex: 'unknown' });
    }
  }, [isOpen]);

  const addCasualty = () => {
    if (!draft.condition_id || !draft.name.trim()) return;
    setList((l) => [...l, { ...draft }]);
    setDraft({ condition_id: '', name: '', age: 0, sex: 'unknown' });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-md">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">
        Casualty Details
      </h3>

      {list.length > 0 && (
        <div className="mb-4 max-h-52 space-y-2 overflow-y-auto">
          {list.map((c, i) => {
            const condLabel = conditionOptions.find((o) => o.value === c.condition_id)?.label ?? '';
            return (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {c.name || <span className="italic text-gray-400">Unnamed</span>}
                  </p>
                  <p className="text-xs capitalize text-gray-400">
                    {condLabel} · {c.sex} · {c.age} yrs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setList((l) => l.filter((_, idx) => idx !== i))}
                  className="hover:text-error-500 ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`space-y-3 ${list.length > 0 ? 'border-t border-gray-100 pt-4 dark:border-white/5' : ''}`}
      >
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Add a casualty</p>
        <Select
          label="Condition"
          placeholder="Select condition..."
          options={conditionOptions}
          value={draft.condition_id}
          onChange={(e) => setDraft((f) => ({ ...f, condition_id: e.target.value }))}
        />
        <Input
          label="Full Name"
          placeholder="Full name"
          value={draft.name}
          onChange={(e) => setDraft((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="Age"
            min={0}
            placeholder="0"
            className="placeholder:text-gray-800 dark:placeholder:text-gray-200"
            value={draft.age === 0 ? '' : draft.age}
            onKeyDown={(e) => {
              if (e.key === '-') e.preventDefault();
            }}
            onChange={(e) => {
              const val = e.target.value;
              const parsed = val === '' ? 0 : parseInt(val, 10);
              setDraft((f) => ({ ...f, age: Math.max(0, parsed) }));
            }}
          />
          <Select
            label="Sex"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'unknown', label: 'Unknown' },
            ]}
            value={draft.sex}
            onChange={(e) => setDraft((f) => ({ ...f, sex: e.target.value as CasualtyRow['sex'] }))}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCasualty}
          startIcon={<Plus size={13} />}
          className="w-full"
        >
          Add Casualty
        </Button>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onSave(list);
            onClose();
          }}
        >
          Done{list.length > 0 && ` (${list.length})`}
        </Button>
      </div>
    </Modal>
  );
}
