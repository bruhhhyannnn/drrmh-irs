'use client';

import { QuestionLanguageSetting } from '@/components/assessment/question-language-setting';
import { Button, Drawer } from '@/components/ds';
import { AppearanceSetting } from '@/components/theme';
import { cn, getInitials, supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { format } from 'date-fns';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

const BADGE_TONES = {
  maroon: 'bg-brand-25 text-brand-500',
  green: 'bg-success-50 text-success-700',
  amber: 'bg-warning-50 text-warning-700',
  grey: 'bg-gray-100 text-gray-600',
};

function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-[12px] large-text:text-[13px] font-semibold whitespace-nowrap',
        BADGE_TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

/** My profile: who is signed in, their assignment, and Sign out. Opens from the account button. */
export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { userProfile, user, reset } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);

  if (!userProfile) return null;

  const fullName =
    [userProfile.first_name, userProfile.middle_name, userProfile.last_name, userProfile.suffix]
      .filter(Boolean)
      .join(' ') ||
    (user?.email?.split('@')[0] ?? 'User');
  const email = userProfile.email ?? user?.email ?? '';

  const signOut = async () => {
    setSigningOut(true);
    const toastId = toast.loading('Signing out…');
    await supabase.auth.signOut();
    reset();
    toast.success('Signed out', { id: toastId });
    router.replace('/signin');
  };

  const rows = [
    { label: 'Username', value: userProfile.username },
    { label: 'Campus', value: userProfile.campus?.name },
    { label: 'Cluster', value: userProfile.cluster?.name ?? userProfile.unit?.cluster?.name },
    { label: 'Unit / Building', value: userProfile.unit?.name },
    { label: 'Position', value: userProfile.position?.name },
    {
      label: 'Member since',
      value: userProfile.created_at
        ? format(new Date(userProfile.created_at), 'MMM d, yyyy')
        : null,
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="My profile"
      footer={
        <Button variant="danger" fullWidth loading={signingOut} onClick={signOut}>
          <LogOut size={18} aria-hidden />
          Sign out
        </Button>
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className="bg-brand-solid grid size-12 shrink-0 place-items-center rounded-full text-[16px] large-text:text-[18px] font-bold text-white uppercase"
            >
              {getInitials(fullName).slice(0, 2)}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[17px] large-text:text-[19px] leading-[1.3] font-bold">
                {fullName}
              </span>
              <span className="truncate text-[13px] large-text:text-[14px] text-gray-500">
                {email}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="maroon">{userProfile.user_type.name}</Badge>
            <Badge tone={userProfile.is_active ? 'green' : 'grey'}>
              {userProfile.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge tone={userProfile.is_profile_complete ? 'green' : 'amber'}>
              {userProfile.is_profile_complete ? 'Profile complete' : 'Profile incomplete'}
            </Badge>
          </div>
        </div>

        <section className="flex flex-col gap-3.5">
          <h3 className="text-[11px] large-text:text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
            Details
          </h3>
          <dl className="flex flex-col rounded-2xl border border-line bg-surface px-4 py-0.5">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-line py-3 text-[14px] large-text:text-[16px] leading-[1.45] last:border-b-0"
              >
                <dt className="flex-[0_0_130px] text-gray-500">{row.label}</dt>
                <dd className="min-w-0 flex-[1_1_160px] font-semibold text-gray-900">
                  {row.value || '—'}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <AppearanceSetting />
        <QuestionLanguageSetting />
      </div>
    </Drawer>
  );
}
