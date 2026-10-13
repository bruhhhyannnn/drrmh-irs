'use client';

import { FieldHelp, SegmentedControl } from '@/components/ds';
import type { ThemePreference } from '@/lib/theme';
import { useThemeStore } from '@/store';
import { useId } from 'react';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Device' },
];

/** Light / Dark / Device switch, saved on this device. Shown in My profile. */
export function AppearanceSetting() {
  const id = useId();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <section className="flex flex-col gap-3.5">
      <h3
        id={id}
        className="text-[11px] large-text:text-[12px] font-bold tracking-[.08em] text-gray-500 uppercase"
      >
        Appearance
      </h3>
      <SegmentedControl
        name={`${id}-theme`}
        labelledBy={id}
        options={OPTIONS}
        value={preference}
        onChange={(value) => setPreference(value as ThemePreference)}
      />
      <FieldHelp>Device matches your phone or computer&apos;s light or dark setting.</FieldHelp>
    </section>
  );
}
