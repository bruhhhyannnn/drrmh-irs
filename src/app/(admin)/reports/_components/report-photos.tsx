'use client';

import { FOCUS_RING } from '@/components/ds';
import { useReportPhotoUrls } from '@/components/hooks/use-reports';
import { cn } from '@/lib';
import { DrawerSection } from '../../_components/drawer-parts';
import { Skeleton } from '../../_components/ui';
import { plural } from '../../_lib/format';

/**
 * The report's photos behind short-lived signed URLs, fetched when the report is opened: the
 * structural damage first, then each casualty's. Only admins get the URLs.
 */
export function ReportPhotos({
  reportId,
  damageCount,
  casualtyCount,
}: {
  reportId: string;
  damageCount: number;
  casualtyCount: number;
}) {
  const count = damageCount + casualtyCount;
  const { data, error, isPending } = useReportPhotoUrls(reportId, count > 0);
  if (count === 0) return null;

  return (
    <DrawerSection title="Photos" aside={plural(count, 'photo', 'photos')}>
      {isPending ? (
        <PhotoGrid>
          {Array.from({ length: Math.min(count, 6) }, (_, i) => (
            <Skeleton key={i} className="aspect-4/3 rounded-[14px]" />
          ))}
        </PhotoGrid>
      ) : !data ? (
        <p className="text-[14px] font-semibold text-error-700">
          {error?.message || 'The photos could not be loaded.'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.damage.length > 0 && (
            <PhotoGroup title="Structural damage" subject="the damage" urls={data.damage} />
          )}
          {data.casualties.map((c) => (
            <PhotoGroup
              key={c.id}
              title={[c.name || 'Unknown person', c.condition].filter(Boolean).join(' · ')}
              subject={`${c.name || 'an unknown person'}'s injury`}
              urls={c.urls}
            />
          ))}
        </div>
      )}
      <p className="text-[13px] text-gray-500">
        {casualtyCount > 0 &&
          'Casualty photos are health information: keep them inside the DRRM-H office. '}
        Select a photo to open it full size.
      </p>
    </DrawerSection>
  );
}

function PhotoGroup({ title, subject, urls }: { title: string; subject: string; urls: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-semibold">{title}</span>
      <PhotoGrid>
        {urls.map((url, i) => (
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
              alt={`Photo ${i + 1} of ${subject}`}
              className="size-full object-cover"
            />
          </a>
        ))}
      </PhotoGrid>
    </div>
  );
}

function PhotoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}
