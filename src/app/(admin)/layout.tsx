'use client';

import { CompleteProfileModal, ProtectedRoute } from '@/components/auth';
import { AppHeader, AppSidebar, Backdrop } from '@/components/layout';
import { useSidebarStore } from '@/store';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
        <div className={`flex-1 transition-all duration-300 ease-in-out ${marginLeft}`}>
          <AppHeader />
          <div className="mx-auto max-w-screen-2xl p-4 md:p-6">{children}</div>
        </div>
      </div>
      <CompleteProfileModal />
    </ProtectedRoute>
  );
}
