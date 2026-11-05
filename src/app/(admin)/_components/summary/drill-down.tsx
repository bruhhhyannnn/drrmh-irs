'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatTime, personName, plural } from '../../_lib/format';
import {
  NO_UNIT,
  peopleOf,
  scopedCoverage,
  type ScopeTarget,
  type Summary,
  type SummaryScope,
  type UnitCoverage,
} from '../../_lib/summary';
import { ReportDrawer } from '../../reports/_components/report-drawer';
import { Card, Mono } from '../ui';

const PAD_X = 'px-4 md:px-5';

/** Builds the link to a cluster or unit on the current page. */
export type ScopeLinks = (target: ScopeTarget) => string;

/** A row whose whole area follows the `DrillLink` inside it. */
export const DRILL_ROW = 'relative -mx-2 rounded-lg px-2 transition-colors hover:bg-gray-50';

export function DrillLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded-sm after:absolute after:inset-0 after:rounded-lg',
        FOCUS_RING,
        className
      )}
    >
      <span className="min-w-0">{children}</span>
      <ChevronRight size={15} aria-hidden className="shrink-0 text-gray-400" />
    </Link>
  );
}

export function coverageLabel(coverage: UnitCoverage) {
  return `${coverage.reported} of ${plural(coverage.total, 'unit', 'units')}`;
}

/** A cluster's units with no report yet, collapsed until asked for. */
export function MissingUnits({
  coverage,
  className,
}: {
  coverage: UnitCoverage | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!coverage?.missing.length) return null;
  return (
    <div className={cn('flex flex-col', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-10 items-center gap-1.5 self-start rounded-lg text-left text-[14px] font-semibold text-warning-700',
          FOCUS_RING
        )}
      >
        <ChevronDown
          size={16}
          aria-hidden
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        />
        {plural(coverage.missing.length, 'unit', 'units')} with no report yet
      </button>
      {open && (
        <ul className="flex flex-col gap-1 pb-1 pl-5.5 text-[16px] text-gray-600">
          {coverage.missing.map((u) => (
            <li key={u.id}>{u.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Where a narrowed page sits within the event, with the way back. */
export function ScopeBreadcrumb({
  title,
  scope,
  links,
}: {
  title: string;
  scope: SummaryScope;
  links: ScopeLinks;
}) {
  const crumbs = [
    { label: title, href: links({ clusterId: null }) },
    { label: scope.clusterName, href: links({ clusterId: scope.clusterId }) },
    ...(scope.unitName ? [{ label: scope.unitName, href: '' }] : []),
  ];
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[16px]">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight size={15} aria-hidden className="shrink-0 text-gray-400" />}
              {last ? (
                <span aria-current="page" className="font-bold text-gray-900">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className={cn(
                    'rounded-sm font-semibold text-brand-500 hover:underline',
                    FOCUS_RING
                  )}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The Clusters card on a cluster's page: its units, and the ones that haven't reported. */
export function UnitsCard({
  summary,
  scope,
  links,
}: {
  summary: Summary;
  scope: SummaryScope;
  links: ScopeLinks;
}) {
  const units = summary.clusters.done[0]?.units ?? [];
  const coverage = scopedCoverage(summary);
  return (
    <Card className="flex flex-col">
      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 py-4', PAD_X)}>
        <h2 className="flex-1 text-[19px] leading-[1.3] font-bold">Units in {scope.clusterName}</h2>
        {coverage && (
          <span className="text-[14px] font-semibold text-gray-600">
            <Mono className="text-[16px] font-bold text-gray-900">
              {coverage.reported} of {coverage.total}
            </Mono>{' '}
            reported
          </span>
        )}
      </div>
      {units.length > 0 && (
        <ul className={cn('flex flex-col border-t border-line py-2', PAD_X)}>
          {units.map((u) => (
            <li
              key={u.name}
              className={cn('flex min-h-10 items-center justify-between gap-3', DRILL_ROW)}
            >
              <DrillLink
                href={links({ clusterId: scope.clusterId, unitId: u.id ?? NO_UNIT })}
                className="text-[16px] font-semibold"
              >
                {u.name}
              </DrillLink>
              <Mono className="text-[16px] font-bold">{u.people.toLocaleString()}</Mono>
            </li>
          ))}
        </ul>
      )}
      {coverage?.missing.length ? (
        <MissingUnits coverage={coverage} className={cn('border-t border-line py-1', PAD_X)} />
      ) : null}
      {!units.length && !coverage && (
        <p className={cn('border-t border-line py-4 text-[16px] text-gray-500', PAD_X)}>
          No reports from this cluster yet.
        </p>
      )}
    </Card>
  );
}

/** The Clusters card on a unit's page: the reports its numbers come from, newest first. */
export function UnitReportsCard({ summary }: { summary: Summary }) {
  const reports = [...summary.source.reports].reverse();
  const [drawer, setDrawer] = useState<{ open: boolean; reportId?: string }>({ open: false });
  return (
    <Card className="flex flex-col">
      <h2 className={cn('py-4 text-[19px] leading-[1.3] font-bold', PAD_X)}>
        Reports from this unit
      </h2>
      {reports.length ? (
        <ul className="flex flex-col">
          {reports.map((r) => (
            <li key={r.id} className="border-t border-line">
              <button
                type="button"
                onClick={() => setDrawer({ open: true, reportId: r.id })}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 py-2 text-left transition-colors hover:bg-gray-50',
                  PAD_X,
                  FOCUS_RING
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-[16px] font-semibold">{personName(r.user) || '—'}</span>
                  <span className="text-[14px] text-gray-500">{formatTime(r.submitted_at)}</span>
                </span>
                <Mono className="text-[16px] font-bold">{peopleOf(r).toLocaleString()}</Mono>
                <ChevronRight size={15} aria-hidden className="shrink-0 text-gray-400" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn('border-t border-line py-4 text-[16px] text-gray-500', PAD_X)}>
          No reports from this unit in this event.
        </p>
      )}
      <ReportDrawer
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        reportId={drawer.reportId}
        campusId={summary.source.event.campus_id}
        readOnly={summary.completed}
      />
    </Card>
  );
}
