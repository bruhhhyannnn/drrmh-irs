import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { REPORT_TYPES } from '@/types/constants';

export default function ReportSelectPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* Back */}
        <Link
          href="/signin"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ArrowLeft size={15} />
          Back to sign in
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            What are you reporting?
          </h1>
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
            No account needed — your identity will not be stored.
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-3">
          {REPORT_TYPES.map((item) => (
            <Link
              key={item.id}
              href={{ pathname: '/report-submit', query: { type: item.id, title: item.title } }}
              className="group hover:border-opacity-60 flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 transition-all duration-200 hover:shadow-sm dark:border-white/10 dark:bg-white/5"
              style={{
                ['--accent' as string]: item.accentColor,
              }}
            >
              {/* Icon */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: item.dimColor }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.accentColor }}
                />
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p
                  className="mb-0.5 text-xs font-semibold tracking-widest uppercase"
                  style={{ color: item.accentColor }}
                >
                  {item.subtitle}
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">{item.title}</p>
                <p className="mt-0.5 truncate text-sm text-gray-400 dark:text-gray-500">
                  {item.description}
                </p>
              </div>

              {/* Arrow */}
              <ArrowRight
                size={16}
                className="shrink-0 text-gray-300 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-gray-600"
                style={{ color: undefined }}
              />
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
          For life-threatening emergencies, call{' '}
          <span className="font-semibold text-red-500">911</span> immediately.
        </p>
      </div>
    </div>
  );
}
