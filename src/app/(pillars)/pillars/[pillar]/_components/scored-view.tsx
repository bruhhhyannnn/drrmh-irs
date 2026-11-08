'use client';

import { EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import { Bilingual } from '@/components/assessment/bilingual';
import type { BuildingCategory } from '@/lib/building-place';
import type { ScoredView } from '@/lib/pillar-metrics';
import { BuildingsToVisit } from './buildings-to-visit';
import { FixFirst } from './fix-first';
import { SectionBars, TrendsSection } from './pillar-charts';
import { PlacesTable } from './places-table';
import { ScoreTiles } from './score-tiles';
import { FoldableCard } from './shared';

export function ScoredViewSection({
  pillarName,
  category,
  group,
  campusTrend,
  offCampusTrend,
}: {
  pillarName: string;
  category: BuildingCategory;
  group: ScoredView;
  campusTrend: ScoredView['trend'];
  offCampusTrend: ScoredView['trend'];
}) {
  return (
    <div className="flex flex-col gap-4">
      <ScoreTiles pillarName={pillarName} category={category} group={group} />

      <FixFirst category={category} group={group} />

      <BuildingsToVisit category={category} group={group} />

      <PlacesTable category={category} places={group.places} assessed={group.assessed} />

      <TrendsSection
        pillarLabel={pillarName}
        category={category}
        campusTrend={campusTrend}
        offCampusTrend={offCampusTrend}
        bands={group.bands}
        changes={group.changes}
        activity={group.activity}
        overdue={group.overdue}
        notYetAssessed={group.notYetAssessed}
        assessed={group.assessed}
        reassessed={group.reassessed}
      />

      <FoldableCard title="5. By checklist section">
        {group.sections.length === 0 ? (
          <EmptyNote>No section scores recorded for this pillar.</EmptyNote>
        ) : (
          <SectionBars sections={group.sections} />
        )}
      </FoldableCard>

      <FoldableCard title="Does the checklist fit? (questions often marked N/A)">
        {group.mostNa.length === 0 ? (
          <EmptyNote>No questions were marked N/A in this pillar.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-gray-500">
              Many N/A answers can mean the question doesn&apos;t fit these buildings.
            </p>
            <ul className="flex flex-col">
              {group.mostNa.map((item) => (
                <li
                  key={item.label}
                  className="border-line flex items-start justify-between gap-3 border-b py-2.5 text-[14px] last:border-b-0"
                >
                  <span className="min-w-0">
                    <Mono className="mr-1.5 font-bold text-gray-500">{item.label}</Mono>
                    <Bilingual en={item.prompt_en} fil={item.prompt_fil} />
                  </span>
                  <Mono className="shrink-0 font-bold text-gray-900">
                    {item.na}/{item.of}
                  </Mono>
                </li>
              ))}
            </ul>
          </div>
        )}
      </FoldableCard>
    </div>
  );
}
