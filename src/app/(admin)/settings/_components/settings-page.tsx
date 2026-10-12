'use client';

import type { SettingsTable } from '@/actions/settings';
import { Button, FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '../../_components/page-header';
import { LookupTable } from './lookup-table';
import { PopulationFields } from './population-fields';

type SettingsTab =
  | 'clusters'
  | 'units'
  | 'positions'
  | 'casualty-conditions'
  | 'damage-conditions'
  | 'population-fields';

/**
 * The lookup tables behind the report, event and user forms. Every table shares one
 * implementation (LookupTable + actions/settings); a new lookup table is one more entry here.
 */
const LOOKUPS: Record<
  Exclude<SettingsTab, 'population-fields'>,
  { table: SettingsTable; label: string; singular: string; noun: string }
> = {
  clusters: { table: 'clusters', label: 'Clusters', singular: 'cluster', noun: 'clusters' },
  units: { table: 'units', label: 'Units', singular: 'unit', noun: 'units' },
  positions: { table: 'positions', label: 'Positions', singular: 'position', noun: 'positions' },
  'casualty-conditions': {
    table: 'casualty_conditions',
    label: 'Casualty conditions',
    singular: 'condition',
    noun: 'casualty conditions',
  },
  'damage-conditions': {
    table: 'damage_conditions',
    label: 'Damage conditions',
    singular: 'condition',
    noun: 'damage conditions',
  },
};

const TABS: { key: SettingsTab; label: string }[] = [
  ...Object.entries(LOOKUPS).map(([key, l]) => ({ key: key as SettingsTab, label: l.label })),
  { key: 'population-fields', label: 'Population fields' },
];

/** One Settings page with a tab per list, so the sidebar stays short. */
export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const [adding, setAdding] = useState(false);
  const lookup = tab === 'population-fields' ? null : LOOKUPS[tab];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Lists used in report, event and user forms."
        actions={
          lookup && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden />
              Add {lookup.singular}
            </Button>
          )
        }
      />
      <nav aria-label="Settings" className="-mt-1 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/settings/${t.key}`}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex h-10 shrink-0 items-center rounded-full border-[1.5px] px-4 text-[16px] whitespace-nowrap',
                on
                  ? 'border-brand-500 bg-brand-25 text-brand-500 font-bold'
                  : 'border-gray-200 bg-white font-medium text-gray-700 hover:border-gray-300',
                FOCUS_RING
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {lookup ? (
        <LookupTable key={lookup.table} {...lookup} adding={adding} onAddingChange={setAdding} />
      ) : (
        <PopulationFields />
      )}
    </>
  );
}
