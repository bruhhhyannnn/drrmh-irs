'use client';

import { FOCUS_RING } from '@/components/ds';
import { useBuildingSummaries } from '@/components/hooks/use-assessments';
import { cn } from '@/lib';
import type { BuildingScores } from '@/lib/assessment-template';
import { ChevronDown } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { FilterSelect, ListToolbar } from '../../_components/data-list';
import { useScopedCampusId } from '../../_components/shell/campus-switcher';
import { EmptyNote, Skeleton } from '../../_components/ui';
import { BuildingCompareView } from '../../dashboard/_components/building-safety/building-level';

function BuildingPicker({
  buildings,
  selected,
  onSelect,
}: {
  buildings: BuildingScores[];
  selected: BuildingScores | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        id="compare-building"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-13 w-full items-center gap-3 rounded-2xl border border-gray-300 bg-surface px-4 py-2 text-left hover:bg-gray-50',
          FOCUS_RING
        )}
      >
        {selected ? (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[15px] font-semibold text-gray-900">
                {selected.name}
              </span>
              <span className="font-landing-mono shrink-0 text-[14px] font-semibold text-gray-500">
                ({selected.assessment_count})
              </span>
            </div>
            <span className="truncate text-[13px] text-gray-500">{selected.unit.name}</span>
          </div>
        ) : (
          <span className="flex-1 text-[15px] text-gray-500">Select a building</span>
        )}
        <ChevronDown size={18} aria-hidden className="shrink-0 text-gray-500" />
      </button>

      {open && (
        <>
          <div aria-hidden className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            id={listId}
            role="listbox"
            aria-label="Select a building"
            className="absolute top-[calc(100%+6px)] left-0 z-50 flex max-h-[min(420px,70dvh)] w-full min-w-72 flex-col overflow-y-auto rounded-[18px] border border-gray-200 bg-surface p-1.5 shadow-[0_18px_40px_rgba(16,24,40,.22)]"
          >
            {buildings.map((b) => {
              const on = b.id === selected?.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(b.id)}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-xl px-3 py-2 text-left',
                    on ? 'bg-brand-25' : 'hover:bg-gray-50',
                    FOCUS_RING
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        'min-w-0 truncate text-[15px]',
                        on ? 'text-brand-500 font-bold' : 'font-semibold text-gray-900'
                      )}
                    >
                      {b.name}
                    </span>
                    <span
                      className={cn(
                        'font-landing-mono shrink-0 text-[14px] font-semibold',
                        on ? 'text-brand-500' : 'text-gray-500'
                      )}
                    >
                      ({b.assessment_count})
                    </span>
                  </div>
                  <span className="truncate text-[13px] text-gray-500">{b.unit.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Compare a building's assessments (history line + A/B side-by-side) right on /assessments. */
export function CompareTab() {
  const campusId = useScopedCampusId();
  const { data = [], isPending, error } = useBuildingSummaries(campusId);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [clusterId, setClusterId] = useState('');

  if (isPending) {
    return (
      <div className="p-5">
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (error) {
    return <EmptyNote>The buildings couldn&apos;t be loaded: {error.message}</EmptyNote>;
  }

  const clusters = [...new Map(data.map((b) => [b.cluster.id, b.cluster])).values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const buildings = clusterId ? data.filter((b) => b.cluster.id === clusterId) : data;
  const requestedId = params.get('building');
  const selected =
    buildings.find((b) => b.id === requestedId) ??
    buildings.find((b) => b.assessment_count >= 2) ??
    buildings.find((b) => b.assessment_count > 0) ??
    buildings[0] ??
    null;

  const setParams = (next: { building?: string | null; a?: string | null; b?: string | null }) => {
    const p = new URLSearchParams(params.toString());
    p.set('tab', 'compare');
    if ('building' in next) {
      if (next.building) p.set('building', next.building);
      else p.delete('building');
      p.delete('a');
      p.delete('b');
    }
    if ('a' in next) {
      if (next.a) p.set('a', next.a);
      else p.delete('a');
    }
    if ('b' in next) {
      if (next.b) p.set('b', next.b);
      else p.delete('b');
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  if (data.length === 0) {
    return <EmptyNote>No buildings yet. ERT members add them when they assess one.</EmptyNote>;
  }

  return (
    <div className="flex flex-col">
      <ListToolbar>
        <div className="min-w-0 flex-[1_1_260px]">
          <BuildingPicker
            buildings={buildings}
            selected={selected}
            onSelect={(id) => setParams({ building: id })}
          />
        </div>
        <FilterSelect
          label="Cluster"
          allLabel="All clusters"
          value={clusterId}
          onChange={setClusterId}
          options={clusters.map((c) => ({ value: c.id, label: c.name }))}
        />
      </ListToolbar>

      <div className="flex flex-col gap-5 border-t border-line p-4.5 md:p-6">
        {!selected ? (
          <EmptyNote>No buildings in this cluster.</EmptyNote>
        ) : (
          <BuildingCompareView
            buildingId={selected.id}
            aId={selected.id === requestedId ? params.get('a') : null}
            bId={selected.id === requestedId ? params.get('b') : null}
            onPick={(a, b) => setParams({ building: selected.id, a, b })}
          />
        )}
      </div>
    </div>
  );
}
