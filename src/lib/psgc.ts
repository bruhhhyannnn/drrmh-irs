// The Philippine Standard Geographic Code as the off-campus Details step uses it (DRRM-024):
// Region → Province (when there is one) → City/Municipality → Barangay. This file stays free of
// the data itself, so the browser can import it; the list is src/data/psgc.json, built by
// scripts/build-psgc.ts and read through src/lib/psgc-data.ts on the server.

/** Bump with each rebuild of src/data/psgc.json: phones keep the list under this name. */
export const PSGC_VERSION = 'psgc-gitlab-2026-11-05';

export interface CodeName {
  code: string;
  name: string;
}

export interface PsgcCity extends CodeName {
  barangays: CodeName[];
}

export interface PsgcProvince extends CodeName {
  cities: PsgcCity[];
}

export interface PsgcRegion extends CodeName {
  provinces: PsgcProvince[];
  /** Cities and municipalities with no province: all of Metro Manila, and a few others. */
  cities: PsgcCity[];
}

export type PsgcTree = PsgcRegion[];

/** Where one barangay is. A province is null where there is none. */
export interface BuildingLocation {
  region: CodeName;
  province: CodeName | null;
  city: CodeName;
  barangay: CodeName;
}

/** The flat lists a tree is built from. A sub-municipality's barangays name their city. */
export interface PsgcSource {
  regions: { code: string | number; name: string }[];
  provinces: { code: string | number; name: string; regionCode: string | number }[];
  cities: {
    /** What a barangay's `cityKey` refers to. */
    key: string;
    code: string | number;
    name: string;
    regionCode: string | number;
    provinceCode: string | number | null;
  }[];
  barangays: { code: string | number; name: string; cityKey: string }[];
}

const toCode = (code: string | number) => String(code).padStart(10, '0');
const byName = (a: CodeName, b: CodeName) =>
  a.name.localeCompare(b.name, undefined, { numeric: true });
const place = (row: { code: string | number; name: string }): CodeName => ({
  code: toCode(row.code),
  name: row.name.trim(),
});

/** The nested list, each level by name. Throws when a row's parent is missing, naming the row. */
export function buildPsgcTree(source: PsgcSource): PsgcTree {
  const regions = new Map<string, PsgcRegion>(
    source.regions.map((r) => [toCode(r.code), { ...place(r), provinces: [], cities: [] }])
  );
  const provinces = new Map<string, PsgcProvince>();
  for (const row of source.provinces) {
    const province: PsgcProvince = { ...place(row), cities: [] };
    const region = regions.get(toCode(row.regionCode));
    if (!region) throw new Error(`Province ${province.code} has no region.`);
    region.provinces.push(province);
    provinces.set(province.code, province);
  }

  const cities = new Map<string, PsgcCity>();
  for (const row of source.cities) {
    const city: PsgcCity = { ...place(row), barangays: [] };
    const parent =
      row.provinceCode === null
        ? regions.get(toCode(row.regionCode))
        : provinces.get(toCode(row.provinceCode));
    if (!parent) throw new Error(`City or municipality ${city.code} has no parent.`);
    parent.cities.push(city);
    cities.set(row.key, city);
  }

  for (const row of source.barangays) {
    const city = cities.get(row.cityKey);
    if (!city) throw new Error(`Barangay ${toCode(row.code)} has no city or municipality.`);
    city.barangays.push(place(row));
  }

  const tree = [...regions.values()].sort(byName);
  for (const region of tree) {
    region.provinces.sort(byName);
    region.cities.sort(byName);
    region.cities.forEach((c) => c.barangays.sort(byName));
    for (const province of region.provinces) {
      province.cities.sort(byName);
      province.cities.forEach((c) => c.barangays.sort(byName));
    }
  }
  return tree;
}

const bare = ({ code, name }: CodeName): CodeName => ({ code, name });

/** Every barangay by code, with the places above it. */
export function indexBarangays(tree: PsgcTree): Map<string, BuildingLocation> {
  const index = new Map<string, BuildingLocation>();
  const add = (region: PsgcRegion, province: PsgcProvince | null, city: PsgcCity) => {
    for (const barangay of city.barangays) {
      index.set(barangay.code, {
        region: bare(region),
        province: province && bare(province),
        city: bare(city),
        barangay,
      });
    }
  };
  for (const region of tree) {
    region.cities.forEach((city) => add(region, null, city));
    for (const province of region.provinces) {
      province.cities.forEach((city) => add(region, province, city));
    }
  }
  return index;
}
