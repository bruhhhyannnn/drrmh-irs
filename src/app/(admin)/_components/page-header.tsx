import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { HeaderMenu, type HeaderMenuItem } from './header-menu';
import { BACK_LINK, MoreBackLink } from './shell/more-back-link';

/**
 * Page title row: an optional Back link above (on phone, "More" on the pages the More tab
 * opens), the campus logo, the title with a status chip, one line under it, and the page's
 * actions on the right (wrapping under on narrow screens).
 *
 * `actions` are the buttons people use often (exports, Add …, Complete event). Rare ones (Edit,
 * Delete, …) go in `menu`, behind a ⋯ button after the buttons; on phone ⋯ stays beside the
 * title and opens a bottom sheet. ⋯ only shows when `menu` has items; falsy entries are skipped.
 */
export function PageHeader({
  title,
  subtitle,
  chip,
  logo,
  back,
  actions,
  menu,
}: {
  title: string;
  subtitle?: React.ReactNode;
  chip?: React.ReactNode;
  logo?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  menu?: (HeaderMenuItem | false | null | undefined)[];
}) {
  const menuItems = (menu ?? []).filter((item): item is HeaderMenuItem => !!item);
  const hasMenu = menuItems.length > 0;
  return (
    <div className="flex flex-col gap-3">
      {back ? (
        <Link href={back.href} className={cn(BACK_LINK, FOCUS_RING)}>
          <ArrowLeft size={16} aria-hidden />
          {back.label}
        </Link>
      ) : (
        <MoreBackLink />
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_300px] items-center gap-4">
          {logo}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[26px] leading-[1.2] font-extrabold text-balance md:text-[28px] lg:text-[30px]">
                {title}
              </h1>
              {chip}
            </div>
            {subtitle && (
              <p className="text-[16px] leading-normal text-pretty text-gray-600">{subtitle}</p>
            )}
          </div>
          {hasMenu && (
            <div className="self-start md:hidden">
              <HeaderMenu items={menuItems} title={title} variant="sheet" />
            </div>
          )}
        </div>
        {(actions || hasMenu) && (
          <div
            className={cn(
              'flex max-w-full min-w-0 flex-wrap items-center gap-2',
              !actions && 'max-md:hidden'
            )}
          >
            {actions}
            {hasMenu && (
              <div className="hidden md:block">
                <HeaderMenu items={menuItems} title={title} variant="dropdown" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
