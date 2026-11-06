// Builds src/data/psgc.json. Run with `npm run psgc:build`, then bump PSGC_VERSION in
// src/lib/psgc.ts so phones download the new list.
//
// The source is psgc.gitlab.io, a public mirror of the PSA's list, because the PSA's site doesn't
// allow automated downloads. It predates the 2024 Negros Island Region: Negros Occidental, Negros
// Oriental and Siquijor still sit under Regions VI and VII.

import { writeFile } from 'node:fs/promises';
import { buildPsgcTree, indexBarangays, type PsgcSource } from '../src/lib/psgc';

const API = 'https://psgc.gitlab.io/api';

async function list<T>(name: string): Promise<T[]> {
  const res = await fetch(`${API}/${name}.json`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json() as Promise<T[]>;
}

type Row = { code: string; name: string; psgc10DigitCode: string };
type Linked = { provinceCode: string | false; regionCode: string };

async function main() {
  const [regions, provinces, cities, barangays] = await Promise.all([
    list<Row>('regions'),
    list<Row & { regionCode: string }>('provinces'),
    list<Row & Linked>('cities-municipalities'),
    list<Row & { cityCode: string | false; municipalityCode: string | false }>('barangays'),
  ]);

  const tenDigit = (rows: Row[]) => new Map(rows.map((r) => [r.code, r.psgc10DigitCode]));
  const regionCodes = tenDigit(regions);
  const provinceCodes = tenDigit(provinces);
  const need = (map: Map<string, string>, code: string) => {
    const found = map.get(code);
    if (!found) throw new Error(`Unknown code ${code}`);
    return found;
  };

  const source: PsgcSource = {
    regions: regions.map((r) => ({ code: r.psgc10DigitCode, name: r.name })),
    provinces: provinces.map((p) => ({
      code: p.psgc10DigitCode,
      name: p.name,
      regionCode: need(regionCodes, p.regionCode),
    })),
    cities: cities.map((c) => ({
      key: c.code,
      code: c.psgc10DigitCode,
      name: c.name,
      regionCode: need(regionCodes, c.regionCode),
      provinceCode: c.provinceCode ? need(provinceCodes, c.provinceCode) : null,
    })),
    barangays: barangays.map((b) => ({
      code: b.psgc10DigitCode,
      name: b.name,
      cityKey: String(b.cityCode || b.municipalityCode),
    })),
  };

  const tree = buildPsgcTree(source);
  const count = indexBarangays(tree).size;
  if (count !== barangays.length) {
    throw new Error(`${barangays.length} barangays in, ${count} out: some codes repeat.`);
  }
  await writeFile(new URL('../src/data/psgc.json', import.meta.url), JSON.stringify(tree));
  console.log(
    `${tree.length} regions, ${provinces.length} provinces, ${cities.length} cities and municipalities, ${count} barangays`
  );
}

void main();
