'use client';

import { useCampusLogos } from '@/components/hooks/use-campus';
import { cn } from '@/lib';
import { campusLogo, ownCampusLogo } from '@/lib/campus-logo';

/**
 * The campus logo. A campus without its own logo (e.g. UP PGH) shows the UP seal
 * (`fallback="seal"`, the default in the lists and headers) or its name in a maroon circle
 * (`fallback="initials"`). An uploaded logo (DRRM-036) comes first. `size` is in px; `className`
 * (e.g. `size-12 md:size-16`) overrides it.
 */
export function CampusMark({
  name,
  size = 56,
  fallback = 'seal',
  className,
}: {
  name: string;
  size?: number;
  fallback?: 'seal' | 'initials';
  className?: string;
}) {
  const { data: logos } = useCampusLogos();
  const own = ownCampusLogo(name, logos?.byName[name]);
  const logo = own ?? (fallback === 'seal' ? campusLogo(name) : null);
  const box = className ? undefined : { width: size, height: size };
  if (logo) {
    return (
      <span
        role="img"
        aria-label={`${name} logo`}
        className={cn('shrink-0 bg-contain bg-center bg-no-repeat', className)}
        style={{ ...box, backgroundImage: `url(${logo})` }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'bg-brand-25 text-brand-500 grid shrink-0 place-items-center rounded-full border-[1.5px] border-brand-100 font-extrabold',
        className
      )}
      style={{ ...box, fontSize: Math.max(11, Math.round(size * 0.3)) }}
    >
      {name.replace(/^UP\s+/i, '').slice(0, 4)}
    </span>
  );
}
