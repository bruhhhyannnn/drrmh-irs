'use client';

import { getUserByAuthId } from '@/actions/users';
import { supabase } from '@/lib';
import { syncSupabaseAuthCookie } from '@/lib/auth-cookie';
import { useAuthStore } from '@/store';
import { useEffect, useRef } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setSession, setUserProfile, setLoading } = useAuthStore();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSupabaseAuthCookie(session);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') return;

      syncSupabaseAuthCookie(session);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        lastUserIdRef.current = null;
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { userProfile } = useAuthStore.getState();
    if (userProfile?.auth_id === userId && lastUserIdRef.current === userId) {
      setLoading(false);
      return;
    }

    lastUserIdRef.current = userId;
    setLoading(true);
    setUserProfile(null);
    try {
      const user = await getUserByAuthId(userId);
      setUserProfile(user ?? null);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  }

  return <>{children}</>;
}
