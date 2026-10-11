import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Page title row: an optional Back link above, the campus logo, the title with a status chip,
 * one line under it, and the page's actions on the right (wrapping under on narrow screens).
 */
export function PageHeader({
  title,
  subtitle,
  chip,
  logo,
  back,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  chip?: React.ReactNode;
  logo?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {back && (
        <Link
          href={back.href}
          className={cn(
            '-ml-1 flex h-8 items-center gap-1.5 self-start rounded-lg px-1 text-[14px] font-bold text-gray-600 hover:text-gray-900',
            FOCUS_RING
          )}
        >
          <ArrowLeft size={16} aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_300px] items-center gap-4">
          {logo}
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[24px] leading-[1.2] font-extrabold text-balance md:text-[26px] lg:text-[28px]">
                {title}
              </h1>
              {chip}
            </div>
            {subtitle && (
              <p className="text-[14px] leading-normal text-pretty text-gray-600">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex max-w-full min-w-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
