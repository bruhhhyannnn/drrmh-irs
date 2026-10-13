'use client';

import { ProfileSetupGate, ProtectedRoute } from '@/components/auth';
import { AdminShell } from './_components/shell/admin-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <ProfileSetupGate>
        <AdminShell>{children}</AdminShell>
      </ProfileSetupGate>
    </ProtectedRoute>
  );
}
