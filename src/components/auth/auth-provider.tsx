'use client';

import { getUserByAuthId } from '@/actions/users';
import { supabase } from '@/lib';
import { withTimeout } from '@/lib/offline-cache';
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

    // If cached profile belongs to this exact user, reuse it and skip the fetch
    if (userProfile && userProfile.auth_id === userId) {
      fetchingForRef.current = null;
      setProfileError(null);
      setLoading(false);
      return;
    }

    if (fetchingForRef.current === userId) return;
    fetchingForRef.current = userId;
    setLoading(true);
    setProfileError(null);

    try {
      const user = await withTimeout(getUserByAuthId(userId), PROFILE_TIMEOUT_MS);
      if (fetchingForRef.current !== userId) return;
      if (!user) {
        setUserProfile(null);
        setProfileError('Your user account could not be found. Please contact an administrator.');
      } else {
        setUserProfile(user);
        setProfileError(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      if (fetchingForRef.current !== userId) return;
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
