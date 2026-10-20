'use client';

import { isAdminUserType } from '@/lib';
import { canUseAssessment } from '@/lib/access';
import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export type ErtProfile = NonNullable<ReturnType<typeof useAuthStore.getState>['userProfile']>;

export type ErtAccess =
  { status: 'checking' } | { status: 'setup' } | { status: 'ready'; profile: ErtProfile };

/**
 * The guard every ERT page shares. Signed out → /signin, admin → /dashboard, and with
 * `requireAssessment`, someone who can't use the assessment → /home. `setup` means the profile
 * isn't complete yet: the page shows ProfileSetup in its place.
 */
export function useErtAccess(options: { requireAssessment?: boolean } = {}): ErtAccess {
  const router = useRouter();
  const { user, userProfile, loading } = useAuthStore();
  const isAdmin = !!userProfile && isAdminUserType(userProfile.user_type?.name);
  const blocked = !!options.requireAssessment && !!userProfile && !canUseAssessment(userProfile);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/signin');
    else if (isAdmin) router.replace('/dashboard');
    else if (blocked) router.replace('/home');
  }, [loading, user, isAdmin, blocked, router]);

  if (loading || !user || !userProfile || isAdmin || blocked) return { status: 'checking' };
  if (!userProfile.is_profile_complete) return { status: 'setup' };
  return { status: 'ready', profile: userProfile };
}
