import { PILLARS, pillarHref } from '@/lib/pillars';
import {
  CalendarDays,
  ChartNoAxesColumn,
  ClipboardCheck,
  LayoutGrid,
  Settings,
  TriangleAlert,
  University,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  /** Rail and bottom-tab label. */
  short: string;
  href: string;
  icon: LucideIcon;
  /** Starts a group in the sidebar. */
  group?: string;
  /** Shown as a bottom tab on phone; the rest sit on the More page. */
  tab?: boolean;
  /** Its line on the phone More page. */
  description?: string;
  /** Opens in a new tab: the DRRM pillars, which will become their own apps. */
  newTab?: boolean;
}

const NAV: NavItem[] = [
  {
    key: 'home',
    label: 'Dashboard',
    short: 'Home',
    href: '/dashboard',
    icon: LayoutGrid,
    tab: true,
  },
  {
    key: 'events',
    label: 'Events',
    short: 'Events',
    href: '/events',
    icon: CalendarDays,
    group: 'Records',
    tab: true,
  },
  {
    key: 'reports',
    label: 'Reports',
    short: 'Reports',
    href: '/reports',
    icon: ChartNoAxesColumn,
    tab: true,
  },
  {
    key: 'bystander',
    label: 'Bystander reports',
    short: 'Bystander',
    href: '/emergency-reports',
    icon: TriangleAlert,
    tab: true,
  },
  {
    key: 'assessments',
    label: 'Assessments',
    short: 'Assess',
    href: '/assessments',
    icon: ClipboardCheck,
    description: 'MATATAG building safety assessments',
  },
  {
    key: 'campus',
    label: 'Campus',
    short: 'Campus',
    href: '/campus',
    icon: University,
    group: 'Manage',
    description: 'Campuses and their details',
  },
  {
    key: 'users',
    label: 'Users',
    short: 'Users',
    href: '/users',
    icon: Users,
    description: 'ERT members and administrators',
  },
  {
    key: 'settings',
    label: 'Settings',
    short: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Clusters, units, positions and fields',
  },
  ...PILLARS.map((pillar, i) => ({
    key: `pillar-${pillar.slug}`,
    label: pillar.label,
    short: pillar.short,
    href: pillarHref(pillar.slug),
    icon: pillar.icon,
    newTab: true,
    description: 'Opens in a new tab',
    ...(i === 0 && { group: 'DRRM pillars' }),
  })),
];

/** Pages only super admins can open; administrators run one campus. */
export const SUPER_ADMIN_HREFS = ['/campus', '/assessments/checklist'];

/** The nav for the signed-in role. Without Campus, the Manage group starts at Users. */
export function navFor(isSuperAdmin: boolean): NavItem[] {
  if (isSuperAdmin) return NAV;
  return NAV.filter((n) => !SUPER_ADMIN_HREFS.includes(n.href)).map((n) =>
    n.key === 'users' ? { ...n, group: 'Manage' } : n
  );
}

/** The phone More page, which lists every page that isn't a bottom tab. */
export const MORE_HREF = '/more';

/** The pages that aren't bottom tabs, under their sidebar group titles, for the More page. */
export function moreGroups(nav: NavItem[]) {
  const groups: { title: string; items: NavItem[] }[] = [];
  let title = '';
  for (const item of nav) {
    if (item.group) title = item.group;
    if (item.tab) continue;
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(item);
    else groups.push({ title, items: [item] });
  }
  return groups;
}

/** A page opened from the More page, which gets a "More" back link on phone. */
export function isMorePage(nav: NavItem[], pathname: string) {
  return nav.some((n) => !n.tab && !n.newTab && n.href === pathname);
}

export function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
