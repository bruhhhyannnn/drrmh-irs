'use client';

import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '../ui';

const REDIRECT_USER_TYPES: Record<string, string> = {
  'ERT Member': '/report',
  Bystander: '/report',
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuthStore();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (loading || isRedirecting) return;

    // No user → send to sign in
    if (!user) {
      const path = window.location.pathname + window.location.search;
      const from = path === '/' ? '/dashboard' : path;
      setIsRedirecting(true);
      router.push(`/signin?from=${encodeURIComponent(from)}`);
      return;
    }

    // Has user but profile not yet loaded → wait
    if (!userProfile) return;

    // Non-admin user type → send to their page
    const typeName = userProfile.user_type?.name;
    if (typeName && typeName in REDIRECT_USER_TYPES) {
      setIsRedirecting(true);
      router.replace(REDIRECT_USER_TYPES[typeName]);
    }
  }, [loading, user, userProfile, router, isRedirecting]);

  // Show spinner while auth is resolving or navigation is in flight
  if (loading || isRedirecting || (user && !userProfile)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
