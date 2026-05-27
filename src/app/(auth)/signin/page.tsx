import { AuthHeader, SignInForm } from '@/components/auth';
import { Suspense } from 'react';

export default function SignInPage() {
  return (
    <AuthHeader>
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthHeader>
  );
}
