'use client';

import { getUserByAuthId } from '@/actions/users';
import { supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { useEffect, useRef } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setSession, setUserProfile, setLoading } = useAuthStore();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
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
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    if (lastUserIdRef.current === userId) return;
    lastUserIdRef.current = userId;

    setLoading(true);
    setUserProfile(null);
    try {
      const user = await getUserByAuthId(userId);
      setUserProfile(user ?? null);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }

  return <>{children}</>;
}
