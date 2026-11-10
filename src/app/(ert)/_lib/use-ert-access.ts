'use client';

import { ertGuard } from '@/lib/access';
import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export type ErtProfile = NonNullable<ReturnType<typeof useAuthStore.getState>['userProfile']>;

export type ErtAccess =
  | { status: 'checking' }
  | { status: 'error' }
  | { status: 'setup' }
  | { status: 'ready'; profile: ErtProfile };

/**
 * The guard every ERT page shares. Signed out → /signin, admin → /dashboard, and with
 * `requireAssessment`, someone who can't use the assessment → /home. `setup` means the profile
 * isn't complete yet: the page shows ProfileSetup in its place. `error` means the profile could
 * not be loaded: the page shows AccountLoadFailed.
 */
export function useErtAccess(options: { requireAssessment?: boolean } = {}): ErtAccess {
  const router = useRouter();
  const { user, userProfile, profileError, loading } = useAuthStore();
  const guard = ertGuard(
    { loading, hasUser: !!user, profile: userProfile, profileError },
    { requireAssessment: options.requireAssessment }
  );
  const redirectTo = guard.status === 'redirect' ? guard.to : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (guard.status === 'redirect') return { status: 'checking' };
  if (guard.status === 'ready') return { status: 'ready', profile: userProfile! };
  return { status: guard.status };
}
