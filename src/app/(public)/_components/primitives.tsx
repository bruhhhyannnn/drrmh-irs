import { cn } from '@/lib';
import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

/** Keyboard focus ring used by every interactive element on the landing page. */
export const FOCUS_RING =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#5a9ef2]';

/** Brand link colour — maroon, darkening and underlining on hover. */
const LINK = 'text-brand-500 hover:text-[#7a1515] hover:underline';

/** Content column: 1140px max, with the design's 20 / 40 / 64px gutters (phone / tablet / web). */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-285 px-5 md:px-10 lg:px-16', className)}>
      {children}
    </div>
  );
}

const SECTION_TONES = {
  white: 'bg-white',
  muted: 'bg-gray-50',
  inverse: 'bg-[#4d0e0e] text-white',
};

export function Section({
  id,
  tone = 'white',
  className,
  children,
}: {
  id?: string;
  tone?: keyof typeof SECTION_TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn('py-14 md:py-18 lg:py-24', SECTION_TONES[tone])}>
      <Container className={className}>{children}</Container>
    </section>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[28px] leading-[1.15] font-extrabold tracking-[-.01em] text-balance md:text-[32px] lg:text-[38px]">
      {children}
    </h2>
  );
}

const EYEBROW_TONES = {
  brand: 'text-brand-500',
  meta: 'text-gray-500',
  inverse: 'text-[#fbd5d5]',
};

export function Eyebrow({
  tone = 'brand',
  className,
  children,
}: {
  tone?: keyof typeof EYEBROW_TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'text-[12px] font-bold tracking-[.08em] uppercase',
        EYEBROW_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-[17px] leading-[1.6] text-pretty text-gray-600">{children}</p>;
}

/** A green check followed by a short line of copy. */
export function CheckItem({
  size = 16,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <li className={cn('flex gap-2.5', className)}>
      <Check size={size} aria-hidden className="mt-0.75 shrink-0 text-[#027a48]" />
      <span>{children}</span>
    </li>
  );
}

/** Renders a Next.js `Link` for in-app paths and a plain anchor for `tel:`, `mailto:` and `#`. */
export function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-brand-500 text-white hover:brightness-92',
  outline: 'border-[1.5px] border-gray-300 bg-white text-gray-900 hover:brightness-97',
};

/** The design system's 52px pill button, rendered as a link. */
export function ButtonLink({
  href,
  variant = 'primary',
  fullWidth,
  children,
}: {
  href: string;
  variant?: keyof typeof BUTTON_VARIANTS;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SmartLink
      href={href}
      className={cn(
        'h-13 items-center justify-center gap-2 rounded-full px-6 text-[15px] leading-none font-bold whitespace-nowrap transition-[filter,scale] duration-120 ease-[cubic-bezier(.2,.7,.3,1)] active:scale-98',
        fullWidth ? 'flex w-full' : 'inline-flex',
        BUTTON_VARIANTS[variant],
        FOCUS_RING
      )}
    >
      {children}
    </SmartLink>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <SmartLink href={href} className={cn('font-bold', LINK, FOCUS_RING)}>
      {children}
    </SmartLink>
  );
}

export function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <SmartLink
      href={href}
      className={cn('inline-flex items-center gap-1.5 text-[15px] font-bold', LINK, FOCUS_RING)}
    >
      {children}
      <ArrowRight size={16} aria-hidden />
    </SmartLink>
  );
}

/** Same classes as `TextLink`, for the privacy notice trigger (a button, not a link). */
export const TEXT_BUTTON = cn('font-bold', LINK, FOCUS_RING);
