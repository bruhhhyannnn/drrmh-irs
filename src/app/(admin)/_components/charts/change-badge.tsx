import { cn } from '@/lib';

/**
 * A change in percentage points since the previous assessment: ▲ 8 green, ▼ 8 red, 0 grey. Nothing
 * when there's no previous score to compare with (pointsChange returned null).
 */
export function ChangeBadge({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null;
  const label =
    value === 0 ? 'No change' : `${value > 0 ? 'Up' : 'Down'} ${Math.abs(value)} points`;
  return (
    <span
      aria-label={label}
      className={cn(
        'font-landing-mono inline-flex items-center gap-0.5 text-[13px] font-semibold whitespace-nowrap',
        value > 0 && 'text-success-700',
        value < 0 && 'text-error-700',
        value === 0 && 'text-gray-500',
        className
      )}
    >
      {value > 0 && '▲ '}
      {value < 0 && '▼ '}
      {Math.abs(value)}
    </span>
  );
}
