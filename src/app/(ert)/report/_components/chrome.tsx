import { Skeleton } from '@/components/ui/skeleton';
import { cn, getInitials } from '@/lib';
import Image from 'next/image';
import { useId } from 'react';

// Page frame and building blocks shared by the ERT screens. Breakpoints follow the design
// frames: phone is the base, tablet is `md`, web is `lg`. Light theme only.

/** Content column: 1140px max with the design's 16 / 32 / 40px gutters. */
export const GUTTER = 'mx-auto w-full max-w-285 px-4 md:px-8 lg:px-10';

/** Campus photo under a maroon wash, with the page title. */
export function Hero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <HeroFrame>
      <span className="text-[11px] font-bold tracking-[.08em] text-[#fbd5d5] uppercase">
        {eyebrow}
      </span>
      <h1 className="text-[24px] leading-[1.2] font-extrabold text-balance text-white md:text-[28px]">
        {title}
      </h1>
      {children && <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">{children}</div>}
    </HeroFrame>
  );
}

/** The hero's photo and wash with placeholder lines, while the page's title loads. */
export function HeroSkeleton() {
  return (
    <HeroFrame>
      <Skeleton onDark className="h-3 w-44 rounded-md" />
      <Skeleton onDark className="my-1 h-7 w-full max-w-90 rounded-lg md:h-8" />
      <Skeleton onDark className="h-6 w-28 rounded-full" />
    </HeroFrame>
  );
}

function HeroFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden">
      <Image
        src="/upm-drrmh-background-2.jpg"
        alt=""
        fill
        sizes="100vw"
        preload
        className="-z-2 object-cover"
      />
      <div aria-hidden className="absolute inset-0 -z-1 bg-[rgba(77,14,14,.8)]" />
      <div className={cn(GUTTER, 'flex flex-col gap-2 py-6 md:py-7 lg:py-8')}>{children}</div>
    </div>
  );
}

const PILL_TONES = {
  live: 'bg-white/16 text-white',
  success: 'bg-success-50 text-[#027a48]',
  warning: 'bg-warning-50 text-[#b54708]',
  error: 'bg-error-50 text-[#b42318]',
};

/** Small rounded status label, e.g. Ongoing, Submitted, Offline. */
export function Pill({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof PILL_TONES;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'flex h-6.5 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap',
        PILL_TONES[tone]
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** The coloured dot used inside a pill. */
export function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', className)} />;
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[22px] border border-gray-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,.08)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * A numbered form section: number, title and a Required / Optional note (or a total) on the
 * right. `children` is called with the title's id, for `aria-labelledby`. With an `id`, the
 * card can take focus, so a failed submit can move to it.
 */
export function SectionCard({
  id,
  number,
  title,
  aside,
  className,
  children,
}: {
  id?: string;
  number?: number;
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: (titleId: string) => React.ReactNode;
}) {
  const titleId = useId();
  return (
    <Card
      id={id}
      tabIndex={id ? -1 : undefined}
      className={cn('flex scroll-mt-4 flex-col p-5 outline-none md:p-6', className)}
    >
      <div className="flex items-center gap-3">
        {number !== undefined && (
          <span className="bg-brand-25 text-brand-500 font-landing-mono grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold">
            {number}
          </span>
        )}
        <h2 id={titleId} className="flex-1 text-[17px] leading-[1.3] font-bold">
          {title}
        </h2>
        {typeof aside === 'string' ? (
          <span className="text-[12px] font-semibold text-gray-500">{aside}</span>
        ) : (
          aside
        )}
      </div>
      {children(titleId)}
    </Card>
  );
}

/** Label / value rows in a grey box, e.g. Event, Headcount, Saved. */
export function DetailList({
  title,
  rows,
}: {
  title?: string;
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-col self-stretch rounded-2xl border border-[#eaecf0] bg-gray-50 px-4 py-1 text-left text-[14px]">
      {title && (
        <span className="pt-3 pb-1.5 text-[11px] font-bold tracking-[.08em] text-gray-500 uppercase">
          {title}
        </span>
      )}
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 border-b border-[#eaecf0] py-2.5 last:border-b-0"
          >
            <dt className="text-gray-600">{row.label}</dt>
            <dd className="text-right font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Numbers and times in the mono face. */
export function Mono({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn('font-landing-mono', className)}>{children}</span>;
}

/** Maroon circle with the person's initials. */
export function Avatar({ name, size = 40 }: { name: string; size?: 32 | 40 | 44 }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-brand-500 grid shrink-0 place-items-center rounded-full font-bold text-white uppercase',
        size === 32 && 'size-8 text-[13px]',
        size === 40 && 'size-10 text-[14px]',
        size === 44 && 'size-11 text-[15px]'
      )}
    >
      {getInitials(name).slice(0, 2)}
    </span>
  );
}

/**
 * Centred result card: a 64px round icon, a title, one line, then whatever follows (details,
 * a button). Used for No ongoing event, Saved offline and the offline notice.
 */
export function NoticeCard({
  icon,
  iconTone,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconTone: 'neutral' | 'warning';
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(GUTTER, 'pt-6 pb-12')}>
      <Card className="mx-auto flex max-w-140 flex-col items-center gap-5 p-6 text-center lg:p-10">
        <span
          className={cn(
            'grid size-16 place-items-center rounded-full',
            iconTone === 'neutral' ? 'bg-gray-100 text-gray-600' : 'bg-warning-50 text-[#b54708]'
          )}
        >
          {icon}
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-[22px] leading-[1.2] font-extrabold md:text-[26px]">{title}</h2>
          <p className="text-[15px] leading-[1.55] text-pretty text-gray-600">{description}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}

export function personName(profile: { first_name?: string | null; last_name?: string | null }) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ');
}
