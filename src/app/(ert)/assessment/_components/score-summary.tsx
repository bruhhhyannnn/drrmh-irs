'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { Banner } from '@/components/ds';
import { cn } from '@/lib';
import {
  percent,
  recoveryStatus,
  unsafeByPillar,
  type AssessmentScore,
  type Tally,
} from '@/lib/assessment-score';
import { itemLabel, type AssessmentTemplate } from '@/lib/assessment-template';
import { PILLARS } from '@/lib/pillars';
import { Card, Mono } from '../../_components/chrome';

// The scores of one assessment: overall, by DRRM pillar, the unsafe items by pillar (the action
// list, spec 4.2) and by section. Used by the read-only view and by the review step.

const formatPercent = (t: Tally) => {
  const p = percent(t);
  return p === null ? '—' : `${p}%`;
};

const RECOVERY_TEXT = { in_place: 'In place', missing: 'Missing', na: 'N/A' };

export function ScoreSummary({
  score,
  template,
}: {
  score: AssessmentScore;
  template: AssessmentTemplate;
}) {
  const { overall } = score;
  const recovery = PILLARS.find((p) => p.slug === 'rehabilitation-recovery');
  const recoveryState = recoveryStatus(score.pillars['rehabilitation-recovery']);
  const flagged = score.unsafe.filter((i) => i.flag_label);
  const sectionOf = new Map(template.sections.map((s) => [s.id, s]));
  const scoredSections = template.sections.filter((s) => score.sections[s.id]);
  const unsafeGroups = unsafeByPillar(score);

  return (
    <div className="flex flex-col gap-4">
      {score.needsFollowUp && (
        <Banner tone="warning">
          <span className="font-bold">{flagged[0]?.flag_label}.</span> Unsafe answer on{' '}
          {flagged
            .map((i) => {
              const section = sectionOf.get(i.section_id);
              return section ? itemLabel(section, i) : i.code;
            })
            .join(', ')}
          .
        </Banner>
      )}

      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <div className="flex flex-col">
            <span className="text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
              Overall
            </span>
            <Mono className="text-[40px] leading-none font-semibold">{formatPercent(overall)}</Mono>
          </div>
          <span className="pb-1 text-[16px] text-gray-600">
            <Mono>{overall.safe}</Mono> of <Mono>{overall.counted}</Mono> safe
            {overall.na > 0 && (
              <>
                {' '}
                · <Mono>{overall.na}</Mono> N/A
              </>
            )}
          </span>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3">
          {PILLARS.filter((p) => p.slug !== 'rehabilitation-recovery').map((pillar) => {
            const Icon = pillar.icon;
            const tally = score.pillars[pillar.slug as keyof typeof score.pillars];
            return (
              <li
                key={pillar.slug}
                className="flex items-center gap-3 rounded-2xl border border-line bg-gray-50 px-4 py-3"
              >
                <Icon size={20} aria-hidden className="shrink-0 text-brand-700" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14px] font-semibold text-gray-600">{pillar.label}</span>
                  <Mono className="text-[22px] leading-tight font-semibold">
                    {formatPercent(tally)}
                  </Mono>
                </span>
                <span className="text-[13px] text-gray-500">
                  <Mono>{tally.safe}</Mono>/<Mono>{tally.counted}</Mono>
                </span>
              </li>
            );
          })}
        </ul>

        {recovery && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px]">
            <recovery.icon size={20} aria-hidden className="shrink-0 text-brand-700" />
            <span className="text-gray-600">Public Service Continuity Plan:</span>
            <span
              className={cn(
                'font-bold',
                recoveryState === 'in_place' && 'text-success-700',
                recoveryState === 'missing' && 'text-error-700',
                recoveryState === 'na' && 'text-gray-600'
              )}
            >
              {RECOVERY_TEXT[recoveryState]}
            </span>
          </p>
        )}
      </Card>

      {unsafeGroups.length > 0 && (
        <Card className="flex flex-col gap-4 p-5 md:p-6">
          <h3 className="text-[18px] font-bold">
            Unsafe items <Mono className="text-gray-500">({score.unsafe.length})</Mono>
          </h3>
          {unsafeGroups.map(({ pillar, items }) => {
            const info = PILLARS.find((p) => p.slug === pillar);
            const Icon = info?.icon;
            return (
              <div key={pillar} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2 text-[14px] font-bold text-gray-600">
                  {Icon && <Icon size={16} aria-hidden className="text-brand-700" />}
                  {info?.label ?? pillar}
                </span>
                <ul className="flex flex-col">
                  {items.map((item) => {
                    const section = sectionOf.get(item.section_id);
                    return (
                      <li
                        key={item.id}
                        className="flex gap-3 border-b border-line py-2 text-[15px] last:border-b-0"
                      >
                        <Mono className="w-14 shrink-0 text-[13px] text-gray-500">
                          {section ? itemLabel(section, item) : item.code}
                        </Mono>
                        <Bilingual
                          en={item.prompt_en}
                          fil={item.prompt_fil}
                          className="min-w-0 flex-1 leading-[1.45]"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </Card>
      )}

      {scoredSections.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[15px]">
            <caption className="sr-only">Score by section</caption>
            <thead className="border-b border-line bg-gray-50 text-[12px] font-bold tracking-[.06em] text-gray-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5 md:px-5">
                  Section
                </th>
                <th scope="col" className="px-2 py-2.5 text-right">
                  Safe
                </th>
                <th scope="col" className="py-2.5 pr-4 pl-2 text-right max-[359px]:hidden md:pr-5">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {scoredSections.map((section) => {
                const tally = score.sections[section.id];
                return (
                  <tr key={section.id} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-4 py-3 align-top font-normal md:px-5">
                      <span className="flex gap-2.5">
                        <Mono className="w-9 shrink-0 font-semibold text-gray-500">
                          {section.code}
                        </Mono>
                        {/* Titles like "Services/Maintenance" have no space to wrap at. */}
                        <Bilingual
                          en={section.title_en}
                          fil={section.title_fil}
                          className="min-w-0 [overflow-wrap:anywhere]"
                        />
                      </span>
                    </th>
                    <td className="px-2 py-3 text-right align-top max-[359px]:pr-4">
                      <Mono className="font-semibold">{formatPercent(tally)}</Mono>
                      {/* Below 360px the Count column doesn't fit, so the count sits here. */}
                      <Mono className="block text-[13px] whitespace-nowrap text-gray-600 min-[360px]:hidden">
                        {tally.safe} of {tally.counted}
                      </Mono>
                    </td>
                    <td className="py-3 pr-4 pl-2 text-right align-top whitespace-nowrap text-gray-600 max-[359px]:hidden md:pr-5">
                      <Mono>
                        {tally.safe} of {tally.counted}
                      </Mono>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
