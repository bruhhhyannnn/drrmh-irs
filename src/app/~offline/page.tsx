'use client';

import { WifiOff } from 'lucide-react';

// Shown by the service worker (see `fallbacks.document` in next.config.ts) when the
// user navigates to a page that isn't cached and the network request fails.
export default function OfflineFallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center dark:bg-gray-950">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-600">
        <WifiOff size={28} />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">You&apos;re offline</h1>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          This page hasn&apos;t been loaded before, so it isn&apos;t available offline. Reconnect to
          the internet and try again.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="bg-brand-500 hover:bg-brand-600 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
