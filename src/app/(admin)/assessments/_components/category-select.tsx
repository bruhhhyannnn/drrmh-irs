'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FilterSelect } from '../../_components/data-list';
import { categoryFromParam, type CategoryFilter } from '../_lib/category-filter';

/** The filter's choice, kept in `?category=`. Campus, the default, leaves the URL clean. */
export function useCategory(): [CategoryFilter, (next: CategoryFilter) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const setCategory = (next: CategoryFilter) => {
    const p = new URLSearchParams(params.toString());
    if (next === 'campus') p.delete('category');
    else p.set('category', next);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
  return [categoryFromParam(params.get('category')), setCategory];
}

export function CategorySelect({
  value,
  onChange,
}: {
  value: CategoryFilter;
  onChange: (next: CategoryFilter) => void;
}) {
  return (
    <FilterSelect
      label="Campus or off-campus"
      allLabel="Campus and off-campus"
      value={value === 'all' ? '' : value}
      onChange={(next) => onChange(next === '' ? 'all' : categoryFromParam(next))}
      options={[
        { value: 'campus', label: 'Campus' },
        { value: 'off_campus', label: 'Off-campus' },
      ]}
    />
  );
}
