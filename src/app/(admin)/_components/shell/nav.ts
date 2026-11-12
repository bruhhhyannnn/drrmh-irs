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
  /** The path it lights up on, when `href` carries a query (an administrator's campus page). */
  activePath?: string;
}

/** The campus group's entry point: All campuses for super admins, their campus for the rest. */
export const CAMPUSES_KEY = 'campuses';

/** The campus page of one campus. */
export const campusPageHref = (id: string) => `/campus/details?id=${id}`;

const HOME: NavItem = {
  key: 'home',
  label: 'Dashboard',
  short: 'Home',
  href: '/dashboard',
  icon: LayoutGrid,
  tab: true,
};

const REST: NavItem[] = [
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
    description: 'Status reports from ERT members',
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
    key: 'users',
    label: 'Users',
    short: 'Users',
    href: '/users',
    icon: Users,
    group: 'Manage',
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
];

/**
 * The nav for the signed-in role, campus first (DRRM-037): Dashboard; the Campuses group (the
 * sidebar lists the campuses with events before this item, which is All campuses → /campus);
 * Records; Manage. An administrator's Campus group is their own campus page. The DRRM pillars
 * left the nav; their pages stay reachable by URL.
 */
export function navFor(isSuperAdmin: boolean, ownCampus?: { id: string; name: string } | null) {
  const campus: NavItem = isSuperAdmin
    ? {
        key: CAMPUSES_KEY,
        label: 'All campuses',
        short: 'Campuses',
        href: '/campus',
        icon: University,
        group: 'Campuses',
        tab: true,
      }
    : {
        key: CAMPUSES_KEY,
        label: ownCampus?.name ?? 'Campus',
        short: 'Campus',
        href: ownCampus ? campusPageHref(ownCampus.id) : '/dashboard',
        activePath: '/campus/details',
        icon: University,
        group: 'Campus',
        tab: true,
      };
  return [HOME, campus, ...REST];
}

/** The campus list is super admins' only; administrators may open their own campus page. */
export function isSuperAdminPath(pathname: string) {
  return pathname === '/campus' || isActivePath(pathname, '/assessments/checklist');
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
  return nav.some((n) => !n.tab && n.href === pathname);
}

export function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether a nav item is the current page. */
export const isActiveItem = (pathname: string, item: NavItem) =>
  isActivePath(pathname, item.activePath ?? item.href);
