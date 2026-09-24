'use client';

import { PageBreadcrumb } from '@/components/common/page-breadcrumb';
import { useMatatagRecords } from '@/components/hooks/use-matatag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { ArrowLeft, Eye, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function GeneralMatatagResponsesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const records = useMatatagRecords(page, query, undefined, true);

  return (
    <div className="space-y-5 text-gray-900 dark:text-white">
      <PageBreadcrumb pageTitle="General MATATAG Responses" />
      <Link
        href="/assessments"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-300"
      >
        <ArrowLeft size={17} aria-hidden="true" /> Back to assessments
      </Link>
      <section
        id="responses"
        className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      >
        <div>
          <h1 className="text-xl font-semibold text-gray-950 dark:text-white">
            General MATATAG responses
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Responses submitted through the shared `/matatag` form.
          </p>
        </div>
        <form
          className="flex items-end gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-950/60"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <Input
            id="general-response-search"
            type="search"
            label="Search by building or evaluator"
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="outline">
            <Search size={17} aria-hidden="true" /> Search
          </Button>
        </form>
        {records.isPending ? (
          <p role="status">Loading responses…</p>
        ) : records.error ? (
          <p role="alert">{records.error.message}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400">
                    {[
                      'Building',
                      'Respondent',
                      'Campus',
                      'Phase',
                      'Status',
                      'Last saved',
                      'Actions',
                    ].map((name) => (
                      <th scope="col" key={name} className="px-3 py-3">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.data.records.map((record) => (
                    <tr key={record.id} className="border-b border-gray-100 dark:border-gray-800">
                      <th scope="row" className="px-3 py-4">
                        {record.building}
                      </th>
                      <td className="px-3 py-4">
                        {[record.user.first_name, record.user.last_name]
                          .filter(Boolean)
                          .join(' ') || record.user.username}
                      </td>
                      <td className="px-3 py-4">{record.campus.name}</td>
                      <td className="px-3 py-4">{record.phase === 'POST' ? 'Post' : 'Pre'}</td>
                      <td className="px-3 py-4">
                        {record.status === 'COMPLETED' ? 'Submitted' : 'Draft'}
                      </td>
                      <td className="px-3 py-4">
                        {new Date(record.updated_at).toLocaleString('en-PH')}
                      </td>
                      <td className="px-3 py-4">
                        <Link
                          className="inline-flex min-h-11 items-center gap-2 font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
                          href={`/assessments/matatag/general/responses/${record.id}`}
                        >
                          <Eye size={16} aria-hidden="true" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!records.data.records.length && (
              <p className="text-sm">
                {query ? 'No matching responses.' : 'No general responses yet.'}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {Math.max(1, Math.ceil(records.data.total / 20))}
              </span>
              <Button
                variant="outline"
                disabled={page * 20 >= records.data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
