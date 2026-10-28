'use client';

import { ProfileDrawer } from '@/components/auth';
import { figtree, FOCUS_RING, splineSansMono } from '@/components/ds';
import { usePendingBystanderCount } from '@/components/hooks/use-bystander-reports';
import { cn, getInitials } from '@/lib';
import { useAuthStore } from '@/store';
import { ArrowUpRight, ChevronDown, Menu } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import packageJson from '../../../../../package.json';
import { CampusLabel, CampusSwitcher, useIsSuperAdmin, useScopedCampusId } from './campus-switcher';
import { isActivePath, MORE_HREF, navFor, SUPER_ADMIN_HREFS, type NavItem } from './nav';

const { version } = packageJson;

// One shell for every admin page: sidebar on web (≥1024px), an 88px icon rail on tablet
// (≥768px), bottom tabs on phone. The top bar holds the campus switcher (super admins) or the
// assigned campus (administrators) and the account button.

/** The DRRM pillar items open in a new tab: they will become their own apps. */
function newTabProps(item: NavItem) {
  return item.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

const NEW_TAB_NOTE = <span className="sr-only"> (opens in a new tab)</span>;

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
        'font-landing min-h-dvh bg-canvas text-gray-900 antialiased'
      )}
    >
      <Sidebar />
      <Rail />
      <div className="flex min-h-dvh min-w-0 flex-col md:pl-22 lg:pl-60">
        <TopBar />
        <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 pt-4 pb-26 md:px-6 md:pt-6 md:pb-10 lg:px-8 lg:pt-8">
          <CampusScopeGate>{children}</CampusScopeGate>
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}

/**
 * Keeps administrators on their own campus: the Campus pages send them to the dashboard, and
 * without an assigned campus there is nothing to scope the pages to.
 */
function CampusScopeGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isSuperAdmin = useIsSuperAdmin();
  const hasCampus = useAuthStore((s) => !!s.userProfile?.campus_id);
  const blocked = !isSuperAdmin && SUPER_ADMIN_HREFS.some((href) => isActivePath(pathname, href));

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

function Sidebar() {
  const pathname = usePathname();
  const pending = usePendingBadge();
  const userType = useAuthStore((s) => s.userProfile?.user_type?.name);
  const nav = navFor(useIsSuperAdmin());
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
          const on = isActivePath(pathname, item.href);
          return (
            <div key={item.key} className="flex flex-col">
              {item.group && (
                <span className="px-3 pt-4 pb-1.5 text-[11px] font-bold tracking-[.08em] text-gray-500 uppercase">
                  {item.group}
                </span>
              )}
              <Link
                href={item.href}
                {...newTabProps(item)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3 text-[14px]',
                  on
                    ? 'bg-brand-25 text-brand-500 font-bold'
                    : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  FOCUS_RING
                )}
              >
                <item.icon size={20} aria-hidden className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.newTab && (
                  <>
                    <ArrowUpRight size={16} aria-hidden className="shrink-0 text-gray-400" />
                    {NEW_TAB_NOTE}
                  </>
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

function Rail() {
  const pathname = usePathname();
  const pending = usePendingBadge();
  const nav = navFor(useIsSuperAdmin());
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
          const on = isActivePath(pathname, item.href);
          return (
            <Fragment key={item.key}>
              {/* The rail has no group titles; a rule sets the pillars (separate apps) apart. */}
              {item.group && item.newTab && (
                <span aria-hidden className="bg-line my-1.5 h-px w-10 shrink-0" />
              )}
              <Link
                href={item.href}
                {...newTabProps(item)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'relative flex w-18 flex-col items-center gap-1 rounded-[14px] pt-2 pb-1.75 text-center text-[11px] leading-[1.2]',
                  on
                    ? 'bg-brand-25 text-brand-500 font-bold'
                    : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  FOCUS_RING
                )}
              >
                <item.icon size={20} aria-hidden />
                <span>{item.short}</span>
                {item.newTab && NEW_TAB_NOTE}
                {item.key === 'bystander' && pending > 0 && (
                  <>
                    <BadgeDot className="top-1.25 right-4.5" />
                    <span className="sr-only">, {pending} pending</span>
                  </>
                )}
              </Link>
            </Fragment>
          );
        })}
      </nav>
    </aside>
  );
}

function BottomTabs() {
  const pathname = usePathname();
  const pending = usePendingBadge();
  const nav = navFor(useIsSuperAdmin());
  const tabs = nav.filter((n) => n.tab);
  // The More page and the pages it opens (Campus, Users, Settings…) light up More.
  const moreActive =
    isActivePath(pathname, MORE_HREF) || nav.some((n) => !n.tab && isActivePath(pathname, n.href));

  return (
    <nav
      aria-label="Main"
      data-bottom-bar
      className="fixed inset-x-0 bottom-0 z-40 grid h-17 grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((item) => {
        const on = isActivePath(pathname, item.href);
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
              'flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-gray-200 bg-surface pr-2.5 pl-1.5 hover:bg-gray-50',
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
