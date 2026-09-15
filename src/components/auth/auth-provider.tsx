'use client';

import { getUserByAuthId } from '@/actions/users';
import { supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { useEffect, useRef } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setSession, setUserProfile, setLoading, setProfileError } = useAuthStore();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        lastUserIdRef.current = null;
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
        lastUserIdRef.current = null;
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
      lastUserIdRef.current = userId;
      setProfileError(null);
      setLoading(false);
      return;
    }

    lastUserIdRef.current = userId;
    setLoading(true);
    setProfileError(null);

    try {
      const user = await getUserByAuthId(userId);
      if (!user) {
        setUserProfile(null);
        setProfileError('Your user account could not be found. Please contact an administrator.');
      } else {
        setUserProfile(user);
        setProfileError(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setUserProfile(null);
      setProfileError(
        err instanceof Error ? err.message : 'An error occurred while loading your profile.'
      );
    } finally {
      setLoading(false);
    }
  }

  return <>{children}</>;
}
