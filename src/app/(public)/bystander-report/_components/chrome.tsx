import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { Phone } from 'lucide-react';
import Image from 'next/image';
import { forwardRef } from 'react';

// Page frame shared by the form and the result screens. Breakpoints follow the design frames:
// phone is the base, tablet is `md`, web is `lg`.

const LOGOS = [
  { src: '/up-logo.png', alt: 'UP Manila logo' },
  { src: '/upm-drrmh-logo.png', alt: 'DRRM-H logo' },
  { src: '/irs-logo.png', alt: 'IRS logo' },
];

/** Logos and name on the left, Call 911 always visible on the right. */
export function TopBar() {
  return (
    <header className="flex h-16 items-center gap-2.5 border-b border-line bg-surface px-4 md:h-18 md:px-8 lg:px-10">
      {LOGOS.map((logo, i) => (
        <Image
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          width={32}
          height={32}
          // The two partner logos give way first on the narrowest phones.
          className={cn(
            'size-6.5 shrink-0 object-contain md:size-8',
            i < 2 && 'max-[359px]:hidden'
          )}
        />
      ))}
      <div className="ml-0.5 flex min-w-0 flex-col gap-px">
        <span className="text-[17px] leading-[1.2] font-extrabold whitespace-nowrap">
          DRRM-H · IRS
        </span>
        <span className="hidden text-[13px] text-gray-500 md:block">Incident Reporting System</span>
      </div>
      <div className="flex-1" />
      <span className="hidden text-[16px] font-medium text-gray-600 md:inline">
        Life-threatening?
      </span>
      <a
        href="tel:911"
        className={cn(
          'border-brand-500 text-brand-500 hover:bg-brand-25 flex h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[16px] font-bold whitespace-nowrap transition-colors',
          FOCUS_RING
        )}
      >
        <Phone size={16} aria-hidden />
        Call 911
      </a>
    </header>
  );
}

/** Campus photo under a maroon wash. The form card and result card overlap its bottom edge. */
export function HeroBand({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('relative isolate overflow-hidden text-center', className)}>
      <Image
        src="/upm-drrmh-background-1.jpg"
        alt=""
        fill
        sizes="100vw"
        preload
        className="-z-2 object-cover"
      />
      <div aria-hidden className="absolute inset-0 -z-1 bg-[rgba(77,14,14,.78)]" />
      {children}
    </div>
  );
}

/** White card centred in the page gutter (16 / 32 / 40px). */
export const PageCard = forwardRef<
  HTMLDivElement,
  { className?: string; children: React.ReactNode }
>(function PageCard({ className, children }, ref) {
  return (
    <div className="px-4 md:px-8 lg:px-10">
      <div
        ref={ref}
        className={cn(
          'shadow-theme-md relative mx-auto flex w-full scroll-mt-4 flex-col rounded-[22px] border border-gray-200 bg-surface',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
});

const STEP_COUNT = 3;

/** "Step n of 3", a note on the right, and the three-part progress bar. */
export function StepHeader({ step, aside }: { step: number; aside: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-landing-mono text-brand-500 text-[14px] font-semibold">
          Step {step} of {STEP_COUNT}
        </span>
        <span className="text-[14px] text-gray-500">{aside}</span>
      </div>
      <div aria-hidden className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <span
            key={i}
            className={cn('h-1.5 rounded-full', i < step ? 'bg-brand-500' : 'bg-line')}
          />
        ))}
      </div>
    </div>
  );
}

/** Step title. Focusable so the step change is announced and keyboard focus starts here. */
export const StepTitle = forwardRef<HTMLHeadingElement, { children: React.ReactNode }>(
  function StepTitle({ children }, ref) {
    return (
      <h2
        ref={ref}
        tabIndex={-1}
        className="text-[22px] leading-tight font-extrabold outline-none md:text-[26px]"
      >
        {children}
      </h2>
    );
  }
);

/** Button row under a step: wraps in reverse so the main action sits on top on phones. */
export function StepFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap-reverse items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-5">
      {children}
    </div>
  );
}

/** A footer button slot: full width on phones, natural width from tablet up. */
export function FooterSlot({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-[1_1_100%] flex-col md:flex-none">{children}</div>;
}
