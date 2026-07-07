'use client';

import { PageBreadcrumb } from '@/components/common';
import { Input } from '@/components/ui';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

const PER_PAGE = 10;

const actionColor = {
  create: 'success',
  update: 'warning',
  delete: 'error',
} as const;

export default function ActivityLogsPage() {
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounceQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Activity Logs" />

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            size={16}
            className="absolute top-1/2 z-1 left-3 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
          <Input
            placeholder="Search logs..."
            className="pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
