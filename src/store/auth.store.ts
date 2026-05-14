import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';

//DEV NOTE: This is needed for the userProfile type to work
type UserProfileType = Prisma.UserGetPayload<{
  include: {
    unit: { include: { cluster: true } };
    position: true;
    user_type: true;
  };
}>;

interface AuthState {
  user: User | null;
  session: Session | null;
  userProfile: UserProfileType | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setUserProfile: (profile: UserProfileType | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      userProfile: null,
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

      setLoading(loading: boolean) {
        set({ loading });
      },

      reset() {
        set({ user: null, session: null, userProfile: null, loading: false });
      },
    }),
    {
      name: 'irs-auth',
      partialize: (state) => ({ userProfile: state.userProfile }),
    }
  )
);
