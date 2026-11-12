import { FOCUS_RING } from '@/components/ds/focus';
import { PILLARS, pillarHref } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PillarsFrame } from '../_components/pillars-frame';
import { PillarMetricsSection } from './_components/pillar-metrics';

// One page per pillar: what it covers, and its building assessment results (DRRM-025).

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
    <PillarsFrame>
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

      <PillarMetricsSection slug={pillar.slug} />

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
          Examples from the national DRRM framework (Republic Act No. 10121).
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
                  : 'border border-gray-200 hover:border-gray-300 hover:bg-hover',
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
    </PillarsFrame>
  );
}
