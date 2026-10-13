import { figtree, FOCUS_RING, splineSansMono } from '@/components/ds';
import { cn } from '@/lib';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// One frame for sign-in, password reset and profile setup, so only the right-hand content
// changes between screens. Breakpoints follow the design frames: phone is the base, tablet is
// `md`, web is `lg`. The maroon photo panel looks the same in both themes.

const PHOTOS = [
  '/upm-drrmh-background-1.jpg',
  '/upm-drrmh-background-2.jpg',
  '/upm-drrmh-background-3.jpg',
  '/upm-drrmh-background-4.jpg',
];

const LOGOS = [
  { src: '/up-logo.png', alt: 'UP Manila logo' },
  { src: '/upm-drrmh-logo.png', alt: 'DRRM-H logo' },
  { src: '/irs-logo.png', alt: 'IRS logo' },
];

/**
 * Web is split: campus photos and logos on the left, the form on white. Tablet and phone stack
 * the photo as a short header. `reportLink` adds "Report an incident" — on the photo panel on
 * web and under the form below that, so it never competes with signing in.
 */
export function AuthShell({
  reportLink,
  children,
}: {
  reportLink?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        figtree.variable,
        splineSansMono.variable,
        'font-landing min-h-dvh bg-surface text-gray-900 antialiased lg:grid lg:grid-cols-[500px_minmax(0,1fr)]'
      )}
    >
      <header className="relative isolate flex min-h-35 flex-col justify-between gap-6 overflow-hidden px-4 py-5 md:min-h-45 md:px-8 md:py-7 lg:sticky lg:top-0 lg:h-dvh lg:p-10">
        <PhotoBackground />
        <div className="flex items-center gap-2.5">
          {LOGOS.map((logo) => (
            <Image
              key={logo.src}
              src={logo.src}
              alt={logo.alt}
              width={36}
              height={36}
              className="size-9 shrink-0 object-contain"
            />
          ))}
          <div className="ml-1 flex min-w-0 flex-col gap-px">
            <span className="text-[16px] leading-[1.2] font-extrabold text-white">DRRM-H IRS</span>
            <span className="text-[13px] text-[#fbd5d5]">Incident Reporting System</span>
          </div>
        </div>
        {reportLink && <ReportIncidentLink floating className="hidden lg:flex" />}
      </header>

      <main className="flex flex-col gap-7 px-4 pt-7 pb-8 md:px-8 md:pt-12 md:pb-14 lg:min-h-dvh lg:justify-center lg:px-14 lg:py-12">
        <div className="mx-auto flex w-full max-w-100 flex-col gap-5">{children}</div>
        {reportLink && (
          <div className="mx-auto w-full max-w-100 lg:hidden">
            <ReportIncidentLink />
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * The four campus photos cross-fading under a maroon wash. Reuses the landing hero's
 * `hero-fade` keyframes; with reduced motion only the first photo shows.
 */
function PhotoBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-1 overflow-hidden bg-[#4d0e0e]"
    >
      {PHOTOS.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="(min-width: 1024px) 500px, 100vw"
          preload={i === 0}
          className={cn(
            'animate-hero-fade object-cover opacity-0 motion-reduce:animate-none',
            i === 0 && 'motion-reduce:opacity-100'
          )}
          style={{ animationDelay: `${i * 4 - 1}s` }}
        />
      ))}
      <div className="absolute inset-0 bg-[rgba(77,14,14,.78)]" />
    </div>
  );
}

function ReportIncidentLink({ floating, className }: { floating?: boolean; className?: string }) {
  return (
    <Link
      href="/bystander-report"
      className={cn(
        'group flex items-center gap-3.5 rounded-2xl bg-surface px-4 py-3.5 transition-colors',
        floating
          ? 'shadow-[0_18px_40px_rgba(16,24,40,.22)]'
          : 'border-[1.5px] border-gray-200 hover:border-gray-300',
        FOCUS_RING,
        className
      )}
    >
      <span className="bg-brand-25 text-brand-500 grid size-11 shrink-0 place-items-center rounded-[14px]">
        <AlertTriangle size={20} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold text-gray-900">Report an incident</span>
        <span className="text-[13px] text-gray-500">Anonymous, no account needed</span>
      </span>
      <ArrowRight
        size={18}
        aria-hidden
        className="text-brand-500 shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
