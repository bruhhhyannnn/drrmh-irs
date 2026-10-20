import { AuthShell, SignInForm } from '@/components/auth';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Sign in | DRRM-H IRS',
};

export default function SignInPage() {
  return (
    <AuthShell reportLink>
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
