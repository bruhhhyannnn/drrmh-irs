'use client';

import { supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

/** Signs out of Supabase, clears the profile and goes to the sign-in page. */
export function useSignOut() {
  const router = useRouter();
  const reset = useAuthStore((s) => s.reset);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    const toastId = toast.loading('Signing out…');
    await supabase.auth.signOut();
    reset();
    toast.success('Signed out', { id: toastId });
    router.replace('/signin');
  };

  return { signOut, signingOut };
}
