import { percent, recoveryStatus, type Tally } from '@/lib/assessment-score';
import { pointsChange } from '@/lib/building-safety';
import { ChangeBadge } from '../../_components/charts/change-badge';
import { Mono } from '../../_components/ui';

/** "82%" (or "—" when nothing was counted), with the change since the previous assessment. */
export function ScoreCell({ tally, previous }: { tally: Tally; previous?: Tally | null }) {
  const p = percent(tally);
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <Mono className="text-[16px] font-semibold text-gray-900">{p === null ? '—' : `${p}%`}</Mono>
      <ChangeBadge value={pointsChange(previous, tally)} />
    </span>
  );
}

export const RECOVERY_TEXT = { in_place: 'In place', missing: 'Missing', na: 'N/A' } as const;

/** Pillar 4 reads as In place / Missing / N/A rather than a percent (spec 4.2). */
export function RecoveryCell({ tally }: { tally: Tally }) {
  const state = recoveryStatus(tally);
  return (
    <span
      className={
        state === 'in_place'
          ? 'font-semibold text-success-700'
          : state === 'missing'
            ? 'font-semibold text-error-700'
            : 'text-gray-500'
      }
    >
      {RECOVERY_TEXT[state]}
    </span>
  );
}
