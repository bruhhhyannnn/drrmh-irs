'use client';

import { getMyProfile } from '@/actions/users';
import { supabase } from '@/lib';
import { ACCOUNT_INACTIVE_MESSAGE } from '@/lib/access';
import { withTimeout } from '@/lib/offline-cache';
import { getAccessToken } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import { useEffect, useRef } from 'react';

/** Server actions wait in line behind each other, so this also covers waiting for a slow one. */
const PROFILE_TIMEOUT_MS = 20_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setSession, setUserProfile, setLoading, setProfileError } = useAuthStore();
  // Who the profile is being fetched for: getSession and onAuthStateChange both report the same
  // session, and only the latest sign-in's answer may land.
  const fetchingForRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        fetchingForRef.current = null;
        setProfileError(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        fetchingForRef.current = null;
        setUserProfile(null);
        setProfileError(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { userProfile } = useAuthStore.getState();

    // A profile kept in the browser for this user shows the app at once, and is checked again in
    // the background (#104), so a role change or a turned-off account takes effect without
    // signing out. Offline, the kept profile stays.
    const kept = !!userProfile && userProfile.auth_id === userId;
    if (kept) {
      setProfileError(null);
      setLoading(false);
    }

    if (fetchingForRef.current === userId) return;
    fetchingForRef.current = userId;
    if (!kept) {
      setLoading(true);
      setProfileError(null);
    }

    try {
      // The server finds the profile from the verified token, not from an id the client sends.
      const user = await withTimeout(
        getAccessToken().then((token) => getMyProfile(token)),
        PROFILE_TIMEOUT_MS
      );
      if (user && !('turnedOff' in user) && user.auth_id !== userId) return;
      if (fetchingForRef.current !== userId) return;
      if (user && 'turnedOff' in user) {
        // Banned: the server refused the token and sent no profile, so nothing is kept.
        setUserProfile(null);
        setProfileError(ACCOUNT_INACTIVE_MESSAGE);
      } else if (!user) {
        setUserProfile(null);
        setProfileError('Your user account could not be found. Please contact an administrator.');
      } else if (user.is_active === false) {
        setUserProfile(null);
        setProfileError(ACCOUNT_INACTIVE_MESSAGE);
      } else {
        setUserProfile(user);
        setProfileError(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      if (fetchingForRef.current !== userId) return;
      // Offline or a server hiccup: a kept profile stays usable.
      if (kept) return;
      setUserProfile(null);
      // Not err.message: production hides what a server action threw (React error #441).
      setProfileError("We couldn't load your account. Check your connection and try again.");
    } finally {
      if (fetchingForRef.current === userId) {
        fetchingForRef.current = null;
        setLoading(false);
      }
    }
  }

  return <>{children}</>;
}
