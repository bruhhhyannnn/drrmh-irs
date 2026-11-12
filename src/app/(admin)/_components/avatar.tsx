'use client';

import { cn, getInitials } from '@/lib';
import { useState } from 'react';

const SIZES = {
  32: 'size-8 text-[14px]',
  36: 'size-9 text-[14px]',
  40: 'size-10 text-[16px]',
  48: 'size-12 text-[18px]',
};

/**
 * A person's Google profile photo (`src`, DRRM-039), or their initials in a circle: maroon for
 * the signed-in admin, grey for everyone else. The photo loads straight from Google without a
 * referrer, and falls back to the initials if it fails.
 */
export function Avatar({
  name,
  src,
  size = 36,
  highlight = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  highlight?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      // A plain img: Google photos need no image optimizer, and next/image would need its host.
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(src)}
        className={cn('shrink-0 rounded-full bg-gray-100 object-cover', SIZES[size])}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold uppercase',
        highlight ? 'bg-brand-solid text-white' : 'bg-gray-100 text-gray-700',
        SIZES[size]
      )}
    >
      {getInitials(name || '?').slice(0, 2)}
    </span>
  );
}
