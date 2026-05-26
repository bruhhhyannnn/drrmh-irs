'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useCallback } from 'react';
import { useSidebarStore } from '@/store';
import {
  LayoutDashboard,
  ScrollText,
  CalendarDays,
  BarChart2,
  Users,
  Calendar,
  Settings,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib';
import Image from 'next/image';
import { version } from '../../../package.json';

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path?: string }[];
};

const navItems: NavItem[] = [
  { icon: <LayoutDashboard size={20} />, name: 'Home', path: '/dashboard' },
  { icon: <CalendarDays size={20} />, name: 'Events', path: '/events' },
  { icon: <BarChart2 size={20} />, name: 'Reports', path: '/reports' },
  { icon: <AlertTriangle size={20} />, name: 'Emergency Reports', path: '/emergency-reports' },
  { icon: <Calendar size={20} />, name: 'Calendar', path: '/calendar' },
  { icon: <Users size={20} />, name: 'Users', path: '/users' },
  { icon: <ScrollText size={20} />, name: 'Activity Logs', path: '/activity-logs' },
  {
    icon: <Settings size={20} />,
    name: 'Settings',
    subItems: [
      { name: 'Clusters', path: '/settings/clusters' },
      { name: 'Units', path: '/settings/units' },
      { name: 'Locations', path: '/settings/locations' },
      { name: 'Positions', path: '/settings/positions' },
      { name: 'User Types', path: '/settings/user-types' },
      { name: 'Event Statuses', path: '/settings/event-statuses' },
      { name: 'Casualty Conditions', path: '/settings/casualty-conditions' },
      { name: 'Damage Reports', path: '/settings/damage-reports' },
    ],
  },
];

export function AppSidebar() {
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    openSubmenu,
    setIsHovered,
    toggleSubmenu,
    setOpenSubmenu,
  } = useSidebarStore();
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const isVisible = isExpanded || isHovered || isMobileOpen;

  const isActive = useCallback(
    (path?: string) => {
      if (!path) return false;
      if (path === '/dashboard') return pathname === '/dashboard';
      return pathname.startsWith(path);
    },
    [pathname]
  );

  // Auto-open submenu for active path
  useEffect(() => {
    const activeParent = navItems.find((item) =>
      item.subItems?.some((sub) => sub.path && pathname.startsWith(sub.path))
    );

    setOpenSubmenu(activeParent?.name ?? null);
  }, [pathname]);

  return (
    <aside
      ref={sidebarRef}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'fixed top-0 left-0 z-2 flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-900',
        isVisible ? 'w-72.5' : 'w-20',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center border-b border-gray-200 py-4 dark:border-gray-800',
          isVisible ? 'justify-start px-6' : 'justify-center px-4',
          isMobileOpen && 'mt-16'
        )}
      >
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/irs-favicon.png"
            alt="IRS Logo"
            width={48}
            height={48}
            sizes="48px"
            className="object-contain"
          />
          {isVisible && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">IRS</span>
              <span className="text-xs text-gray-500">DRRM-H System</span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => (
            <li key={item.name}>
              {item.subItems ? (
                <>
                  <button
                    onClick={() => toggleSubmenu(item.name)}
                    className={cn(
                      'menu-item w-full',
                      openSubmenu === item.name ? 'menu-item-active' : 'menu-item-inactive',
                      !isVisible && 'lg:justify-center'
                    )}
                  >
                    <span
                      className={
                        openSubmenu === item.name
                          ? 'menu-item-icon-active'
                          : 'menu-item-icon-inactive'
                      }
                    >
                      {item.icon}
                    </span>
                    {isVisible && (
                      <>
                        <span className="menu-item-text flex-1 text-start">{item.name}</span>
                        <ChevronDown
                          size={16}
                          className={cn(
                            'transition-transform duration-200',
                            openSubmenu === item.name && 'rotate-180'
                          )}
                        />
                      </>
                    )}
                  </button>

                  {isVisible && openSubmenu === item.name && (
                    <ul className="mt-1 ml-9 flex flex-col gap-1">
                      {item.subItems.map((sub) => (
                        <li key={sub.name}>
                          {sub.path ? (
                            <Link
                              href={sub.path}
                              className={cn(
                                'block rounded-lg px-4 py-2 text-sm transition',
                                isActive(sub.path)
                                  ? 'text-brand-500 dark:text-brand-400 font-medium'
                                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                              )}
                            >
                              {sub.name}
                            </Link>
                          ) : (
                            <span className="block rounded-lg px-3 py-2 text-sm text-gray-400">
                              {sub.name}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Link
                  href={item.path!}
                  className={cn(
                    'menu-item',
                    isActive(item.path) ? 'menu-item-active' : 'menu-item-inactive',
                    !isVisible && 'lg:justify-center'
                  )}
                >
                  <span
                    className={
                      isActive(item.path) ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
                    }
                  >
                    {item.icon}
                  </span>
                  {isVisible && <span className="menu-item-text">{item.name}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      {isVisible && (
        <div className="flex flex-col border-t border-gray-200 p-4 dark:border-gray-800">
          <p className="text-center text-xs text-gray-500">UP Manila DRRM-H © 2026</p>
          <p className="text-center text-xs text-gray-400 dark:text-gray-600">Version {version}</p>
        </div>
      )}
    </aside>
  );
}
