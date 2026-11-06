'use client';

import { Card, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import { Bilingual } from '@/components/assessment/bilingual';
import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import type { BuildingCategory } from '@/lib/building-place';
import type { ScoredView } from '@/lib/pillar-metrics';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { BuildingLink, NONE } from './shared';

export function FixFirst({ category, group }: { category: BuildingCategory; group: ScoredView }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card className="flex flex-col gap-3 p-4.5 md:p-6">
      <div>
        <h2 className="text-[19px] font-bold">2. What to fix first</h2>
        <p className="text-[13px] text-gray-500">
          Checklist items that fail in the most buildings. Tap one to see which buildings.
        </p>
      </div>

      {group.assessed === 0 ? (
        <EmptyNote>{NONE[category]}</EmptyNote>
      ) : group.mostFailed.length === 0 ? (
        <EmptyNote>No unsafe checklist items recorded in this pillar.</EmptyNote>
      ) : (
        <ul className="flex flex-col">
          {group.mostFailed.map((item) => {
            const isExpanded = expanded === item.label;
            const failingList = group.failing[item.label] ?? [];
            const pctUnsafe = item.of > 0 ? Math.round((item.unsafe / item.of) * 100) : 0;

            return (
              <li key={item.label} className="border-line border-b py-3 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : item.label)}
                  aria-expanded={isExpanded}
                  className={cn(
                    'grid w-full items-center gap-3 text-left sm:grid-cols-[56px_1fr_180px_24px]',
                    FOCUS_RING,
                    'rounded-xl p-1'
                  )}
                >
                  <Mono className="text-[13px] font-bold text-gray-500">{item.label}</Mono>
                  <div className="text-[15px] text-gray-900 leading-snug">
                    <Bilingual en={item.prompt_en} fil={item.prompt_fil} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-red-600 transition-all"
                        style={{ width: `${pctUnsafe}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-gray-500">
                      unsafe in <Mono className="font-semibold text-gray-800">{item.unsafe}</Mono>{' '}
                      of <Mono className="font-semibold text-gray-800">{item.of}</Mono>
                    </span>
                  </div>
                  <span className="hidden sm:flex justify-end text-gray-400">
                    <ChevronDown
                      size={18}
                      className={cn(
                        'transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                      aria-hidden
                    />
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-line mt-2 ml-2 rounded-xl border bg-gray-50/60 p-3 sm:ml-14">
                    <h3 className="mb-2 text-[12px] font-bold tracking-wider text-gray-500 uppercase">
                      Failing buildings ({failingList.length})
                    </h3>
                    {failingList.length === 0 ? (
                      <p className="text-[13px] text-gray-500">No failing buildings found.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {failingList.map((b) => (
                          <li key={b.id} className="flex items-center justify-between">
                            <BuildingLink
                              id={b.id}
                              name={b.name}
                              label={b.label}
                              category={b.category}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
