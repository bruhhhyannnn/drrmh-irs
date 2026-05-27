'use client';

import { supabase } from '@/lib';
import { useAuthStore } from '@/store';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export function SignOutButton() {
  const router = useRouter();
  const reset = useAuthStore((s) => s.reset);

  const handleSignOut = async () => {
    const toastId = toast.loading('Logging out...');
    await supabase.auth.signOut();
    reset();
    toast.success('Logged out successfully', { id: toastId });
    router.push('/signin');
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
    >
      <LogOut size={18} />
      Sign out
    </button>
  );
}
