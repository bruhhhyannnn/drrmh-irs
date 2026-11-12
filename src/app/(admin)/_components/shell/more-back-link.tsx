'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isMorePage, MORE_HREF } from './nav';
import { useNav } from './use-nav';

/** The Back link above a page title. */
export const BACK_LINK =
  '-ml-1 flex h-8 items-center gap-1.5 self-start rounded-lg px-1 text-[16px] font-bold text-gray-600 hover:text-gray-900';

/** Phone only: back to the More page from a page it opens (Reports, Users, Settings…). */
export function MoreBackLink() {
  const pathname = usePathname();
  const nav = useNav();
  if (!isMorePage(nav, pathname)) return null;
  return (
    <Link href={MORE_HREF} className={cn(BACK_LINK, FOCUS_RING, 'md:hidden')}>
      <ArrowLeft size={16} aria-hidden />
      More
    </Link>
  );
}
