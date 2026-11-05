'use client';

import { personMeta, type PersonSex } from '@/components/ds/people';
import { DrawerBody, DrawerSection } from '../../_components/drawer-parts';
import { Mono } from '../../_components/ui';
import { personName } from '../../_lib/format';
import type { Report } from './report-drawer';
import { ReportPhotos } from './report-photos';

const toSex = (sex: string | null): PersonSex =>
  sex === 'male' || sex === 'female' ? sex : 'unknown';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[16px]">
      <dt className="shrink-0 text-gray-600">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-pretty">{children}</dd>
    </div>
  );
}

function Person({ name, meta, extra }: { name: string; meta: string; extra?: string }) {
  return (
    <li className="flex flex-col gap-0.5 border-b border-line py-2.5">
      <span className="text-[16px] font-semibold">{name}</span>
      {extra && <span className="text-[14px] font-semibold text-gray-700">{extra}</span>}
      <span className="text-[14px] text-gray-500">{meta}</span>
    </li>
  );
}

/** A report to read, with nothing to edit: how the drawer shows one on a completed event. */
export function ReportDetails({ report }: { report: Report }) {
  const counts = report.population_counts.filter((pc) => pc.count > 0);
  const total = counts.reduce((sum, pc) => sum + pc.count, 0);

  return (
    <DrawerBody>
      <DrawerSection title="Where">
        <dl className="flex flex-col">
          <Fact label="Cluster">{report.cluster.name}</Fact>
          <Fact label="Unit">{report.unit?.name ?? 'No unit'}</Fact>
          {report.location_name && <Fact label="Location">{report.location_name}</Fact>}
          <Fact label="Reported by">{personName(report.user) || '—'}</Fact>
        </dl>
      </DrawerSection>

      <DrawerSection title="Headcount" aside={`Total ${total.toLocaleString()}`}>
        {counts.length ? (
          <dl className="flex flex-col">
            {counts.map((pc) => (
              <Fact key={pc.category.id} label={pc.category.name}>
                <Mono className="font-bold">{pc.count.toLocaleString()}</Mono>
              </Fact>
            ))}
          </dl>
        ) : (
          <p className="text-[16px] text-gray-500">No people counted.</p>
        )}
      </DrawerSection>

      <DrawerSection title="Missing persons">
        {report.missing_persons.length ? (
          <ul className="flex flex-col">
            {report.missing_persons.map((p) => (
              <Person
                key={p.id}
                name={p.name || 'Unknown person'}
                meta={personMeta({ ...p, name: p.name ?? '', sex: toSex(p.sex) })}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[16px] text-gray-500">None reported.</p>
        )}
      </DrawerSection>

      <DrawerSection title="Casualties">
        {report.casualties.length ? (
          <ul className="flex flex-col">
            {report.casualties.map((c) => (
              <Person
                key={c.id}
                name={c.name || 'Unknown person'}
                extra={c.condition.name}
                meta={personMeta({
                  name: c.name ?? '',
                  age: c.age,
                  sex: toSex(c.sex),
                  diagnosis: c.diagnosis ?? undefined,
                  photoCount: c.photo_paths.length,
                })}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[16px] text-gray-500">None reported.</p>
        )}
      </DrawerSection>

      <DrawerSection title="Structural damage">
        <p className="text-[16px] font-semibold">{report.damage_conditions?.name ?? 'Not set'}</p>
      </DrawerSection>

      <ReportPhotos
        reportId={report.id}
        damageCount={report.damage_photo_paths.length}
        casualtyCount={report.casualties.reduce((n, c) => n + c.photo_paths.length, 0)}
      />
    </DrawerBody>
  );
}
