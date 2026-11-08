import type { Metadata } from 'next';
import { PillarOverview } from './_components/pillar-overview';
import { PillarsFrame } from './_components/pillars-frame';

export const metadata: Metadata = { title: 'DRRM pillars | DRRM-H' };

/** All four pillars at a glance, each linking to its own page. */
export default function PillarsPage() {
  return (
    <PillarsFrame>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-[1.2] font-extrabold md:text-[30px]">DRRM pillars</h1>
        <p className="max-w-2xl text-[17px] leading-normal text-pretty text-gray-600">
          Building assessment results for each of the four pillars, on campus and off campus.
        </p>
      </div>
      <PillarOverview />
    </PillarsFrame>
  );
}
