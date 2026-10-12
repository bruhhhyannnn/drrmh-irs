import { cn, getInitials } from '@/lib';
import { ownCampusLogo } from '@/lib/campus-logo';
import type { Tone } from '../_lib/status';

export { Skeleton } from '@/components/ui/skeleton';

// Small building blocks shared by the admin pages. Light theme only, Figtree + Spline Sans Mono.

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[22px] border border-gray-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,.08)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const CHIP_TONES: Record<Tone, { box: string; dot: string }> = {
  green: { box: 'bg-success-50 text-[#027a48]', dot: 'bg-success-500' },
  amber: { box: 'bg-warning-50 text-[#b54708]', dot: 'bg-warning-500' },
  blue: { box: 'bg-[#eff8ff] text-[#175cd3]', dot: 'bg-[#2e90fa]' },
  grey: { box: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  red: { box: 'bg-error-50 text-[#b42318]', dot: 'bg-error-600' },
  maroon: { box: 'bg-brand-25 text-brand-500', dot: 'bg-brand-500' },
  neutral: { box: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' },
};

/** Rounded status label. Status chips carry a dot; count and type chips don't. */
export function Chip({
  tone,
  dot = false,
  className,
  children,
}: {
  tone: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap',
        CHIP_TONES[tone].box,
        className
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', CHIP_TONES[tone].dot)} />}
      {children}
    </span>
  );
}

/** Numbers and times in the mono face. */
export function Mono({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn('font-landing-mono', className)}>{children}</span>;
}

/** Initials in a circle: maroon for the signed-in admin, grey for everyone else. */
export function Avatar({
  name,
  size = 36,
  highlight = false,
}: {
  name: string;
  size?: 32 | 36 | 40 | 48;
  highlight?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold uppercase',
        highlight ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700',
        size === 32 && 'size-8 text-[14px]',
        size === 36 && 'size-9 text-[14px]',
        size === 40 && 'size-10 text-[16px]',
        size === 48 && 'size-12 text-[18px]'
      )}
    >
      {getInitials(name || '?').slice(0, 2)}
    </span>
  );
}

/** The campus logo, or its name in a maroon circle when it has none (e.g. UP PGH). */
export function CampusMark({ name, size = 56 }: { name: string; size?: 40 | 56 }) {
  const logo = ownCampusLogo(name);
  const box = size === 56 ? 'size-14' : 'size-10';
  if (logo) {
    return (
      <span
        role="img"
        aria-label={`${name} logo`}
        className={cn(box, 'shrink-0 bg-contain bg-center bg-no-repeat')}
        style={{ backgroundImage: `url(${logo})` }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        'bg-brand-25 text-brand-500 grid shrink-0 place-items-center rounded-full border-[1.5px] border-[#fbd5d5] font-extrabold',
        size === 56 ? 'text-[17px]' : 'text-[13px]'
      )}
    >
      {name.replace(/^UP\s+/i, '').slice(0, 4)}
    </span>
  );
}

/** Horizontal track with a filled share. */
export function Bar({
  value,
  max,
  tone = 'maroon',
  size = 'md',
  className,
}: {
  value: number;
  max: number;
  tone?: 'maroon' | 'green' | 'grey';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      aria-hidden
      className={cn(
        'min-w-0 overflow-hidden rounded-full bg-gray-100',
        size === 'sm' ? 'h-2' : 'h-2.5',
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-full',
          tone === 'maroon' && 'bg-brand-500',
          tone === 'green' && 'bg-success-500',
          tone === 'grey' && 'bg-gray-400'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** One centred line in a card body when a list or chart has nothing to show. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-[16px] text-pretty text-gray-500">{children}</p>;
}

/** Card heading row: title on the left, a note or control on the right. */
export function CardHeading({
  title,
  aside,
  level = 2,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Heading
        className={cn('leading-[1.3] font-bold', level === 2 ? 'text-[19px]' : 'text-[18px]')}
      >
        {title}
      </Heading>
      {typeof aside === 'string' ? (
        <span className="text-[14px] font-medium text-gray-500">{aside}</span>
      ) : (
        aside
      )}
    </div>
  );
}

/** Calendar date block: OCT over 8. */
export function DateBlock({ date, tone = 'grey' }: { date: Date; tone?: 'grey' | 'white' }) {
  return (
    <span
      className={cn(
        'flex h-13 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[14px] border border-[#eaecf0]',
        tone === 'grey' ? 'bg-gray-50' : 'bg-white'
      )}
    >
      <span className="text-brand-500 text-[11px] font-bold tracking-[.08em] uppercase">
        {date.toLocaleString('en-US', { month: 'short' })}
      </span>
      <span className="font-landing-mono text-[20px] leading-none font-bold">{date.getDate()}</span>
    </span>
  );
}
