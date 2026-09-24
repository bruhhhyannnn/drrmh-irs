'use client';

import type { MatatagDashboardRecord } from '@/actions/matatag';
import { useMatatagDashboard } from '@/components/hooks/use-matatag';
import { ArrowLeft, BarChart3, Building2, ClipboardList, Filter, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

type SourceFilter = 'ALL' | 'GENERAL' | 'SPECIFIC';

function average(values: (number | null | undefined)[]) {
  const usable = values.filter((value): value is number => value !== null && value !== undefined);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function labelFor(index: number) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function scoreLabel(score: number | null) {
  return score === null ? '—' : `${score.toFixed(2)}%`;
}

function scoreClass(score: number | null) {
  if (score === null) return 'text-gray-400 dark:text-gray-500';
  if (score < 50) return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200';
  if (score >= 80) return 'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-200';
  return 'text-gray-900 dark:text-white';
}

function sourceName(record: MatatagDashboardRecord) {
  return record.formId ? `Specific · ${record.formTitle}` : 'General MATATAG form';
}

function buildingKey(record: MatatagDashboardRecord) {
  return `${record.formId ?? 'general'}:${record.campus.id}:${record.building.trim().toLocaleLowerCase()}`;
}

export default function MatatagDashboardPage() {
  const dashboard = useMatatagDashboard();
  const searchParams = useSearchParams();
  const [source, setSource] = useState<SourceFilter>(
    searchParams.get('source') === 'general' ? 'GENERAL' : 'ALL'
  );
  const [phase, setPhase] = useState<'ALL' | 'PRE' | 'POST'>('ALL');
  const [formId, setFormId] = useState('ALL');
  const [campusId, setCampusId] = useState('ALL');

  const records = dashboard.data?.records ?? [];
  const forms = useMemo(
    () =>
      Array.from(
        new Map(
          records
            .filter((record) => record.formId)
            .map((record) => [record.formId, { id: record.formId!, title: record.formTitle }])
        ).values()
      ).sort((a, b) => a.title.localeCompare(b.title)),
    [records]
  );
  const campuses = useMemo(
    () =>
      Array.from(new Map(records.map((record) => [record.campus.id, record.campus])).values()).sort(
        (a, b) => a.name.localeCompare(b.name)
      ),
    [records]
  );
  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (source === 'ALL' || (source === 'GENERAL' ? !record.formId : !!record.formId)) &&
          (phase === 'ALL' || record.phase === phase) &&
          (source === 'GENERAL' || formId === 'ALL' || record.formId === formId) &&
          (campusId === 'ALL' || record.campus.id === campusId)
      ),
    [campusId, formId, phase, records, source]
  );
  const completed = useMemo(
    () => filtered.filter((record) => record.status === 'COMPLETED'),
    [filtered]
  );
  const buildings = useMemo(
    () =>
      Array.from(
        new Map(
          completed.map((record) => [
            buildingKey(record),
            {
              key: buildingKey(record),
              name: record.building,
              campus: record.campus.name,
              source: sourceName(record),
            },
          ])
        ).values()
      ).map((building, index) => ({ ...building, label: labelFor(index) })),
    [completed]
  );
  const sections = useMemo(() => {
    const seen = new Map<string, string>();
    for (const record of completed) {
      for (const section of record.sections) seen.set(section.id, section.title);
    }
    return Array.from(seen, ([id, title]) => ({ id, title }));
  }, [completed]);
  const sectionMetrics = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          score: average(
            completed.map((record) => record.sections.find((item) => item.id === section.id)?.score)
          ),
        }))
        .filter((section) => section.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [completed, sections]
  );
  const overallAverage = average(completed.map((record) => record.overallScore));
  const completionRate = filtered.length ? (completed.length / filtered.length) * 100 : 0;
  const generalCount = filtered.filter((record) => !record.formId).length;
  const specificCount = filtered.length - generalCount;

  if (dashboard.isPending) {
    return (
      <p className="p-8" role="status">
        Loading MATATAG dashboard…
      </p>
    );
  }
  if (dashboard.error) {
    return (
      <p className="p-8 text-red-700" role="alert">
        {dashboard.error.message}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-950 dark:bg-gray-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/matatag"
              className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-700 dark:text-gray-300 dark:hover:text-brand-300"
            >
              <ArrowLeft size={17} aria-hidden="true" /> MATATAG form
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-800 text-white shadow-sm">
                <BarChart3 size={24} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
                  MATATAG insights
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">Assessment dashboard</h1>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Compare general MATATAG responses with restricted campus assessments. Building labels
              are anonymized in the score matrix and mapped in the legend below.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm shadow-sm dark:border-brand-900/60 dark:bg-gray-900">
            <ShieldCheck
              size={18}
              className="text-brand-700 dark:text-brand-300"
              aria-hidden="true"
            />
            <span>Access follows your MATATAG permissions.</span>
          </div>
        </header>

        <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-4">
          <div className="flex items-center gap-2 text-sm font-semibold md:col-span-4">
            <Filter size={17} aria-hidden="true" /> Filters
          </div>
          <label className="space-y-2 text-sm">
            <span>Response source</span>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-950"
              value={source}
              onChange={(event) => setSource(event.target.value as SourceFilter)}
            >
              <option value="ALL">General + specific</option>
              <option value="GENERAL">General form only</option>
              <option value="SPECIFIC">Specific forms only</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>Assessment phase</span>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-950"
              value={phase}
              onChange={(event) => setPhase(event.target.value as 'ALL' | 'PRE' | 'POST')}
            >
              <option value="ALL">Pre + post</option>
              <option value="PRE">Pre-assessment</option>
              <option value="POST">Post-assessment</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>Specific form</span>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
              value={formId}
              disabled={source === 'GENERAL'}
              onChange={(event) => setFormId(event.target.value)}
            >
              <option value="ALL">All specific forms</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>Campus</span>
            <select
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-950"
              value={campusId}
              onChange={(event) => setCampusId(event.target.value)}
            >
              <option value="ALL">All accessible campuses</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Metric
            label="Total responses"
            value={filtered.length.toLocaleString()}
            detail={`${generalCount} general · ${specificCount} specific`}
          />
          <Metric
            label="Completed"
            value={completed.length.toLocaleString()}
            detail={`${completionRate.toFixed(0)}% completion rate`}
          />
          <Metric
            label="Overall average"
            value={scoreLabel(overallAverage)}
            detail="Completed assessments"
          />
          <Metric
            label="Buildings assessed"
            value={buildings.length.toLocaleString()}
            detail="Distinct building names"
          />
          <Metric
            label="Sections measured"
            value={sectionMetrics.length.toLocaleString()}
            detail="With available scores"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
                  Score matrix
                </p>
                <h2 className="mt-1 text-xl font-semibold">Assessed areas by building</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Averages completed responses for each building and section.
                </p>
              </div>
              <Building2 size={22} className="text-gray-400" aria-hidden="true" />
            </div>
            {buildings.length ? (
              <>
                <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <caption className="sr-only">
                      MATATAG assessed area scores by anonymized building label
                    </caption>
                    <thead className="bg-gray-50 dark:bg-gray-950/60">
                      <tr>
                        <th className="border-b border-gray-200 px-3 py-3 font-semibold dark:border-gray-800">
                          Assessed area
                        </th>
                        {buildings.map((building) => (
                          <th
                            key={building.name}
                            className="border-b border-gray-200 px-3 py-3 text-center font-semibold dark:border-gray-800"
                          >
                            {building.label}
                          </th>
                        ))}
                        <th className="border-b border-gray-200 px-3 py-3 text-center font-semibold dark:border-gray-800">
                          Total average
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((section, index) => {
                        const scores = buildings.map((building) =>
                          average(
                            completed
                              .filter((record) => buildingKey(record) === building.key)
                              .map(
                                (record) =>
                                  record.sections.find((item) => item.id === section.id)?.score
                              )
                          )
                        );
                        return (
                          <tr key={section.id}>
                            <th className="border-b border-gray-100 px-3 py-3 font-medium dark:border-gray-800">
                              {index + 1}. {section.title}
                            </th>
                            {scores.map((score, scoreIndex) => (
                              <td
                                key={`${section.id}-${buildings[scoreIndex].name}`}
                                className={`border-b border-gray-100 px-3 py-3 text-center font-medium dark:border-gray-800 ${scoreClass(score)}`}
                              >
                                {scoreLabel(score)}
                              </td>
                            ))}
                            <td
                              className={`border-b border-gray-100 px-3 py-3 text-center font-semibold dark:border-gray-800 ${scoreClass(average(scores))}`}
                            >
                              {scoreLabel(average(scores))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Building legend">
                  {buildings.map((building) => (
                    <span
                      key={building.key}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                    >
                      <strong>{building.label}</strong> = {building.name}{' '}
                      <span className="text-gray-500">
                        ({building.campus} · {building.source})
                      </span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState text="Completed responses are needed to build the score matrix." />
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
              Performance
            </p>
            <h2 className="mt-1 text-xl font-semibold">Strongest and weakest areas</h2>
            <div className="mt-5 space-y-4">
              {sectionMetrics.slice(0, 5).map((section) => (
                <PerformanceBar key={section.id} title={section.title} score={section.score} />
              ))}
              {!sectionMetrics.length && <EmptyState text="No scored sections yet." />}
            </div>
            {sectionMetrics.length > 5 && (
              <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Needs attention
                </p>
                {sectionMetrics
                  .slice(-3)
                  .reverse()
                  .map((section) => (
                    <PerformanceBar key={section.id} title={section.title} score={section.score} />
                  ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
                Response register
              </p>
              <h2 className="mt-1 text-xl font-semibold">Detailed responses</h2>
            </div>
            <Link
              href="/matatag/assessments"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium hover:border-brand-400 dark:border-gray-700"
            >
              <ClipboardList size={16} aria-hidden="true" /> Open records
            </Link>
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950/60">
                <tr>
                  <th className="px-3 py-3">Building</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Campus</th>
                  <th className="px-3 py-3">Phase</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-3 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((record) => (
                  <tr key={record.id} className="border-t border-gray-100 dark:border-gray-800">
                    <th className="px-3 py-3 font-medium">{record.building}</th>
                    <td className="px-3 py-3">{sourceName(record)}</td>
                    <td className="px-3 py-3">{record.campus.name}</td>
                    <td className="px-3 py-3">{record.phase === 'POST' ? 'Post' : 'Pre'}</td>
                    <td className={`px-3 py-3 font-semibold ${scoreClass(record.overallScore)}`}>
                      {scoreLabel(record.overallScore)}
                    </td>
                    <td className="px-3 py-3">
                      {record.status === 'COMPLETED' ? 'Submitted' : 'Draft'}
                    </td>
                    <td className="px-3 py-3">{new Date(record.updatedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3">
                      <Link
                        className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                        href={
                          record.formId
                            ? `/matatag/${record.formId}?id=${record.id}`
                            : `/matatag?id=${record.id}`
                        }
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="p-6 text-sm text-gray-500">No responses match the selected filters.</p>
            )}
          </div>
          {filtered.length > 100 && (
            <p className="mt-3 text-sm text-gray-500">
              Showing the latest 100 of {filtered.length} responses.
            </p>
          )}
          {dashboard.data?.truncated && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
              This dashboard is limited to the latest 5,000 accessible records.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function PerformanceBar({ title, score }: { title: string; score: number | null }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate">{title}</span>
        <strong>{scoreLabel(score)}</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full ${score !== null && score < 50 ? 'bg-red-400' : score !== null && score >= 80 ? 'bg-green-500' : 'bg-brand-600'}`}
          style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      {text}
    </div>
  );
}
