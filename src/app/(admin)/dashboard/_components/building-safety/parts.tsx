'use client';

import { Bilingual } from '@/components/assessment/bilingual';
import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { percent, recoveryStatus, type Tally } from '@/lib/assessment-score';
import type { PillarCode } from '@/lib/assessment-template';
import {
  pointsChange,
  type ChildRow,
  type FailedItem,
  type RollupGroup,
  type SectionRow,
} from '@/lib/building-safety';
import { PILLARS } from '@/lib/pillars';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ChangeBadge } from '../../../_components/charts/change-badge';
import { Mono } from '../../../_components/ui';
import { formatDate, plural } from '../../../_lib/format';

// Pieces of the dashboard's Building safety section (DRRM-015, spec 4.3).

/** The three pillars scored as a percent; Recovery (one item) reads as In place / Missing. */
export const SCORED_PILLARS = ['prevention-mitigation', 'preparedness', 'response'] as const;

export const pillarLabel = (code: PillarCode) =>
  PILLARS.find((p) => p.slug === code)?.label ?? code;

export const pct = (t: Tally | null | undefined) => {
  const p = t ? percent(t) : null;
  return p === null ? '—' : `${p}%`;
};

export const RECOVERY_TEXT = { in_place: 'In place', missing: 'Missing', na: 'N/A' } as const;

