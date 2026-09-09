import { cn } from '@/lib';
import { format, formatDistanceToNow, isValid } from 'date-fns';

export interface DateTimeCellProps {
  date?: string | Date | null;
  /** Layout variant: stacked (2 lines), inline (1 line), or date-only. Defaults to 'stacked'. */
  variant?: 'stacked' | 'inline' | 'date-only';
  /** Whether to show the time portion. Defaults to true. */
  showTime?: boolean;
  /** Custom date format string (date-fns). Defaults to 'MMM d, yyyy'. */
  dateFormat?: string;
  /** Custom time format string (date-fns). Defaults to 'h:mm a'. */
  timeFormat?: string;
  className?: string;
}

export function DateTimeCell({
  date,
  variant = 'stacked',
  showTime = true,
  dateFormat = 'MMM d, yyyy',
  timeFormat = 'h:mm a',
  className,
}: DateTimeCellProps) {
  if (!date) {
    return <span className="text-gray-400 dark:text-gray-600">—</span>;
  }

  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(parsedDate)) {
    return <span className="text-gray-400 dark:text-gray-600">—</span>;
  }

  const dateStr = format(parsedDate, dateFormat);
  const timeStr = format(parsedDate, timeFormat);
  const fullTimestamp = format(parsedDate, 'EEEE, MMMM d, yyyy · h:mm:ss a');
  const relativeTime = formatDistanceToNow(parsedDate, { addSuffix: true });
  const tooltipText = `${fullTimestamp} (${relativeTime})`;

  if (variant === 'date-only' || !showTime) {
    return (
      <span
        title={tooltipText}
        className={cn('text-sm text-gray-800 dark:text-gray-200 tabular-nums', className)}
      >
        {dateStr}
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        title={tooltipText}
        className={cn(
          'text-sm text-gray-800 dark:text-gray-200 tabular-nums whitespace-nowrap',
          className
        )}
      >
        <span>{dateStr}</span>
        <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{timeStr}</span>
      </span>
    );
  }

  // Default: stacked 2-line layout
  return (
    <div
      title={tooltipText}
      className={cn('flex flex-col text-left leading-tight tabular-nums', className)}
    >
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{dateStr}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono tracking-tight mt-0.5">
        {timeStr}
      </span>
    </div>
  );
}
