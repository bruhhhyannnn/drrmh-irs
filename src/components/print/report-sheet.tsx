'use client';

import { figtree, FOCUS_RING, splineSansMono } from '@/components/ds';
import { cn } from '@/lib';
import { ownCampusLogo } from '@/lib/campus-logo';
import { Printer } from 'lucide-react';

// The A4 frame shared by the printed reports (the event report, the building assessment): a
// light page of sheets on screen, the print dialog's pages on paper. Chrome prints the running
// header and "Page x of y" from @page margin boxes; the on-screen preview shows them on each sheet.

/** A CSS string literal for `content:`. */
const cssString = (text: string) => JSON.stringify(text);

/**
 * The @page rules: A4, the running header from page 2, the generated line and page numbers, and
 * a light page whatever the app theme (the sheets themselves are a `data-theme="light"` subtree).
 */
export function PrintPageStyle({
  title,
  running,
  generated,
}: {
  title: string;
  running: string;
  generated: string;
}) {
  const font = figtree.style.fontFamily;
  return (
    <style>{`
      @page {
        size: A4;
        margin: 16mm 15mm 14mm;
        @top-left { content: ${cssString(title)}; font: 700 9.5pt ${font}; color: #101828; }
        @top-right { content: ${cssString(running)}; font: 500 9pt ${font}; color: #667085; }
        @bottom-left { content: ${cssString(generated)}; font: 500 9pt ${font}; color: #667085; }
        @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 600 9pt ${font}; color: #344054; }
      }
      @page :first {
        @top-left { content: none; }
        @top-right { content: none; }
      }
      /* The report is white with dark text whatever the app theme, scrollbar included. */
      html { color-scheme: light; }
      @media print {
        html, body { background: #fff !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  );
}

export function PrintShell({
  toolbar,
  children,
}: {
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      data-print-report
      data-theme="light"
      className={cn(
        figtree.variable,
        splineSansMono.variable,
        'font-landing min-h-dvh bg-gray-100 text-gray-900 antialiased print:bg-surface'
      )}
    >
      {toolbar && (
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-surface print:hidden">
          {toolbar}
        </div>
      )}
      <main className="flex flex-col items-center gap-8 px-4 py-8 print:block print:p-0">
        {children}
      </main>
    </div>
  );
}

/** The toolbar row: what goes back on the left, the print button on the right. */
export function PrintToolbar({ back, label }: { back: React.ReactNode; label: string }) {
  return (
    <div className="mx-auto flex w-full max-w-198.5 flex-wrap items-center gap-3 px-4 py-3">
      {back}
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => window.print()}
        className={cn(
          'bg-brand-solid flex h-10 items-center gap-2 rounded-full px-4.5 text-[14px] font-bold text-white hover:brightness-92',
          FOCUS_RING
        )}
      >
        <Printer size={16} aria-hidden />
        {label}
      </button>
    </div>
  );
}

/** One A4 page on screen; in print, its content flows and the next sheet starts a new page. */
export function Sheet({
  title,
  running,
  generated,
  first,
  last,
  children,
}: {
  title: string;
  running: string;
  generated: string;
  first?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        'flex min-h-280.75 w-full max-w-198.5 flex-col gap-5.5 bg-surface px-14 pt-12 pb-8 shadow-[0_1px_3px_rgba(0,0,0,.08),0_12px_32px_rgba(0,0,0,.08)]',
        'print:min-h-0 print:max-w-none print:gap-5 print:p-0 print:shadow-none',
        !last && 'print:break-after-page'
      )}
    >
      {!first && (
        <div className="flex items-center justify-between gap-4 border-b border-gray-300 pb-3 print:hidden">
          <span className="text-[14px] font-bold">{title}</span>
          <span className="text-[13px] font-medium text-gray-500">{running}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-5.5 print:gap-5">{children}</div>
      <div className="mt-auto flex items-center justify-between gap-4 border-t border-gray-300 pt-3 text-[13px] font-medium text-gray-500 print:hidden">
        <span>{generated}</span>
      </div>
    </article>
  );
}

export function Letterhead({ campus }: { campus: string }) {
  const logo = ownCampusLogo(campus) ?? '/up-logo.png';
  return (
    <div className="flex items-center gap-4.5 border-b-[3px] border-brand-500 pb-5">
      <img src={logo} alt={`${campus} logo`} className="size-17 shrink-0 object-contain" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-bold tracking-[.08em] text-brand-500 uppercase">
          {campus.replace(/^UP\s+/i, 'University of the Philippines ')}
        </span>
        <span className="text-[19px] leading-tight font-extrabold">
          Disaster Risk Reduction &amp; Management in Health Program
        </span>
        <span className="text-[14px] text-gray-600">Incident Reporting System</span>
      </div>
      <img src="/irs-logo.png" alt="IRS logo" className="size-12 shrink-0 object-contain" />
    </div>
  );
}

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-gray-900 pb-2 break-after-avoid">
        <h2 className="text-[19px] leading-[1.3] font-extrabold">{title}</h2>
        {note && <span className="text-[13px] font-medium text-gray-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}