/** Campus › Cluster › Unit › Building; every part but the last goes back up. */
export function Breadcrumb({ parts }: { parts: { label: string; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Building safety level">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px]">
        {parts.map((part, i) => {
          const last = i === parts.length - 1;
          return (
            <li key={`${part.label}-${i}`} className="flex items-center gap-1.5">
              {part.onClick && !last ? (
                <button
                  type="button"
                  onClick={part.onClick}
                  className={cn('text-brand-500 rounded font-semibold hover:underline', FOCUS_RING)}
                >
                  {part.label}
                </button>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="font-bold text-gray-900">
                  {part.label}
                </span>
              )}
              {!last && <ChevronRight size={14} aria-hidden className="text-gray-400" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Tile({
  label,
  value,
  change,
  unit = 'pts',
  note,
}: {
  label: string;
  value: string;
  change?: number | null;
  /** What the change counts: percentage points, or buildings for the continuity plan. */
  unit?: string;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[18px] border border-gray-200 bg-surface px-4.5 py-4">
      <span className="text-[14px] leading-[1.3] font-semibold text-gray-600">{label}</span>
      <span className="flex items-baseline gap-2">
        <Mono className="text-[28px] leading-[1.1] font-extrabold text-gray-900">{value}</Mono>
        {change !== undefined && change !== null && (
          <span className="flex items-baseline gap-1">
            <ChangeBadge value={change} className="text-[14px]" />
            <span className="text-[13px] text-gray-500">{unit}</span>
          </span>
        )}
      </span>
      {note && <span className="text-[13px] leading-[1.35] text-gray-500">{note}</span>}
    </div>
  );
}

/** Overall and the three pillar scores with the like-for-like change, and the continuity plan. */
export function SummaryTiles({ group }: { group: RollupGroup }) {
  const lfl = group.likeForLike;
  const change = (pick: (p: RollupGroup['current']) => Tally) =>
    lfl ? pointsChange(pick(lfl.previous), pick(lfl.current)) : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile
          label="Overall"
          value={pct(group.current.overall)}
          change={change((p) => p.overall)}
        />
        {SCORED_PILLARS.map((code) => (
          <Tile
            key={code}
            label={pillarLabel(code)}
            value={pct(group.current.pillars[code])}
            change={change((p) => p.pillars[code])}
          />
        ))}
        <Tile
          label="Continuity plan"
          value={`${group.pscp.has} of ${group.pscp.of}`}
          change={group.pscp.change}
          unit={Math.abs(group.pscp.change ?? 0) === 1 ? 'building' : 'buildings'}
          note={`${group.pscp.of === 1 ? 'building has' : 'buildings have'} a Public Service Continuity Plan`}
        />
      </div>
      <p className="text-[14px] text-gray-600">
        {lfl
          ? `▲▼ pts: change since the previous assessments · ${group.reassessed} of ${plural(group.assessed, 'building', 'buildings')} re-assessed`
          : 'No building has been re-assessed yet, so there is no change to show.'}
      </p>
    </div>
  );
}

/** One row per child: assessed / total, overall, the pillars with change, PSCP, last assessed. */
export function ChildrenTable({
  rows,
  noun,
  onOpen,
}: {
  rows: ChildRow[];
  noun: string;
  onOpen: (row: ChildRow) => void;
}) {
  const lfl = (row: ChildRow, pick: (p: RollupGroup['current']) => Tally) =>
    row.likeForLike
      ? pointsChange(pick(row.likeForLike.previous), pick(row.likeForLike.current))
      : null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-170 text-left text-[15px]">
        <caption className="sr-only">Scores by {noun}</caption>
        <thead className="border-b border-line text-[12px] font-bold tracking-[.06em] text-gray-500 uppercase">
          <tr>
            <th scope="col" className="py-2.5 pr-3">
              {noun}
            </th>
            <th scope="col" className="px-2 py-2.5 text-right">
              Assessed
            </th>
            <th scope="col" className="px-2 py-2.5 text-right">
              Overall
            </th>
            {SCORED_PILLARS.map((code) => (
              <th key={code} scope="col" className="px-2 py-2.5 text-right">
                {pillarLabel(code)}
              </th>
            ))}
            <th scope="col" className="px-2 py-2.5 text-right">
              PSCP
            </th>
            <th scope="col" className="py-2.5 pl-2 text-right">
              Last assessed
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-2.5 pr-3 font-normal">
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className={cn(
                    'text-brand-500 rounded text-left font-semibold hover:underline',
                    FOCUS_RING
                  )}
                >
                  {row.name}
                </button>
              </th>
              <td className="px-2 py-2.5 text-right">
                <Mono>
                  {row.assessed}/{row.buildings}
                </Mono>
              </td>
              <td className="px-2 py-2.5 text-right whitespace-nowrap">
                <Mono className="font-semibold">{pct(row.current.overall)}</Mono>{' '}
                <ChangeBadge value={lfl(row, (p) => p.overall)} />
              </td>
              {SCORED_PILLARS.map((code) => (
                <td key={code} className="px-2 py-2.5 text-right whitespace-nowrap">
                  <Mono>{pct(row.current.pillars[code])}</Mono>{' '}
                  <ChangeBadge value={lfl(row, (p) => p.pillars[code])} />
                </td>
              ))}
              <td className="px-2 py-2.5 text-right">
                <Mono>
                  {row.pscp.has}/{row.pscp.of}
                </Mono>
              </td>
              <td className="py-2.5 pl-2 text-right whitespace-nowrap text-gray-600">
                {row.lastAssessedAt ? formatDate(row.lastAssessedAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "By section", collapsed: each section's pooled score and the change. */
export function SectionScores({ rows }: { rows: SectionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="group rounded-[18px] border border-gray-200 bg-surface">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] px-4.5 py-3.5 text-[16px] font-bold [&::-webkit-details-marker]:hidden',
          FOCUS_RING
        )}
      >
        By section
        <ChevronDown
          size={18}
          aria-hidden
          className="text-gray-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="flex flex-col px-4.5 pb-3">
        {rows.map((row) => (
          <li
            key={row.code}
            className="flex items-start gap-3 border-t border-line py-2.5 text-[15px]"
          >
            <Mono className="w-10 shrink-0 font-semibold text-gray-500">{row.code}</Mono>
            <Bilingual
              en={row.title_en}
              fil={row.title_fil}
              className="min-w-0 flex-1 [overflow-wrap:anywhere]"
            />
            <span className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
              <Mono className="font-semibold">{pct(row.current)}</Mono>
              <ChangeBadge value={row.change} />
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The items most often answered unsafe in the latest assessments, per pillar. */
export function MostFailed({ groups }: { groups: { pillar: PillarCode; items: FailedItem[] }[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[17px] font-bold">Most-failed items</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g.pillar} className="rounded-[18px] border border-gray-200 bg-surface p-4">
            <h4 className="pb-1.5 text-[13px] font-bold tracking-[.06em] text-gray-500 uppercase">
              {pillarLabel(g.pillar)}
            </h4>
            <ul className="flex flex-col">
              {g.items.map((item) => (
                <li
                  key={item.label}
                  className="flex gap-2.5 border-t border-line py-2 text-[15px] first:border-t-0"
                >
                  <Mono className="w-14 shrink-0 font-semibold text-gray-500">{item.label}</Mono>
                  <span className="min-w-0 flex-1">
                    <Bilingual en={item.prompt_en} fil={item.prompt_fil} />
                    <span className="block text-[14px] font-medium text-error-700">
                      — unsafe in {item.unsafe} of {plural(item.of, 'building', 'buildings')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function recoveryText(t: Tally | null) {
  return t ? RECOVERY_TEXT[recoveryStatus(t)] : '—';
}
