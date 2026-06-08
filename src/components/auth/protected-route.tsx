'use client';

import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '../ui';

const REDIRECT_USER_TYPES: Record<string, string> = {
  'ERT Member': '/report',
  Bystander: '/report',
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuthStore();
  const router = useRouter();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user) {
      const path = window.location.pathname + window.location.search;
      const from = path === '/' ? '/dashboard' : path;
      router.push(`/signin?from=${encodeURIComponent(from)}`);
    }
  }, [user, loading, router]);

  // Redirect non-admin user types to their appropriate page (without signing out)
  useEffect(() => {
    const typeName = userProfile?.user_type?.name;
    if (!loading && user && typeName && typeName in REDIRECT_USER_TYPES) {
      router.replace(REDIRECT_USER_TYPES[typeName]);
    }
  }, [loading, userProfile, router, user]);

  const isRedirecting =
    !loading &&
    user &&
    !!userProfile?.user_type?.name &&
    userProfile.user_type.name in REDIRECT_USER_TYPES;

  if (loading || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
