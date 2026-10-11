import {
  CalendarDays,
  ChartNoAxesColumn,
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
  /** Shown as a bottom tab on phone; the rest sit under More. */
  tab?: boolean;
}

export const NAV: NavItem[] = [
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
    key: 'campus',
    label: 'Campus',
    short: 'Campus',
    href: '/campus',
    icon: University,
    group: 'Manage',
  },
  { key: 'users', label: 'Users', short: 'Users', href: '/users', icon: Users },
  { key: 'settings', label: 'Settings', short: 'Settings', href: '/settings', icon: Settings },
];

export function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
