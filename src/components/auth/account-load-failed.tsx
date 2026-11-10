'use client';

import { useAuthStore } from '@/store';
import { Button } from '../ui/button';
import { useSignOut } from './use-sign-out';

/** Shown instead of a page when the signed-in user's profile could not be loaded. */
export function AccountLoadFailed() {
  const profileError = useAuthStore((s) => s.profileError);
  const { signOut, signingOut } = useSignOut();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-surface p-6 text-center shadow-xs">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Account Loading Failed</h2>
        <p className="mb-6 text-sm text-gray-600">{profileError}</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button variant="danger" size="sm" disabled={signingOut} onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
