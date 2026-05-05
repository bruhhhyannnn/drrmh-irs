'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { Spinner } from '../ui';
import { FORBIDDEN_USER_TYPES } from '@/types';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuthStore();
  const router = useRouter();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user) {
      const path = window.location.pathname + window.location.search;
      router.push(`/landing?from=${encodeURIComponent(path)}`);
    }
  }, [user, loading, router]);

  // Sign out and redirect forbidden user types
  useEffect(() => {
    if (
      !loading &&
      user &&
      userProfile?.user_type?.name &&
      FORBIDDEN_USER_TYPES.includes(userProfile.user_type.name)
    ) {
      supabase.auth.signOut().then(() => {
        router.push(
          `/signin?error=unauthorized&message=${encodeURIComponent('Your account does not have access to this resource.')}`
        );
      });
    }
  }, [loading, userProfile, router, user]);

  const isForbidden =
    !loading &&
    user &&
    userProfile?.user_type?.name &&
    FORBIDDEN_USER_TYPES.includes(userProfile.user_type.name);

  if (loading || isForbidden) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
