import { ButtonLink } from '@/components/ds/fields';
import { figtree, splineSansMono } from '@/components/ds/fonts';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';

/** The header and page width shared by /pillars and each pillar's page. */
export function PillarsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        figtree.variable,
        splineSansMono.variable,
        'font-landing bg-canvas min-h-dvh text-gray-900 antialiased'
      )}
    >
      <header className="border-line bg-surface border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
          <Image
            src="/irs-logo.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 object-contain"
          />
          <span className="flex min-w-0 flex-col gap-px">
            <span className="text-[15px] leading-[1.2] font-extrabold">UPM DRRM-H</span>
            <span className="truncate text-[12px] text-gray-500">DRRM pillars</span>
          </span>
          <div className="flex-1" />
          <ButtonLink href="/dashboard" variant="outline" size="sm">
            <ArrowLeft size={16} aria-hidden />
            IRS dashboard
          </ButtonLink>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
        {children}
      </main>
    </div>
  );
}
