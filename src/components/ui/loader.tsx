'use client';

import { cn } from '@/lib';
import Image from 'next/image';
import { useEffect, useState } from 'react';

/**
 * Branded loader for full pages and sections: the IRS logo standing still inside a maroon arc,
 * with a line saying what is loading. It stays invisible for `delay` ms so fast loads don't flash.
 */
export function Loader({
  label = 'Loading…',
  fullScreen = false,
  delay = 300,
  className,
}: {
  label?: string;
  fullScreen?: boolean;
  delay?: number;
  className?: string;
}) {
  const [show, setShow] = useState(delay === 0);
  useEffect(() => {
    if (!delay) return;
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-10',
        fullScreen && 'min-h-dvh',
        !show && 'invisible',
        className
      )}
    >
      <div className="relative size-16">
        {/* The 192px PWA icon, served as-is: it is in the service worker's precache, so the logo
            still shows offline (an optimised /_next/image URL wouldn't be). */}
        <Image
          src="/icon-192x192.png"
          alt=""
          width={64}
          height={64}
          unoptimized
          loading="eager"
          className="size-full object-contain p-3"
        />
        <svg
          viewBox="0 0 64 64"
          aria-hidden
          className="text-brand-500 absolute inset-0 motion-safe:animate-spin"
        >
          <circle
            cx="32"
            cy="32"
            r="30"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".15"
            strokeWidth="3"
          />
          <circle
            cx="32"
            cy="32"
            r="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="47 142"
          />
        </svg>
      </div>
      <p className="text-[14px] text-gray-600">{label}</p>
    </div>
  );
}
