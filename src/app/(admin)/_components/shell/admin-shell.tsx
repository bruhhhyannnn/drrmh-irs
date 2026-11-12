'use client';

import { ProfileDrawer } from '@/components/auth';
import { figtree, FOCUS_RING, splineSansMono } from '@/components/ds';
import { usePendingBystanderCount } from '@/components/hooks/use-bystander-reports';
import { cn, getInitials } from '@/lib';
import { useAuthStore } from '@/store';
import { ChevronDown, Menu } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import packageJson from '../../../../../package.json';
import { CampusMark, Mono } from '../ui';
import { CampusLabel, CampusSwitcher, useIsSuperAdmin, useScopedCampusId } from './campus-switcher';
import {
  CAMPUSES_KEY,
  campusPageHref,
  isActiveItem,
  isActivePath,
  isSuperAdminPath,
  MORE_HREF,
} from './nav';
import { useNav, useSidebarCampuses, type SidebarCampus } from './use-nav';

const { version } = packageJson;

// One shell for every admin page: sidebar on web (≥1024px), an 88px icon rail on tablet
// (≥768px), bottom tabs on phone. The top bar holds the campus switcher (super admins) or the
// assigned campus (administrators) and the account button.

function usePendingBadge() {
  const campusId = useScopedCampusId();
  const { data: pending = 0 } = usePendingBystanderCount(campusId || undefined);
  return pending;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        figtree.variable,
        splineSansMono.variable,
        // isolate: a page's CampusBackdrop (-z-10) paints over this background, under the content.
        'font-landing isolate min-h-dvh bg-canvas text-gray-900 antialiased'
      )}
    >
      {/* The nav reads the open campus from the link. */}
      <Suspense>
        <Sidebar />
        <Rail />
      </Suspense>
      <div className="flex min-h-dvh min-w-0 flex-col md:pl-22 lg:pl-60">
        <TopBar />
        <main className="relative mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 pt-4 pb-26 md:px-6 md:pt-6 md:pb-10 lg:px-8 lg:pt-8">
          <CampusScopeGate>{children}</CampusScopeGate>
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}

/**
 * Keeps administrators on their own campus: the campus list sends them to the dashboard (their
 * campus page checks the campus itself), and without an assigned campus there is nothing to
 * scope the pages to.
 */
function CampusScopeGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isSuperAdmin = useIsSuperAdmin();
  const hasCampus = useAuthStore((s) => !!s.userProfile?.campus_id);
  const blocked = !isSuperAdmin && isSuperAdminPath(pathname);

  useEffect(() => {
    if (blocked) router.replace('/dashboard');
  }, [blocked, router]);

  if (blocked) return null;
  if (!isSuperAdmin && !hasCampus) {
    return (
      <div className="flex flex-col gap-1.5 rounded-[22px] border border-gray-200 bg-surface p-6">
        <h1 className="text-[18px] font-bold">No campus assigned</h1>
        <p className="text-[15px] leading-normal text-pretty text-gray-600">
          Your account isn&apos;t linked to a campus yet, so there is nothing to show. Ask a super
          admin to set your campus in Users.
        </p>
      </div>
    );
  }
  return children;
}

function roleLabel(type?: string) {
  return type === 'Super Admin' ? 'Super admin' : 'Administrator';
}

const SIDE_ITEM = 'flex h-11 items-center gap-3 rounded-xl px-3 text-[14px]';
const sideState = (on: boolean) =>
  on
    ? 'bg-brand-25 text-brand-500 font-bold'
    : 'font-medium text-gray-600 transition-colors duration-120 ease-out hover:bg-hover hover:text-gray-900';

/** The campus a super admin's campus page shows, so its sidebar row lights up. */
function useOpenCampusId() {
  const pathname = usePathname();
  const id = useSearchParams().get('id');
  return pathname === '/campus/details' ? id : null;
}

/** "Live" with a green dot: the campus has an ongoing event. */
function LiveDot({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <span
      aria-hidden
      className="absolute top-1.5 right-4 size-2.5 rounded-full border-2 border-surface bg-success-500"
    />
  ) : (
    <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-success-700">
      <span aria-hidden className="size-1.5 rounded-full bg-success-500" />
      Live
    </span>
  );
}

function SidebarCampusLinks({ campuses }: { campuses: SidebarCampus[] }) {
  const openId = useOpenCampusId();
  return campuses.map((c) => {
    const on = openId === c.id;
    return (
      <Link
        key={c.id}
        href={campusPageHref(c.id)}
        aria-current={on ? 'page' : undefined}
        className={cn(SIDE_ITEM, sideState(on), FOCUS_RING)}
      >
        <CampusMark name={c.name} size={22} />
        <span className="min-w-0 flex-1 truncate">{c.name}</span>
        {c.live && <LiveDot />}
      </Link>
    );
  });
}

