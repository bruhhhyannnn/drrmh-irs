import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface PageBreadcrumbProps {
  pageTitle: string;
}

export function PageBreadcrumb({ pageTitle }: PageBreadcrumbProps) {
  return (
    <div className="mb-6 flex flex-col flex-wrap justify-between gap-3">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{pageTitle}</h2>
      <nav>
        <ol className="flex items-center gap-1.5">
          <li>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Home
              <ChevronRight size={14} color="#1d2939" />
            </Link>
          </li>
          <li className="text-sm text-gray-800 dark:text-white/90">{pageTitle}</li>
        </ol>
      </nav>
    </div>
  );
}
