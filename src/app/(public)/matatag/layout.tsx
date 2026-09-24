'use client';

import { ProtectedRoute } from '@/components/auth';
import { AppHeader, AppSidebar, Backdrop } from '@/components/layout';
import styles from '@/components/matatag/matatag.module.css';
import { useAuthStore, useSidebarStore } from '@/store';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export default function MatatagLayout({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const destination = `${pathname}${window.location.search}`;
      router.replace(`/signin?from=${encodeURIComponent(destination)}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className={styles.loading} role="status">
        {loading ? 'Checking your account…' : 'Redirecting to sign in…'}
      </div>
    );
  }

  if (pathname === '/matatag/dashboard' || pathname === '/matatag/assessments') {
    return <DashboardShell>{children}</DashboardShell>;
  }

  return <div key={user.id}>{children}</div>;
}

function DashboardShell({ children }: { children: ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebarStore();
  const marginLeft = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
      ? 'lg:ml-[290px]'
      : 'lg:ml-[80px]';

  return (
    <ProtectedRoute>
      <div className="min-h-screen xl:flex">
        <AppSidebar />
        <Backdrop />
        <div className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${marginLeft}`}>
          <AppHeader />
          <div className="mx-auto max-w-screen-2xl p-4 md:p-6">{children}</div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
