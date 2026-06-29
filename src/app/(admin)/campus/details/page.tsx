'use client';

import { PageBreadcrumb } from '@/components/common';

export default function CampusDetailsPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Campus Details" />
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">This is the campus details page.</p>
      </div>
    </div>
  );
}
