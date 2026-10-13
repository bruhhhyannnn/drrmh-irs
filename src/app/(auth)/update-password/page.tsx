import { AuthShell, UpdatePasswordForm } from '@/components/auth';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Update password | DRRM-H IRS',
};

export default function UpdatePasswordPage() {
  return (
    <AuthShell>
      <UpdatePasswordForm />
    </AuthShell>
  );
}
