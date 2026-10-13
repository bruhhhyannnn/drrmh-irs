import { ButtonLink } from '@/components/ds/fields';
import { FOCUS_RING } from '@/components/ds/focus';
import { figtree, splineSansMono } from '@/components/ds/fonts';
import { PILLARS, pillarHref } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { ArrowLeft, Check, Construction } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// One placeholder per pillar until the pillar apps are planned and built (see lib/pillars).

export const dynamicParams = false;

type Props = { params: Promise<{ pillar: string }> };

export function generateStaticParams() {
  return PILLARS.map((pillar) => ({ pillar: pillar.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pillar } = await params;
  const found = PILLARS.find((p) => p.slug === pillar);
  return { title: found ? `${found.name} | DRRM-H` : 'DRRM-H' };
}

export default async function PillarPage({ params }: Props) {
  const { pillar: slug } = await params;
  const index = PILLARS.findIndex((p) => p.slug === slug);
  if (index === -1) notFound();
  const pillar = PILLARS[index];

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
            <span className="truncate text-[12px] text-gray-500">DRRM pillars · preview</span>
          </span>
          <div className="flex-1" />
          <ButtonLink href="/dashboard" variant="outline" size="sm">
            <ArrowLeft size={16} aria-hidden />
            IRS dashboard
          </ButtonLink>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12">
        <div className="flex flex-col gap-3">
          <span className="text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase">
            Pillar {index + 1} of {PILLARS.length}
          </span>
          <div className="flex items-center gap-4">
            <span className="bg-brand-25 text-brand-500 grid size-14 shrink-0 place-items-center rounded-2xl">
              <pillar.icon size={28} aria-hidden />
            </span>
            <h1 className="text-[26px] leading-[1.2] font-extrabold text-balance md:text-[30px]">
              {pillar.name}
            </h1>
          </div>
          <p className="max-w-2xl text-[17px] leading-normal text-pretty text-gray-600">
            {pillar.summary}
          </p>
        </div>

        <section className="bg-surface flex flex-col gap-2 rounded-[22px] border-[1.5px] border-dashed border-gray-300 p-6">
          <span className="bg-warning-50 text-warning-700 flex h-7 w-fit items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold">
            <Construction size={14} aria-hidden />
            Coming soon
          </span>
          <h2 className="text-[19px] font-bold">This pillar is still being planned</h2>
          <p className="max-w-2xl text-[16px] leading-normal text-pretty text-gray-600">
            It will be its own app, separate from the Incident Reporting System. Its pages and
            records will be added once the requirements are set.
          </p>
        </section>

        <section className="bg-surface flex flex-col gap-3 rounded-[22px] border border-gray-200 p-6 shadow-[0_1px_3px_rgba(16,24,40,.08)]">
          <h2 className="text-[19px] font-bold">What this pillar covers</h2>
          <ul className="flex flex-col">
            {pillar.examples.map((example) => (
              <li
                key={example}
                className="border-line flex items-start gap-3 border-b py-3 text-[16px] leading-[1.45] last:border-b-0"
              >
                <Check size={18} aria-hidden className="text-success-700 mt-0.5 shrink-0" />
                {example}
              </li>
            ))}
          </ul>
          <p className="text-[14px] text-pretty text-gray-500">
            Examples from the national DRRM framework (Republic Act No. 10121). What the app will do
            is not decided yet.
          </p>
        </section>

        <nav
          aria-label="DRRM pillars"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PILLARS.map((p, i) => {
            const on = p.slug === pillar.slug;
            return (
              <Link
                key={p.slug}
                href={pillarHref(p.slug)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'bg-surface flex min-w-0 items-center gap-3 rounded-[18px] p-4',
                  on
                    ? 'border-brand-500 border-2'
                    : 'border border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  FOCUS_RING
                )}
              >
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl',
                    on ? 'bg-brand-25 text-brand-500' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  <p.icon size={20} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[12px] font-semibold text-gray-500">Pillar {i + 1}</span>
                  <span className="text-[16px] leading-[1.25] font-bold">{p.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
