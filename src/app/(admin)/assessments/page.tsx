'use client';

import { PageBreadcrumb } from '@/components/common/page-breadcrumb';
import {
  useCreateMatatagForm,
  useMatatagAssignableUsers,
  useMatatagCampuses,
  useMatatagForms,
} from '@/components/hooks/use-matatag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { useAuthStore } from '@/store';
import { ArrowRight, Building2, ClipboardCheck, FilePlus2, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AssessmentsPage() {
  const isSuperAdmin = useAuthStore((s) => s.userProfile?.user_type.name === 'Super Admin');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const forms = useMatatagForms(page, query);
  return (
    <div className="space-y-5 text-gray-900 dark:text-white">
      <PageBreadcrumb pageTitle="MATATAG Assessments" />
      <section className="relative overflow-hidden rounded-xl bg-brand-800 px-5 py-6 text-white shadow-theme-sm md:px-7">
        <div className="absolute inset-y-0 left-0 w-24 bg-[#255f3c] [clip-path:polygon(0_0,100%_0,55%_100%,0_100%)]" />
        <div className="relative ml-12 flex flex-wrap items-end justify-between gap-5 md:ml-16">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-100">
              <ClipboardCheck size={18} aria-hidden="true" />
              Building safety assessments
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">MATATAG workspace</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-100 md:text-base">
              {isSuperAdmin
                ? 'Create campus assessments from the approved checklist and review responses across the university.'
                : 'Manage your campus forms, share the response link, and review building assessments.'}
            </p>
          </div>
          <div className="border-l border-white/25 pl-4 text-sm text-brand-100">
            <strong className="block text-2xl text-white">17</strong>
            checklist sections
          </div>
        </div>
      </section>
      {isSuperAdmin && <CreateAssessment />}
      <form
        className="flex items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Input
          id="assessment-search"
          type="search"
          label="Search assessments"
          value={search}
          maxLength={200}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline">
          <Search size={17} aria-hidden="true" /> Search
        </Button>
      </form>
      {forms.isPending ? (
        <p role="status">Loading assessments…</p>
      ) : forms.error ? (
        <div role="alert">
          {forms.error.message} <Button onClick={() => forms.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Campus assessments</h2>
            <div className="flex items-center gap-4">
              <Link
                href="/assessments/matatag/general#responses"
                className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                General responses
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400">{forms.data.total} total</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {forms.data.forms.map((form) => (
              <article
                key={form.id}
                className="group rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-colors hover:border-brand-300 focus:outline-2 focus:outline-brand-500 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    <Building2 size={20} aria-hidden="true" />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${form.is_open ? 'bg-success-50 text-success-600 dark:bg-success-500/15' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    {form.is_open ? 'Open' : 'Closed'}
                  </span>
                </div>
                <h3 className="mt-4 break-words font-semibold text-gray-950 dark:text-white">
                  <Link href={`/assessments/matatag/${form.id}`} className="hover:underline">
                    {form.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{form.campus.name}</p>
                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm dark:border-gray-800">
                  <span>{form._count.responses} responses</span>
                  <span className="flex items-center gap-3">
                    <Link
                      href={`/assessments/matatag/${form.id}#responses`}
                      className="font-medium text-brand-600 hover:underline dark:text-brand-300"
                    >
                      View responses
                    </Link>
                    <Link
                      href={`/assessments/matatag/${form.id}`}
                      className="flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-300"
                    >
                      Manage <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </span>
                </div>
              </article>
            ))}
          </div>
          {!forms.data.forms.length && (
            <p className="rounded-xl border border-gray-200 p-6 dark:border-gray-700">
              {query
                ? 'No matching assessments.'
                : isSuperAdmin
                  ? 'Create the first campus assessment above.'
                  : 'No assessments have been assigned to your campus yet.'}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {Math.max(1, Math.ceil(forms.data.total / 20))}
            </span>
            <Button
              variant="outline"
              disabled={page * 20 >= forms.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateAssessment() {
  const campuses = useMatatagCampuses();
  const create = useCreateMatatagForm();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [campusId, setCampusId] = useState('');
  const [phase, setPhase] = useState<'PRE' | 'POST'>('PRE');
  const [accessMode, setAccessMode] = useState<'CAMPUS' | 'ASSIGNED'>('CAMPUS');
  const [userIds, setUserIds] = useState<string[]>([]);
  const users = useMatatagAssignableUsers(campusId);
  return (
    <form
      className="space-y-5 rounded-xl border border-brand-100 bg-brand-25 p-5 shadow-theme-xs dark:border-brand-900/60 dark:bg-brand-950/30"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const form = await create.mutateAsync({ title, campusId, phase, accessMode, userIds });
          router.push(`/assessments/matatag/${form.id}/edit`);
        } catch {
          /* Mutation error is displayed below. */
        }
      }}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
          <FilePlus2 size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold">Create a campus assessment</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Start from the current approved MATATAG checklist.
          </p>
        </div>
      </div>
      <fieldset disabled={create.isPending} className="grid min-w-0 items-end gap-4 md:grid-cols-4">
        <Input
          id="assessment-title"
          label="Assessment title"
          value={title}
          required
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Building safety review — September 2026"
        />
        <label htmlFor="assessment-campus" className="space-y-2 text-sm">
          <span>Assigned campus</span>
          <select
            id="assessment-campus"
            required
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">{campuses.isPending ? 'Loading campuses…' : 'Select a campus'}</option>
            {campuses.data?.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="assessment-phase" className="space-y-2 text-sm">
          <span>Assessment phase</span>
          <select
            id="assessment-phase"
            value={phase}
            onChange={(event) => setPhase(event.target.value as 'PRE' | 'POST')}
            className="h-11 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="PRE">Pre-assessment</option>
            <option value="POST">Post-assessment</option>
          </select>
        </label>
        <label htmlFor="assessment-access" className="space-y-2 text-sm">
          <span>Who can answer?</span>
          <select
            id="assessment-access"
            value={accessMode}
            onChange={(event) => {
              const next = event.target.value as 'CAMPUS' | 'ASSIGNED';
              setAccessMode(next);
              if (next === 'CAMPUS') setUserIds([]);
            }}
            className="h-11 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="CAMPUS">Any user assigned to the campus</option>
            <option value="ASSIGNED">Selected users only</option>
          </select>
        </label>
        <Button
          type="submit"
          isLoading={create.isPending}
          loadingText="Creating…"
          disabled={!title.trim() || !campusId || (accessMode === 'ASSIGNED' && !userIds.length)}
        >
          Create from default template
        </Button>
      </fieldset>
      {accessMode === 'ASSIGNED' && (
        <fieldset className="space-y-2 rounded-lg border border-brand-100 p-4 dark:border-brand-900/60">
          <legend className="px-1 text-sm font-medium">Assigned users</legend>
          {users.isPending ? (
            <p className="text-sm">Loading campus users…</p>
          ) : users.error ? (
            <p role="alert" className="text-sm text-red-700">
              {users.error.message}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {users.data?.map((candidate) => (
                <label key={candidate.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={userIds.includes(candidate.id)}
                    onChange={(event) =>
                      setUserIds((current) =>
                        event.target.checked
                          ? [...current, candidate.id]
                          : current.filter((id) => id !== candidate.id)
                      )
                    }
                  />
                  {[candidate.first_name, candidate.last_name].filter(Boolean).join(' ') ||
                    candidate.username}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <p className="border-t border-brand-100 pt-4 text-sm text-gray-600 dark:border-brand-900/50 dark:text-gray-300">
        The campus administrator can customize this copy and open it for{' '}
        {accessMode === 'ASSIGNED' ? 'the selected users' : 'campus users'}. Its campus cannot be
        changed.
      </p>
      {(campuses.error || create.error) && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {campuses.error?.message || create.error?.message}
        </p>
      )}
    </form>
  );
}
