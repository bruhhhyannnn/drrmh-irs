'use client';

import type { getBystanderReports } from '@/actions/emergency-reports';
import { Drawer, FOCUS_RING, formatCoordinates, personMeta, type PersonSex } from '@/components/ds';
import { useBystanderPhotoUrls } from '@/components/hooks/use-bystander-reports';
import { cn } from '@/lib';
import { format } from 'date-fns';
import { UserRound } from 'lucide-react';
import {
  DrawerBody,
  DrawerButton,
  DrawerButtons,
  DrawerSection,
  KvList,
  StatBoxes,
} from '../../_components/drawer-parts';
import { Chip, Mono, Skeleton } from '../../_components/ui';
import { plural } from '../../_lib/format';
import { bystanderStatusKey, bystanderTone, capitalize } from '../../_lib/status';

export type BystanderRow = Awaited<ReturnType<typeof getBystanderReports>>[number];

const toSex = (sex: string | null): PersonSex =>
  sex === 'male' || sex === 'female' ? sex : 'unknown';

/** "+63 917 123 4567" from the stored "+639171234567". */
function formatPhone(value: string) {
  const m = value.match(/^\+63(\d{3})(\d{3})(\d{3,4})$/);
  return m ? `+63 ${m[1]} ${m[2]} ${m[3]}` : value;
}

/**
 * The report in a drawer, with the status actions in its footer so they are taken after
 * reading. Photos and the contact number only show when the bystander added them.
 */
export function BystanderDrawer({
  report,
  onClose,
  onReview,
  onVerify,
  onDismiss,
  reviewing,
}: {
  report: BystanderRow | null;
  onClose: () => void;
  onReview: (report: BystanderRow) => void;
  onVerify: (report: BystanderRow) => void;
  onDismiss: (report: BystanderRow) => void;
  reviewing?: boolean;
}) {
  const status = bystanderStatusKey(report?.bystander_report_statuses?.name);
  return (
    <Drawer
      open={!!report}
      onClose={onClose}
      size="wide"
      eyebrow="Bystander report"
      title={report?.bystander_incident_types?.name ?? 'Incident'}
      titleAside={
        report && (
          <Chip tone={bystanderTone(status)} dot>
            {capitalize(status)}
          </Chip>
        )
      }
      subtitle={
        report
          ? `Submitted ${format(new Date(report.submitted_at), "MMMM d, yyyy '·' h:mm a")}`
          : undefined
      }
      footer={
        report && (status === 'pending' || status === 'reviewed') ? (
          <DrawerButtons>
            <DrawerButton variant="danger" onClick={() => onDismiss(report)}>
              Dismiss
            </DrawerButton>
            {status === 'pending' && (
              <DrawerButton variant="outline" loading={reviewing} onClick={() => onReview(report)}>
                Mark reviewed
              </DrawerButton>
            )}
            <DrawerButton onClick={() => onVerify(report)}>Verify</DrawerButton>
          </DrawerButtons>
        ) : (
          <DrawerButtons>
            <DrawerButton variant="outline" onClick={onClose}>
              Close
            </DrawerButton>
          </DrawerButtons>
        )
      }
    >
      {report && <BystanderDetails report={report} />}
    </Drawer>
  );
}

