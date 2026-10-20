'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

// Pieces shared by the auth screens. The reset screens follow one pattern: icon, title, one
// line, one main button.

/** Maroon text link, e.g. "Forgot password?" or "Sign out". */
export const AUTH_LINK = cn(
  'text-brand-500 font-bold hover:text-brand-600 hover:underline',
  FOCUS_RING
);

/**
 * Page title and one line under it. `focusOnMount` moves focus to the title, so a screen that
 * replaces the previous one in place (e.g. "Check your email") is announced.
 */
export function AuthHeading({
  title,
  focusOnMount,
  children,
}: {
  title: string;
  focusOnMount?: boolean;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <div className="flex flex-col gap-1.5">
      <h1
        ref={ref}
        tabIndex={focusOnMount ? -1 : undefined}
        className="text-[26px] leading-[1.2] font-extrabold outline-none md:text-[28px] lg:text-[30px]"
      >
        {title}
      </h1>
      {children && (
        <p className="text-[15px] leading-[1.55] text-pretty text-gray-600">{children}</p>
      )}
    </div>
  );
}

/** The one place errors show: a banner above the fields. */
export { Banner as AuthBanner } from '@/components/ds';

/** 56px round icon heading a result screen: a green check or an amber warning. */
export function StatusIcon({ tone }: { tone: 'success' | 'warning' }) {
  const Icon = tone === 'success' ? Check : AlertTriangle;
  return (
    <span
      className={cn(
        'grid size-14 place-items-center rounded-full',
        tone === 'success' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
      )}
    >
      <Icon size={26} strokeWidth={2.25} aria-hidden />
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex h-10 items-center gap-1.5 self-start text-[14px] font-bold text-gray-600 hover:text-gray-900',
        FOCUS_RING
      )}
    >
      <ArrowLeft size={16} aria-hidden />
      {children}
    </Link>
  );
}
