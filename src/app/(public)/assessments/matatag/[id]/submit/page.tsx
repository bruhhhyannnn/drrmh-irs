'use client';

import { MatatagForm } from '@/components/matatag/matatag-form';
import { useAuthStore } from '@/store';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SubmitCampusAssessmentPage() {
  const { user, loading, userProfile } = useAuthStore();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    if (!loading && !user)
      router.replace(`/signin?from=${encodeURIComponent(window.location.pathname)}`);
  }, [loading, user, router]);
  if (loading || !user)
    return (
      <p className="p-8" role="status">
        Checking your account…
      </p>
    );
  if (!userProfile)
    return (
      <p className="p-8" role="status">
        Loading your account…
      </p>
    );
  if (!['ERT Member', 'Administrator', 'Super Admin'].includes(userProfile.user_type.name))
    return (
      <p className="p-8" role="alert">
        Your account cannot submit MATATAG responses.
      </p>
    );
  return <MatatagForm suppliedFormId={id} />;
}