function Sidebar() {
  const pathname = usePathname();
  const pending = usePendingBadge();
  const userType = useAuthStore((s) => s.userProfile?.user_type?.name);
  const isSuperAdmin = useIsSuperAdmin();
  const nav = useNav();
  const { campuses, total } = useSidebarCampuses(isSuperAdmin);
  const listed = new Set(campuses.map((c) => c.id));
  const openId = useOpenCampusId();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
      <Link
        href="/dashboard"
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-line px-5',
          FOCUS_RING,
          'focus-visible:-outline-offset-3'
        )}
      >
        <Image
          src="/irs-logo.png"
          alt=""
          width={36}
          height={36}
          className="size-9 object-contain"
        />
        <span className="flex flex-col gap-px">
          <span className="text-[15px] leading-[1.2] font-extrabold">DRRM-H IRS</span>
          <span className="text-[12px] font-medium text-gray-500">{roleLabel(userType)}</span>
        </span>
      </Link>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {nav.map((item) => {
          const campusItem = item.key === CAMPUSES_KEY;
          // All campuses lights up on the list, and on a campus page the list above doesn't show.
          const on =
            campusItem && isSuperAdmin
              ? pathname === '/campus' ||
                (pathname === '/campus/details' && !(openId && listed.has(openId)))
              : isActiveItem(pathname, item);
          return (
            <div key={item.key} className="flex flex-col">
              {item.group && (
                <span className="px-3 pt-4 pb-1.5 text-[11px] font-bold tracking-[.08em] text-gray-500 uppercase">
                  {item.group}
                </span>
              )}
              {campusItem && isSuperAdmin && <SidebarCampusLinks campuses={campuses} />}
              <Link
                href={item.href}
                aria-current={on ? 'page' : undefined}
                className={cn(SIDE_ITEM, sideState(on), FOCUS_RING)}
              >
                {campusItem && !isSuperAdmin && item.label !== 'Campus' ? (
                  <CampusMark name={item.label} size={22} />
                ) : (
                  <item.icon size={20} aria-hidden className="shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {campusItem && isSuperAdmin && total > 0 && (
                  <Mono className="shrink-0 text-[13px] font-semibold text-gray-500">{total}</Mono>
                )}
                {item.key === 'bystander' && pending > 0 && (
                  <span className="font-landing-mono bg-error-600 grid h-5.5 min-w-5.5 place-items-center rounded-full px-1.75 text-[12px] font-bold text-white">
                    <span className="sr-only">, </span>
                    {pending}
                    <span className="sr-only"> pending</span>
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      <p className="border-t border-line px-5 py-4 text-[12px] text-gray-500">
        DRRM-H © {new Date().getFullYear()} · Version {version}
      </p>
    </aside>
  );
}

function BadgeDot({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn('bg-error-600 absolute size-2 rounded-full border-2 border-surface', className)}
    />
  );
}

function RailCampusLinks({ campuses }: { campuses: SidebarCampus[] }) {
  const openId = useOpenCampusId();
  return campuses.map((c) => {
    const on = openId === c.id;
    return (
      <Link
        key={c.id}
        href={campusPageHref(c.id)}
        aria-current={on ? 'page' : undefined}
        aria-label={c.live ? `${c.name}, live` : c.name}
        className={cn(RAIL_ITEM, sideState(on), FOCUS_RING)}
      >
        <CampusMark name={c.name} size={22} />
        <span aria-hidden className="max-w-full truncate px-1">
          {c.name.replace(/^UP\s+/i, '')}
        </span>
        {c.live && <LiveDot compact />}
      </Link>
    );
  });
}

const RAIL_ITEM =
  'relative flex w-18 flex-col items-center gap-1 rounded-[14px] pt-2 pb-1.75 text-center text-[11px] leading-[1.2]';

function Rail() {
  const pathname = usePathname();
  const pending = usePendingBadge();
  const isSuperAdmin = useIsSuperAdmin();
  const nav = useNav();
  const { campuses } = useSidebarCampuses(isSuperAdmin);
  const listed = new Set(campuses.map((c) => c.id));
  const openId = useOpenCampusId();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-22 flex-col items-center gap-1 overflow-y-auto border-r border-line bg-surface px-2 py-3.5 md:flex lg:hidden">
      <Link
        href="/dashboard"
        aria-label="Dashboard"
        className={cn('mb-3.5 rounded-lg', FOCUS_RING)}
      >
        <Image
          src="/irs-logo.png"
          alt=""
          width={36}
          height={36}
          className="size-9 object-contain"
        />
      </Link>
      <nav aria-label="Main" className="flex flex-col items-center gap-1">
        {nav.map((item) => {
          const campusItem = item.key === CAMPUSES_KEY;
          const on =
            campusItem && isSuperAdmin
              ? pathname === '/campus' ||
                (pathname === '/campus/details' && !(openId && listed.has(openId)))
              : isActiveItem(pathname, item);
          return (
            <div key={item.key} className="flex flex-col items-center gap-1">
              {/* The rail has no group titles; a rule sets each group apart. */}
              {item.group && <span aria-hidden className="bg-line my-1.5 h-px w-10 shrink-0" />}
              {campusItem && isSuperAdmin && <RailCampusLinks campuses={campuses} />}
              <Link
                href={item.href}
                aria-current={on ? 'page' : undefined}
                className={cn(RAIL_ITEM, sideState(on), FOCUS_RING)}
              >
                {campusItem && !isSuperAdmin && item.label !== 'Campus' ? (
                  <CampusMark name={item.label} size={22} />
                ) : (
                  <item.icon size={20} aria-hidden />
                )}
                <span>{campusItem && isSuperAdmin ? 'All' : item.short}</span>
                {item.key === 'bystander' && pending > 0 && (
                  <>
                    <BadgeDot className="top-1.25 right-4.5" />
                    <span className="sr-only">, {pending} pending</span>
                  </>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function BottomTabs() {
  const pathname = usePathname();
  const pending = usePendingBadge();
  const nav = useNav();
  const tabs = nav.filter((n) => n.tab);
  // The More page and the pages it opens (Reports, Users, Settings…) light up More.
  const moreActive =
    isActivePath(pathname, MORE_HREF) || nav.some((n) => !n.tab && isActiveItem(pathname, n));

  return (
    <nav
      aria-label="Main"
      data-bottom-bar
      className="fixed inset-x-0 bottom-0 z-40 grid h-17 grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((item) => {
        // Campuses lights up on the list and on any campus page.
        const on = isActiveItem(
          pathname,
          item.key === CAMPUSES_KEY ? { ...item, href: '/campus' } : item
        );
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 text-[11px]',
              on ? 'text-brand-500 font-bold' : 'font-medium text-gray-600',
              FOCUS_RING,
              'focus-visible:-outline-offset-3'
            )}
          >
            <item.icon size={20} aria-hidden />
            <span>{item.short}</span>
            {item.key === 'bystander' && pending > 0 && (
              <>
                <BadgeDot className="top-2.5 left-[calc(50%+6px)]" />
                <span className="sr-only">, {pending} pending</span>
              </>
            )}
          </Link>
        );
      })}
      <Link
        href={MORE_HREF}
        aria-current={pathname === MORE_HREF ? 'page' : undefined}
        className={cn(
          'flex flex-col items-center justify-center gap-1 text-[11px]',
          moreActive ? 'text-brand-500 font-bold' : 'font-medium text-gray-600',
          FOCUS_RING,
          'focus-visible:-outline-offset-3'
        )}
      >
        <Menu size={20} aria-hidden />
        <span>More</span>
      </Link>
    </nav>
  );
}

function TopBar() {
  const { userProfile, user } = useAuthStore();
  const isSuperAdmin = useIsSuperAdmin();
  const [profileOpen, setProfileOpen] = useState(false);
  const name =
    [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'Account';

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-15 w-full max-w-7xl items-center gap-3 px-4 md:h-16 md:px-6 lg:px-8">
          <Image
            src="/irs-logo.png"
            alt="IRS logo"
            width={28}
            height={28}
            className="size-7 shrink-0 object-contain md:hidden"
          />
          {isSuperAdmin ? <CampusSwitcher /> : <CampusLabel />}
          <div className="flex-1" />
          <button
            type="button"
            aria-label={`My profile: ${name}`}
            onClick={() => setProfileOpen(true)}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-gray-200 bg-surface pr-2.5 pl-1.5 hover:bg-hover',
              FOCUS_RING
            )}
          >
            <span
              aria-hidden
              className="bg-brand-solid grid size-8 place-items-center rounded-full text-[13px] font-bold text-white uppercase"
            >
              {getInitials(name).slice(0, 2)}
            </span>
            <span className="hidden max-w-50 truncate text-[14px] font-semibold lg:inline">
              {name}
            </span>
            <ChevronDown size={16} aria-hidden className="text-gray-500" />
          </button>
        </div>
      </header>
      {/* Outside the sticky header so it isn't held under the sidebar's stacking level. */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
