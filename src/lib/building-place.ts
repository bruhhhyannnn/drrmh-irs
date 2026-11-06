import type { Prisma } from '@prisma/client';
import type { Named } from './assessment-template';
import type { BuildingLocation } from './psgc';

// Where a building belongs (DRRM-025). A Campus building has a unit, and its campus comes through
// unit → cluster → campus. An Off-campus building has no unit: it has a PSGC location, and the
// campus of the evaluator who added it. The campus decides who may see a building; only a Campus
// building ever counts toward a campus score.

export type BuildingCategory = 'campus' | 'off_campus';

export interface BuildingPlace {
  category: BuildingCategory;
  campus: Named;
  cluster: Named | null;
  unit: Named | null;
  location: BuildingLocation | null;
  /** The unit, or "<barangay>, <city>". */
  label: string;
}

/** What toBuildingPlace reads. Spread it into a Building select. */
export const buildingPlaceSelect = {
  unit: {
    select: {
      id: true,
      name: true,
      cluster: { select: { id: true, name: true, campus: { select: { id: true, name: true } } } },
    },
  },
  campus: { select: { id: true, name: true } },
  region_code: true,
  region_name: true,
  province_code: true,
  province_name: true,
  city_code: true,
  city_name: true,
  barangay_code: true,
  barangay_name: true,
} satisfies Prisma.BuildingSelect;

type PlaceRow = Prisma.BuildingGetPayload<{ select: typeof buildingPlaceSelect }>;

const codeName = (code: string | null, name: string | null) =>
  code !== null && name !== null ? { code, name } : null;

function locationOf(row: PlaceRow): BuildingLocation {
  const region = codeName(row.region_code, row.region_name);
  const city = codeName(row.city_code, row.city_name);
  const barangay = codeName(row.barangay_code, row.barangay_name);
  if (!region || !city || !barangay) throw new Error('This building has an incomplete location.');
  return { region, province: codeName(row.province_code, row.province_name), city, barangay };
}

export function toBuildingPlace(row: PlaceRow): BuildingPlace {
  if (row.unit) {
    const { cluster } = row.unit;
    return {
      category: 'campus',
      campus: cluster.campus,
      cluster: { id: cluster.id, name: cluster.name },
      unit: { id: row.unit.id, name: row.unit.name },
      location: null,
      label: row.unit.name,
    };
  }
  if (!row.campus) throw new Error('This building has neither a unit nor a campus.');
  const location = locationOf(row);
  return {
    category: 'off_campus',
    campus: row.campus,
    cluster: null,
    unit: null,
    location,
    label: `${location.barangay.name}, ${location.city.name}`,
  };
}

/** Campus buildings only. Every campus score reads through this. null: all campuses. */
export function campusBuildings(campusId: string | null): Prisma.BuildingWhereInput {
  return {
    unit_id: { not: null },
    ...(campusId && { unit: { cluster: { campus_id: campusId } } }),
  };
}

/** Off-campus buildings owned by a campus. null: every campus's. */
export function offCampusBuildings(campusId: string | null): Prisma.BuildingWhereInput {
  return { unit_id: null, ...(campusId && { campus_id: campusId }) };
}

/** Both categories: who may see a building. null: every campus's. */
export function buildingInCampus(campusId: string | null): Prisma.BuildingWhereInput {
  if (!campusId) return {};
  return { OR: [{ unit: { cluster: { campus_id: campusId } } }, { campus_id: campusId }] };
}

/** One line under a building's name. */
export function placeLine(place: Pick<BuildingPlace, 'label' | 'cluster'>): string {
  return place.cluster ? `${place.label} · ${place.cluster.name}` : place.label;
}

/** The label and value rows for a submitted assessment's view and print. */
export function placeDetailRows(record: {
  location?: BuildingLocation | null;
  unit_name: string | null;
  cluster_name: string | null;
}): [string, string][] {
  const { location } = record;
  if (!location) {
    return [
      ['College or unit', record.unit_name ?? '—'],
      ['Cluster', record.cluster_name ?? '—'],
    ];
  }
  return [
    ['Region', location.region.name],
    ...(location.province ? [['Province', location.province.name] as [string, string]] : []),
    ['City or municipality', location.city.name],
    ['Barangay', location.barangay.name],
  ];
}
