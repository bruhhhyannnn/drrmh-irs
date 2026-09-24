'use client';

import { PageBreadcrumb } from '@/components/common/page-breadcrumb';
import {
  useMatatagForm,
  useMatatagRecords,
  useReopenMatatagResponse,
  useUpdateMatatagForm,
} from '@/components/hooks/use-matatag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Eye,
  FilePenLine,
  LockKeyhole,
  Search,
  UnlockKeyhole,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function CampusAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const form = useMatatagForm(id);
  const update = useUpdateMatatagForm(id);
  const [message, setMessage] = useState('');
  if (!form.data)
    return (
      <div>
        <p role={form.error ? 'alert' : 'status'}>{form.error?.message || 'Loading assessment…'}</p>
        {form.error && <Button onClick={() => form.refetch()}>Try again</Button>}
      </div>
    );
  const assessment = form.data;
  if (!assessment.canManage)
    return <p role="alert">An administrator account for this campus is required.</p>;
  return (
    <div className="space-y-5 text-gray-900 dark:text-white">
      <PageBreadcrumb pageTitle={assessment.title} />
      <Link
        href="/assessments"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-300"
      >
        <ArrowLeft size={17} aria-hidden="true" /> All assessments
      </Link>
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="border-l-4 border-brand-600 px-5 py-6 md:px-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${assessment.isOpen ? 'bg-success-50 text-success-600 dark:bg-success-500/15' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                >
                  {assessment.isOpen ? 'Open for responses' : 'Closed'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Checklist revision {assessment.template.revision}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {assessment.phase === 'POST' ? 'Post-assessment' : 'Pre-assessment'} ·{' '}
                  {assessment.accessMode === 'ASSIGNED' ? 'Assigned users only' : 'Campus users'}
                </span>
              </div>
              <h1 className="text-xl font-semibold text-gray-950 dark:text-white">
                {assessment.title}
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {assessment.campus.name}
              </p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-lg bg-[#e8f1e9] text-[#255f3c] dark:bg-[#20372a] dark:text-[#79c493]">
              <UsersRound size={23} aria-hidden="true" />
            </span>
          </div>
        </div>
        <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/assessments/matatag/${id}/edit`}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-900 dark:hover:text-brand-300"
            >
              <FilePenLine size={17} aria-hidden="true" /> Edit checklist
            </Link>
            <Button
              isLoading={update.isPending}
              variant={assessment.isOpen ? 'outline' : 'primary'}
              startIcon={
                assessment.isOpen ? (
                  <LockKeyhole size={17} aria-hidden="true" />
                ) : (
                  <UnlockKeyhole size={17} aria-hidden="true" />
                )
              }
              onClick={async () => {
                try {
                  await update.mutateAsync({
                    version: assessment.version,
                    title: assessment.title,
                    isOpen: !assessment.isOpen,
                  });
                  setMessage(
                    assessment.isOpen
                      ? 'Responses are now closed.'
                      : 'The assessment is open. Copy the link to share it with campus users.'
                  );
                } catch {
                  /* Displayed below. */
                }
              }}
            >
              {assessment.isOpen ? 'Close responses' : 'Open responses'}
            </Button>
            <Button
              variant="outline"
              disabled={!assessment.isOpen}
              startIcon={<Copy size={17} aria-hidden="true" />}
              onClick={async () => {
                const url = `${window.location.origin}/assessments/matatag/${id}/submit`;
                try {
                  await navigator.clipboard.writeText(url);
                  setMessage(
                    'Submission link copied. Only signed-in users assigned to this campus can respond.'
                  );
                } catch {
                  setMessage(`Copy this submission link: ${url}`);
                }
              }}
            >
              Copy submission link
            </Button>
            {assessment.isOpen && (
              <Link
                href={`/matatag/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
              >
                Open form <ExternalLink size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Each building can have a separate response. Submitted responses stay locked until an
            administrator reopens them.
          </p>
          {assessment.accessMode === 'ASSIGNED' && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Assigned users:{' '}
              {assessment.assignments.map((assignment) => assignment.name).join(', ')}
            </p>
          )}
        </div>
        {message && (
          <p
            role="status"
            className="m-5 rounded-lg border border-success-100 bg-success-50 p-3 text-sm text-success-600 dark:bg-success-500/10"
          >
            {message}
          </p>
        )}
        {update.error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {update.error.message}
          </p>
        )}
      </section>
      <ResponseList formId={id} />
    </div>
  );
}

function ResponseList({ formId }: { formId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const records = useMatatagRecords(page, query, formId);
  const reopen = useReopenMatatagResponse(formId);
  return (
    <section
      id="responses"
      className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-950 dark:text-white">Building responses</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Review drafts and submitted inspection results.
          </p>
        </div>
        {records.data && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {records.data.total}
          </span>
        )}
      </div>
      <form
        className="flex items-end gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-950/60"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Input
          id="response-search"
          type="search"
          label="Search by building or evaluator"
          value={search}
          maxLength={200}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline">
          <Search size={17} aria-hidden="true" /> Search
        </Button>
      </form>
      {reopen.error && <p role="alert">{reopen.error.message}</p>}
      {reopen.isSuccess && (
        <p role="status">
          Response reopened. The respondent can edit and submit it again while the assessment is
          open.
        </p>
      )}
      {records.isPending ? (
        <p role="status">Loading responses…</p>
      ) : records.error ? (
        <div role="alert">
          {records.error.message} <Button onClick={() => records.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-400">
                  {['Building', 'Respondent', 'Status', 'Last saved', 'Actions'].map((name) => (
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
                      {[record.user.first_name, record.user.last_name].filter(Boolean).join(' ') ||
                        record.user.username}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === 'COMPLETED' ? 'bg-success-50 text-success-600 dark:bg-success-500/15' : 'bg-warning-50 text-warning-600 dark:bg-warning-500/15'}`}
                      >
                        {record.status === 'COMPLETED' ? 'Submitted' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      {new Date(record.updated_at).toLocaleString('en-PH')}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          className="inline-flex min-h-11 items-center gap-2 font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
                          href={`/assessments/matatag/${formId}/responses/${record.id}`}
                        >
                          <Eye size={16} aria-hidden="true" /> View
                        </Link>
                        {record.status === 'COMPLETED' && (
                          <Button
                            variant="outline"
                            disabled={reopen.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Reopen the response for “${record.building}” so its respondent can edit it?`
                                )
                              )
                                void reopen
                                  .mutateAsync({ id: record.id, version: record.version })
                                  .catch(() => {});
                            }}
                          >
                            Reopen
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!records.data.records.length && (
            <p className="text-sm">
              {query
                ? 'No matching responses.'
                : 'No responses yet. Open the assessment and share its submission link.'}
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
  );
}
