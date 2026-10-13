'use client';

import { ProtectedRoute } from '@/components/auth';

/**
 * Placeholder pages for the four DRRM pillars, opened in a new tab from the admin sidebar. They
 * stand in for the separate pillar apps: signed-in admins only, no IRS shell.
 */
export default function PillarsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
