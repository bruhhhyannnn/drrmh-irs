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

    // Who signed in is read on the server from the session's access token (#100); the browser
    // sends nothing else about the user.
    async function handleSession(accessToken: string) {
      if (handled || timedOut) return;
      handled = true;
      try {
        const result = await provisionGoogleUser(accessToken);
        if (timedOut) return;
        clearTimeout(timeout);
        if (result.ok) {
          router.replace(homePathFor(result.userTypeName));
          return;
        }
        await supabase.auth.signOut();
        const error = result.reason === 'signed_out' ? 'timeout' : result.reason;
        router.replace(`/signin?error=${error}`);
      } catch (err) {
        if (timedOut) return;
        clearTimeout(timeout);
        console.error('Provisioning error:', err);
        await supabase.auth.signOut();
        router.replace('/signin?error=setup');
      }
    }

    // The SIGNED_IN event may have already fired before this listener was registered
    // (race condition: supabase-js exchanges the PKCE code on init, before React mounts).
    // getSession() catches the already-established session in that case.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) handleSession(session.access_token);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.access_token) handleSession(session.access_token);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  return <Loader fullScreen label="Signing you in…" />;
}
