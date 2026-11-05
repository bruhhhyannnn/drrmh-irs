import type { CodeName, PsgcCity, PsgcRegion, PsgcTree } from './psgc';

// What each off-campus location dropdown offers, given the choices above it (DRRM-024).

/** The Province choice for a city outside any province, in a region that also has provinces. */
export const NO_PROVINCE = '__none';

export interface LocationPicks {
  region_code: string;
  /** '' until chosen or where the region has no provinces; NO_PROVINCE for a city outside one. */
  province_code: string;
  city_code: string;
}

export interface LocationOptions {
  /** false when the list isn't on this phone yet. */
  available: boolean;
  regions: CodeName[];
  provinces: CodeName[];
  showProvince: boolean;
  cities: CodeName[];
  barangays: CodeName[];
}

const NOTHING: Omit<LocationOptions, 'available'> = {
  regions: [],
  provinces: [],
  showProvince: false,
  cities: [],
  barangays: [],
};

const bare = ({ code, name }: CodeName): CodeName => ({ code, name });

/** The cities a region and province choice leads to. */
function citiesOf(region: PsgcRegion | undefined, provinceCode: string): PsgcCity[] {
  if (!region) return [];
  if (region.provinces.length === 0 || provinceCode === NO_PROVINCE) return region.cities;
  return region.provinces.find((p) => p.code === provinceCode)?.cities ?? [];
}

export function locationOptions(tree: PsgcTree | null, picks: LocationPicks): LocationOptions {
  if (!tree) return { available: false, ...NOTHING };
  const region = tree.find((r) => r.code === picks.region_code);
  const cities = citiesOf(region, picks.province_code);
  return {
    available: true,
    regions: tree.map(bare),
    provinces: region
      ? [
          ...region.provinces.map(bare),
          ...(region.provinces.length > 0 && region.cities.length > 0
            ? [{ code: NO_PROVINCE, name: 'City not under a province' }]
            : []),
        ]
      : [],
    showProvince: !!region && region.provinces.length > 0,
    cities: cities.map(bare),
    barangays: cities.find((c) => c.code === picks.city_code)?.barangays ?? [],
  };
}

const hasBarangay = (city: PsgcCity, code: string) => city.barangays.some((b) => b.code === code);

/** The dropdown choices that lead to a barangay, to reopen a draft that only has its code. */
export function picksFromBarangay(tree: PsgcTree | null, code: string): LocationPicks | null {
  for (const region of tree ?? []) {
    const direct = region.cities.find((c) => hasBarangay(c, code));
    if (direct) {
      return {
        region_code: region.code,
        province_code: region.provinces.length > 0 ? NO_PROVINCE : '',
        city_code: direct.code,
      };
    }
    for (const province of region.provinces) {
      const city = province.cities.find((c) => hasBarangay(c, code));
      if (city) {
        return { region_code: region.code, province_code: province.code, city_code: city.code };
      }
    }
  }
  return null;
}

/** Lower case with accents dropped, so "pinas" finds "Las Piñas". */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The options whose label contains the search; all of them for a blank one. */
export function filterOptions<T extends { label: string }>(options: T[], query: string): T[] {
  const wanted = fold(query.trim());
  return wanted ? options.filter((o) => fold(o.label).includes(wanted)) : options;
}
