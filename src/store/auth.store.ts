import { Prisma } from '@prisma/client';
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

//DEV NOTE: This is needed for the userProfile type to work
type UserProfileType = Prisma.UserGetPayload<{
  include: {
    cluster: true;
    unit: { include: { cluster: true } };
    position: true;
    user_type: true;
    campus: true;
  };
}>;

interface AuthState {
  user: User | null;
  session: Session | null;
  userProfile: UserProfileType | null;
  profileError: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setUserProfile: (profile: UserProfileType | null) => void;
  setProfileError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      userProfile: null,
      profileError: null,
      loading: true,

      setUser(user: User | null) {
        set({ user });
      },

      setSession(session: Session | null) {
        set({ session });
      },

      setUserProfile(userProfile: UserProfileType | null) {
        set({ userProfile });
      },

      setProfileError(profileError: string | null) {
        set({ profileError });
      },

      setLoading(loading: boolean) {
        set({ loading });
      },

      reset() {
        set({ user: null, session: null, userProfile: null, profileError: null, loading: false });
      },
    }),
    {
      name: 'irs-auth',
      partialize: (state) => ({ userProfile: state.userProfile }),
    }
  )
);
