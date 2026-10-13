'use client';

import { ProtectedRoute } from '@/components/auth';

/** Pages made to be printed (the event report): signed-in admins only, no app shell. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
