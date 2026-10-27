'use client';

import { ProfileDrawer, useSignOut } from '@/components/auth';
import { Button, FOCUS_RING } from '@/components/ds';
import { AppearanceSetting } from '@/components/theme';
import { cn } from '@/lib';
import { useAuthStore } from '@/store';
import { ArrowUpRight, ChevronRight, LogOut, User, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import packageJson from '../../../../package.json';
import { PageHeader } from '../_components/page-header';
import { useIsSuperAdmin } from '../_components/shell/campus-switcher';
import { moreGroups, navFor } from '../_components/shell/nav';

const { version } = packageJson;

const ROW = cn(
  'flex min-h-16 w-full items-center gap-3.5 border-t border-line px-4 py-2.5 text-left text-gray-900 first:border-t-0 hover:bg-gray-50',
  FOCUS_RING,
  'focus-visible:-outline-offset-3'
);

/**
 * The More tab on phone: every page the sidebar has that the bottom tabs don't (Campus, Users,
 * Settings…), then My profile, Appearance and Sign out, as the sidebar and profile give on web.
 */
export default function MorePage() {
  const nav = navFor(useIsSuperAdmin());
  const { userProfile, user } = useAuthStore();
  const { signOut, signingOut } = useSignOut();
  const [profileOpen, setProfileOpen] = useState(false);
  const email = userProfile?.email ?? user?.email ?? '';

  return (
    <>
      <PageHeader title="More" subtitle="Pages that are not in the tab bar, and your account." />

      {moreGroups(nav).map((group) => (
        <Group key={group.title} title={group.title}>
          {group.items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              {...(item.newTab && { target: '_blank', rel: 'noopener noreferrer' })}
              className={ROW}
            >
              <RowText icon={item.icon} label={item.label} sub={item.description} />
              {item.newTab ? (
                <>
                  <ArrowUpRight size={18} aria-hidden className="shrink-0 text-gray-400" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </>
              ) : (
                <ChevronRight size={18} aria-hidden className="shrink-0 text-gray-400" />
              )}
            </Link>
          ))}
        </Group>
      ))}

      <Group title="Account">
        <button type="button" onClick={() => setProfileOpen(true)} className={ROW}>
          <RowText icon={User} label="My profile" sub={email} />
          <ChevronRight size={18} aria-hidden className="shrink-0 text-gray-400" />
        </button>
      </Group>

      <AppearanceSetting />

      <Button variant="danger" fullWidth loading={signingOut} onClick={signOut}>
        <LogOut size={18} aria-hidden />
        Sign out
      </Button>
      <p className="text-center text-[12px] text-gray-500">
        DRRM-H © {new Date().getFullYear()} · Version {version}
      </p>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[11px] font-bold tracking-[.08em] text-gray-500 uppercase">
        {title}
      </h2>
      <div className="flex flex-col overflow-hidden rounded-[22px] border border-gray-200 bg-surface shadow-[0_1px_3px_rgba(16,24,40,.08)]">
        {children}
      </div>
    </section>
  );
}

function RowText({ icon: Icon, label, sub }: { icon: LucideIcon; label: string; sub?: string }) {
  return (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-600">
        <Icon size={20} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        {sub && <span className="truncate text-[13px] leading-[1.4] text-gray-500">{sub}</span>}
      </span>
    </>
  );
}
