'use client';

import { adminGuard } from '@/lib/access';
import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '../ui/loader';
import { AccountLoadFailed } from './account-load-failed';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userProfile, profileError, loading } = useAuthStore();
  const router = useRouter();
  const guard = adminGuard({ loading, hasUser: !!user, profile: userProfile, profileError });
  const signedOut = guard.status === 'signin';
  const redirectTo = guard.status === 'redirect' ? guard.to : null;

  useEffect(() => {
    if (signedOut) {
      const path = window.location.pathname + window.location.search;
      const from = path === '/' ? '/dashboard' : path;
      router.push(`/signin?from=${encodeURIComponent(from)}`);
    } else if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [signedOut, redirectTo, router]);

  if (guard.status === 'error') return <AccountLoadFailed />;
  if (guard.status === 'allow') return <>{children}</>;
  return <Loader fullScreen label="Checking your access…" />;
}
