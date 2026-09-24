'use client';

import { useMatatagRecords } from '@/components/hooks/use-matatag';
import { ArrowLeft, ArrowRight, ClipboardList, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function MatatagRecordsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const records = useMatatagRecords(page, query);
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-8 text-gray-900 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/matatag"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"
        >
          <ArrowLeft size={17} aria-hidden="true" /> New assessment
        </Link>
        <h1 className="text-2xl font-semibold">Shared MATATAG records</h1>
      </div>
      <form
        className="flex items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <label className="min-w-0 flex-1 text-sm">
          Search building or evaluator
          <input
            className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 dark:border-gray-700"
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          type="submit"
        >
          <Search size={17} aria-hidden="true" /> Search
        </button>
      </form>
      {records.isPending ? (
        <p role="status">Loading records…</p>
      ) : records.error ? (
        <p role="alert">{records.error.message}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
                  <th className="px-4 py-3">Building</th>
                  <th className="px-4 py-3">Campus</th>
                  <th className="px-4 py-3">Phase</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {records.data.records.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-4">{record.building}</th>
                    <td className="px-4 py-4">{record.campus.name}</td>
                    <td className="px-4 py-4">{record.phase === 'POST' ? 'Post' : 'Pre'}</td>
                    <td className="px-4 py-4">
                      {record.status === 'COMPLETED' ? 'Submitted' : 'Draft'}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        className="inline-flex min-h-11 items-center gap-2 font-medium text-brand-600"
                        href={
                          record.form_id
                            ? `/matatag/${record.form_id}?id=${record.id}`
                            : `/matatag?id=${record.id}`
                        }
                      >
                        <ClipboardList size={16} aria-hidden="true" /> Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!records.data.records.length && <p className="p-6 text-sm">No saved records yet.</p>}
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              className="min-h-11 rounded-lg border px-4"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.max(1, Math.ceil(records.data.total / 20))}
            </span>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4"
              disabled={page * 20 >= records.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </main>
  );
}
