'use client';

import { AuthProvider } from '@/components/auth';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { OfflineQueueProvider } from '@/components/pwa/offline-queue-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const mount = async () => {
      if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length) {
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if ('caches' in window) {
            await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
          }
          window.location.reload();
          return;
        }
      }
      setMounted(true);
    };
    void mount().catch(() => setMounted(true));
  }, []);

  if (!mounted) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
          <InstallPrompt />
          <OfflineQueueProvider />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
