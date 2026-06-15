'use client';

import { cn } from '@/lib';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface AuthHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'md' | 'xl';
}

export function AuthHeader({ children, maxWidth = 'md', className, ...props }: AuthHeaderProps) {
  const BG_IMAGES = [
    '/upm-drrmh-background-1.jpg',
    '/upm-drrmh-background-2.jpg',
    '/upm-drrmh-background-3.jpg',
    '/upm-drrmh-background-4.jpg',
  ];
  const track = [...BG_IMAGES, ...BG_IMAGES]; // doubled for seamless loop
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % track.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [track.length]);

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="absolute inset-0 overflow-hidden">
        {track.map((src, i) => (
          <div
            key={i}
            className={cn(
              'absolute inset-0 transition-opacity duration-1000',
              i === current ? 'opacity-100' : 'opacity-0'
            )}
          >
            <Image src={src} alt="" fill className="object-cover" priority={i === 0} />
          </div>
        ))}
        <div className="bg-brand-900/60 absolute inset-0" />
      </div>
      <div
        className={cn(
          'shadow-theme-md z-1 my-12 w-full rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900',
          maxWidth === 'md' && 'max-w-md',
          maxWidth === 'xl' && 'max-w-xl',
          className
        )}
        {...props}
      >
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Image
            src="/up-logo.png"
            alt="UP Manila Logo"
            width={64}
            height={64}
            className="object-contain sm:h-16 sm:w-16"
          />
          <div className="hidden h-10 w-px bg-gray-200 sm:block dark:bg-gray-700" />
          <Image
            src="/upm-drrmh-logo.png"
            alt="DRRM-H Logo"
            width={64}
            height={64}
            sizes="64px"
            className="object-contain"
          />
          <div className="hidden h-10 w-px bg-gray-200 sm:block dark:bg-gray-700" />
          <Image
            src="/irs-logo.png"
            alt="IRS Logo"
            width={64}
            height={64}
            sizes="64px"
            className="object-contain"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">DRRM-H - IRS</p>
            <p className="text-xs text-gray-500">Incident Reporting System</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
