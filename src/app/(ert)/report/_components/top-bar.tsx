'use client';

import { ProfileDrawer } from '@/components/auth';
import { FOCUS_RING } from '@/components/ds';
import { cn, supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { ChevronDown, LogOut, User } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Avatar, GUTTER, personName } from './chrome';
import { WaitingToSend } from './waiting-to-send';

/**
 * Logo and name on the left; on the right, the "waiting to send" chip while a report is queued
 * on this phone, and the account button, which holds My profile and Sign out.
 */
export function TopBar() {
  const { userProfile } = useAuthStore();
  return (
    <header className="border-b border-line bg-surface">
      <div className={cn(GUTTER, 'relative flex h-16 items-center gap-2.5 md:h-18')}>
        <Image
          src="/irs-logo.png"
          alt="IRS logo"
          width={32}
          height={32}
          className="size-6.5 shrink-0 object-contain md:size-8"
        />
        <span className="text-[17px] leading-[1.2] font-extrabold whitespace-nowrap">
          DRRM-H IRS
        </span>
        <div className="flex-1" />
        {userProfile && <WaitingToSend />}
        {userProfile && <AccountMenu />}
      </div>
    </header>
  );
}

function AccountMenu() {
  const router = useRouter();
  const { user, userProfile, reset } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!userProfile) return null;
  const name = personName(userProfile) || userProfile.email;
  const email = userProfile.email ?? user?.email ?? '';

  const signOut = async () => {
    setOpen(false);
    const toastId = toast.loading('Signing out…');
    await supabase.auth.signOut();
    reset();
    toast.success('Signed out', { id: toastId });
    router.replace('/signin');
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account: ${name}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-gray-200 bg-surface pr-2.5 pl-1.5 hover:bg-gray-50',
          FOCUS_RING
        )}
      >
        <Avatar name={name} size={32} />
        <span className="hidden max-w-50 truncate text-[16px] font-semibold md:inline">{name}</span>
        <ChevronDown size={16} aria-hidden className="text-gray-500" />
      </button>

      {open && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-[rgba(16,24,40,.25)]"
            onClick={() => setOpen(false)}
          />
          <div
            ref={menuRef}
            id={menuId}
            className="absolute top-[calc(100%-4px)] right-4 z-50 flex w-[calc(100%-32px)] flex-col overflow-hidden rounded-[22px] border border-gray-200 bg-surface shadow-[0_18px_40px_rgba(16,24,40,.22)] md:right-8 md:w-75 lg:right-10"
          >
            <div className="flex items-center gap-3 p-4.5">
              <Avatar name={name} size={44} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[17px] font-bold">{name}</span>
                <span className="truncate text-[14px] text-gray-500">{email}</span>
              </div>
            </div>
            <div className="flex flex-col border-t border-line p-1.5">
              <MenuButton
                onClick={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
              >
                <User size={18} aria-hidden className="text-gray-600" />
                My profile
              </MenuButton>
              <MenuButton tone="danger" onClick={signOut}>
                <LogOut size={18} aria-hidden />
                Sign out
              </MenuButton>
            </div>
          </div>
        </>
      )}

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function MenuButton({
  tone,
  onClick,
  children,
}: {
  tone?: 'danger';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-12 items-center gap-3 rounded-[14px] px-3 text-left text-[17px] font-semibold',
        tone === 'danger' ? 'hover:bg-error-50 text-error-700' : 'text-gray-900 hover:bg-gray-50',
        FOCUS_RING
      )}
    >
      {children}
    </button>
  );
}
