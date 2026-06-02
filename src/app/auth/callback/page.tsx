'use client';

/**
 * Google OAuth Callback Page
 *
 * This page handles the redirect from Supabase after Google sign-in.
 *
 * Why a page.tsx and not a route.ts (Route Handler)?
 * The project uses @supabase/supabase-js without @supabase/ssr. The PKCE flow
 * stores the code verifier in localStorage (browser-only), so the supabase-js
 * client must be the one to exchange the code — it does this automatically on
 * initialization via detectSessionInUrl. A server Route Handler has no access
 * to localStorage and cannot complete the exchange.
 *
 * Supabase Dashboard setup required before this works:
 *   1. Authentication → Providers → Google: enable, add Client ID + Secret
 *   2. Authentication → URL Configuration → Redirect URLs: add
 *      http://localhost:3000/auth/callback (dev) and
 *      https://your-domain.com/auth/callback (prod)
 *   3. Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs:
 *      add the Supabase callback URL shown in the dashboard
 */

import { provisionGoogleUser } from '@/actions/auth';
import { Spinner } from '@/components/ui';
import { supabase } from '@/lib';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let handled = false;
    const timeout = setTimeout(() => setError('Sign-in timed out. Please try again.'), 10_000);

    async function handleSession(
      userId: string,
      email: string,
      userMetadata: Record<string, unknown>
    ) {
      if (handled) return;
      handled = true;
      clearTimeout(timeout);
      try {
        const fullName: string | null =
          (userMetadata?.full_name as string) ?? (userMetadata?.name as string) ?? null;
        const { userTypeName } = await provisionGoogleUser(userId, email, fullName);
        if (userTypeName === 'Administrator' || userTypeName === 'Super Admin') {
          router.replace('/dashboard');
        } else {
          router.replace('/report');
        }
      } catch (err) {
        console.error('Provisioning error:', err);
        setError('Failed to set up your account. Please contact support.');
      }
    }

    // The SIGNED_IN event may have already fired before this listener was registered
    // (race condition: supabase-js exchanges the PKCE code on init, before React mounts).
    // getSession() catches the already-established session in that case.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleSession(session.user.id, session.user.email!, session.user.user_metadata);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleSession(session.user.id, session.user.email!, session.user.user_metadata);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-error-500 text-sm">{error}</p>
        <a href="/report" className="text-brand-500 text-sm underline">
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
