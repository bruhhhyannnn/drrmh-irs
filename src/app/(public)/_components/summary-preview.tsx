import { Clock } from 'lucide-react';
import { SAMPLE_SUMMARY as s } from './content';
import { Eyebrow, Lead, Section, SectionHeading } from './primitives';

/** A static mock of the admin event summary, labelled as sample data. */
export function SummaryPreview() {
  const clusterPct = Math.round((s.clustersReported / s.clustersTotal) * 100);

  return (
    <Section className="grid grid-cols-1 items-center gap-8 md:gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <div className="flex min-w-0 flex-col gap-3">
        <Eyebrow>For the DRRM-H office</Eyebrow>
        <SectionHeading>See who&apos;s accounted for, live</SectionHeading>
        <Lead>Every report updates the event summary. No paper forms.</Lead>
      </div>

      <figure className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-col gap-4 rounded-[22px] border border-gray-200 bg-white p-6 shadow-[0_10px_26px_rgba(16,24,40,.10)]">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
              <span className="text-[17px] leading-[1.3] font-bold">{s.event}</span>
              <span className="font-landing-mono text-[13px] text-gray-500">{s.started}</span>
            </div>
            <span className="bg-success-50 flex h-6.5 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-[#027a48]">
              <span aria-hidden className="bg-success-500 size-1.5 rounded-full" />
              Ongoing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="People counted" value={s.peopleCounted} />
            <StatTile label="Reports" value={s.reports} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-3 text-[14px] font-semibold">
              <span className="text-gray-700">Clusters reported</span>
              <span className="font-landing-mono">
                {s.clustersReported} of {s.clustersTotal}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="bg-brand-500 h-full rounded-full"
                style={{ width: `${clusterPct}%` }}
              />
            </div>
          </div>

          <div className="bg-warning-50 flex items-center gap-2.5 rounded-[14px] border border-[#fedf89] px-3.5 py-3 text-[14px] leading-[1.4] font-medium text-[#93370d]">
            <Clock size={16} aria-hidden className="shrink-0" />
            Waiting on {s.waitingOn}
          </div>

          <div className="flex flex-col">
            <span className="pb-1.5 text-[11px] font-bold tracking-[.08em] text-gray-500 uppercase">
              Latest reports
            </span>
            {s.latest.map((row) => (
              <div
                key={row.unit}
                className="flex items-center gap-3 border-t border-[#eaecf0] py-2.5"
              >
                <span className="min-w-0 flex-1 text-[14px] font-semibold">{row.unit}</span>
                <span className="font-landing-mono text-[14px] font-semibold">{row.count}</span>
                <span className="font-landing-mono w-17 shrink-0 text-right text-[12px] text-gray-500">
                  {row.time}
                </span>
              </div>
            ))}
          </div>
        </div>
        <figcaption className="text-center text-[12px] text-gray-500">
          Event summary · sample data
        </figcaption>
      </figure>
    </Section>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[#eaecf0] bg-gray-50 px-4 py-3.5">
      <span className="text-[12px] font-semibold text-gray-500">{label}</span>
      <span className="font-landing-mono text-[28px] leading-[1.1] font-bold">{value}</span>
    </div>
  );
}
