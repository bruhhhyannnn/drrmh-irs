import { cn } from '@/lib';
import { AlertTriangle } from 'lucide-react';

const TONES = {
  error: { box: 'border-error-200 bg-error-50 text-error-700', icon: 'text-error-600' },
  warning: { box: 'border-warning-200 bg-warning-50 text-warning-800', icon: 'text-warning-700' },
};

/** One-line message above a form: red for errors, amber for warnings such as being offline. */
export function Banner({
  tone = 'error',
  icon,
  children,
}: {
  tone?: keyof typeof TONES;
  /** Replaces the warning triangle. */
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-[14px] large-text:text-[16px] leading-normal font-medium',
        TONES[tone].box
      )}
    >
      <span className={cn('mt-px flex shrink-0', TONES[tone].icon)}>
        {icon ?? <AlertTriangle size={18} aria-hidden />}
      </span>
      <span className="text-pretty">{children}</span>
    </div>
  );
}