function BystanderDetails({ report: r }: { report: BystanderRow }) {
  const headcount = r.population_counts.filter((c) => c.count > 0);
  const headTotal = headcount.reduce((sum, c) => sum + c.count, 0);
  const osm = `https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=18/${r.latitude}/${r.longitude}`;

  return (
    <DrawerBody>
      <DrawerSection title="Location">
        <KvList
          rows={[
            { label: 'Campus', value: r.clusters?.campus?.name },
            { label: 'Cluster', value: r.clusters?.name },
            { label: 'Unit', value: r.units?.name },
            ...(r.location_description
              ? [{ label: 'Location', value: r.location_description }]
              : []),
            {
              label: 'Map pin',
              value: (
                <span className="flex flex-wrap items-baseline gap-x-2.5">
                  <Mono className="text-[13px]">{formatCoordinates(r.latitude, r.longitude)}</Mono>
                  <a
                    href={osm}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'text-brand-500 rounded text-[13px] font-bold hover:underline',
                      FOCUS_RING
                    )}
                  >
                    Open map
                  </a>
                </span>
              ),
            },
            ...(r.damage_conditions
              ? [{ label: 'Structural damage', value: r.damage_conditions.name }]
              : []),
          ]}
        />
      </DrawerSection>

      {r.description && (
        <DrawerSection title="What happened">
          <p className="rounded-2xl border border-line bg-gray-50 px-4 py-3.5 text-[15px] leading-[1.6] text-pretty text-gray-700">
            {r.description}
          </p>
        </DrawerSection>
      )}

      {r.photo_paths.length > 0 && <Photos reportId={r.id} count={r.photo_paths.length} />}

      {headcount.length > 0 && (
        <DrawerSection title="Headcount" aside={`Total ${headTotal.toLocaleString()}`}>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
            {headcount.map((c) => (
              <li
                key={c.id}
                className="flex min-w-0 flex-col gap-1 rounded-[14px] border border-line bg-surface px-3 py-2.5"
              >
                <Mono className="text-[18px] leading-none font-bold">
                  {c.count.toLocaleString()}
                </Mono>
                <span className="text-[12px] leading-[1.3] font-medium text-pretty text-gray-500">
                  {c.category.name}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-gray-500">Fields left at 0 are not listed.</p>
        </DrawerSection>
      )}

      <DrawerSection title="People affected">
        <StatBoxes
          stats={[
            { label: 'Missing persons', value: r.report_missing_persons.length, tone: 'amber' },
            { label: 'Casualties', value: r.report_casualties.length, tone: 'red' },
          ]}
        />
      </DrawerSection>

      {r.report_casualties.length > 0 && (
        <DrawerSection title="Casualties">
          <PeopleList
            tone="red"
            people={r.report_casualties.map((c) => ({
              id: c.id,
              name: c.name || 'Unknown person',
              chip: c.condition?.name,
              meta: personMeta({
                name: c.name,
                age: c.age,
                sex: toSex(c.sex),
                diagnosis: c.diagnosis,
              }),
            }))}
          />
        </DrawerSection>
      )}

      {r.report_missing_persons.length > 0 && (
        <DrawerSection title="Missing persons">
          <PeopleList
            tone="amber"
            people={r.report_missing_persons.map((p) => ({
              id: p.id,
              name: p.name || 'Unknown person',
              meta: personMeta({ name: p.name, age: p.age, sex: toSex(p.sex) }),
            }))}
          />
        </DrawerSection>
      )}

      {r.contact_number && (
        <DrawerSection title="Contact">
          <KvList
            rows={[
              {
                label: 'Contact number',
                value: (
                  <a
                    href={`tel:${r.contact_number}`}
                    className={cn('text-brand-500 rounded hover:underline', FOCUS_RING)}
                  >
                    {formatPhone(r.contact_number)}
                  </a>
                ),
              },
            ]}
          />
          <p className="text-[13px] text-gray-500">
            Optional. Added by the reporter so responders can follow up.
          </p>
        </DrawerSection>
      )}
    </DrawerBody>
  );
}

function PeopleList({
  people,
  tone,
}: {
  people: { id: string; name: string; chip?: string; meta: string }[];
  tone: 'red' | 'amber';
}) {
  return (
    <ul className="flex flex-col gap-2">
      {people.map((p) => (
        <li
          key={p.id}
          className="flex items-center gap-3 rounded-2xl border-[1.5px] border-gray-200 px-3.5 py-3"
        >
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-full',
              tone === 'red' ? 'bg-error-50 text-error-700' : 'bg-warning-50 text-warning-700'
            )}
          >
            <UserRound size={18} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.75">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-[15px] font-semibold">{p.name}</span>
              {p.chip && <Chip tone="amber">{p.chip}</Chip>}
            </div>
            <span className="text-[13px] leading-[1.4] text-gray-500">{p.meta}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Thumbnails behind short-lived signed URLs, fetched when the report is opened. */
function Photos({ reportId, count }: { reportId: string; count: number }) {
  const { data: urls = [], isPending, isError } = useBystanderPhotoUrls(reportId, count > 0);
  return (
    <DrawerSection title="Photos" aside={plural(count, 'photo', 'photos')}>
      {isError ? (
        <p className="text-[14px] font-semibold text-error-700">The photos could not be loaded.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {isPending
            ? Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} className="aspect-4/3 rounded-[14px]" />
              ))
            : urls.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open full size"
                  className={cn(
                    'block aspect-4/3 overflow-hidden rounded-[14px] border border-line bg-gray-100',
                    FOCUS_RING
                  )}
                >
                  <img
                    src={url}
                    alt={`Photo ${i + 1} of the damage`}
                    className="size-full object-cover"
                  />
                </a>
              ))}
        </div>
      )}
      <p className="text-[13px] text-gray-500">
        Location data was removed when the photos were sent. Select a photo to open it full size.
      </p>
    </DrawerSection>
  );
}
