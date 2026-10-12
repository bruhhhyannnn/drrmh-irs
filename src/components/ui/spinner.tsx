import { cn } from '@/lib';

const ring = {
  sm: 'size-4 border-2',
  md: 'size-5 border-2',
  lg: 'size-8 border-[3px]',
};

/**
 * Small ring for buttons and inline use, in the text colour of whatever it sits in. Pass
 * `label={null}` when the surrounding text already says what is happening (a button reading
 * "Adding…"), so screen readers don't hear it twice.
 */
export function Spinner({
  size = 'sm',
  label = 'Loading',
  className,
}: {
  size?: keyof typeof ring;
  label?: string | null;
  className?: string;
}) {
  const circle = (
    <span
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-full border-current/25 border-t-current motion-safe:animate-spin',
        ring[size],
        label === null && className
      )}
    />
  );
  if (label === null) return circle;

  return (
    <span role="status" className={cn('inline-flex', className)}>
      {circle}
      <span className="sr-only">{label}</span>
    </span>
  );
}
