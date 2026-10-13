import { cn } from '@/lib';
import { Phone } from 'lucide-react';
import { HOTLINES, NATIONAL_HOTLINE as national } from './content';
import { FOCUS_RING, Lead, Section, SectionHeading } from './primitives';

export function HotlinesSection() {
  return (
    <Section id="hotlines" className="flex flex-col gap-8">
      <div className="flex max-w-160 flex-col gap-3">
        <SectionHeading>Emergency hotlines</SectionHeading>
        <Lead>Tap a number to call.</Lead>
      </div>
      <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
        <li className="col-span-full">
          <a
            href={`tel:${national.tel}`}
            className={cn(
              'border-brand-500 bg-brand-25 flex min-h-18 items-center gap-3.5 rounded-2xl border-2 px-5 py-3 text-gray-900',
              FOCUS_RING
            )}
          >
            <span className="bg-brand-solid grid size-11 shrink-0 place-items-center rounded-full text-white">
              <Phone size={20} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[16px] font-bold">{national.name}</span>
              <span className="text-[13px] text-gray-600">{national.desc}</span>
            </span>
            <span className="font-landing-mono text-brand-500 text-[24px] font-bold">
              {national.number}
            </span>
          </a>
        </li>
        {HOTLINES.map((h) => (
          <li key={h.name}>
            <a
              href={`tel:${h.tel}`}
              className={cn(
                'flex min-h-16 items-center gap-3.5 rounded-2xl border-[1.5px] border-gray-200 bg-surface px-4 py-3 text-gray-900 transition-colors hover:border-gray-300 hover:bg-gray-50',
                FOCUS_RING
              )}
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-full',
                  h.highlight ? 'bg-brand-25 text-brand-500' : 'bg-gray-100 text-gray-600'
                )}
              >
                <Phone size={18} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{h.name}</span>
                <span className="font-landing-mono text-[14px] font-medium text-gray-600">
                  {h.number}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
