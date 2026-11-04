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
import { Loader } from '@/components/ui/loader';
import { supabase } from '@/lib';
import { homePathFor } from '@/lib/access';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Failures go back to sign-in, which shows them as a banner over the same Google button.
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let handled = false;
    let timedOut = false;
    // Covers provisioning too. Past this, a session that did land is picked up by /signin.
    const timeout = setTimeout(() => {
      timedOut = true;
      router.replace('/signin?error=timeout');
    }, 20_000);

    async function handleSession(
      userId: string,
      email: string,
      userMetadata: Record<string, unknown>
    ) {
      if (handled || timedOut) return;
      handled = true;
      try {
        const fullName: string | null =
          (userMetadata?.full_name as string) ?? (userMetadata?.name as string) ?? null;
        const { userTypeName } = await provisionGoogleUser(userId, email, fullName);
        if (timedOut) return;
        clearTimeout(timeout);
        router.replace(homePathFor(userTypeName));
      } catch (err) {
        if (timedOut) return;
        clearTimeout(timeout);
        if (err instanceof Error && err.message === 'DOMAIN_NOT_ALLOWED') {
          await supabase.auth.signOut();
          router.replace('/signin?error=domain');
          return;
        }
        console.error('Provisioning error:', err);
        await supabase.auth.signOut();
        router.replace('/signin?error=setup');
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

  return <Loader fullScreen label="Signing you in…" />;
}
