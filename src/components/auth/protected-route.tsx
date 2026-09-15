'use client';

import { supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Spinner } from '../ui';

const REDIRECT_USER_TYPES: Record<string, string> = {
  'ERT Member': '/report',
  Bystander: '/report',
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userProfile, profileError, loading, reset } = useAuthStore();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (loading || isRedirecting || profileError) return;

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
  }, [loading, user, userProfile, profileError, router, isRedirecting]);

  if (profileError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            Account Loading Failed
          </h2>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{profileError}</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                reset();
                router.replace('/signin');
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
