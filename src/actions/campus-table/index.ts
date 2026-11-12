'use server';

import { campusLogoUrl } from '@/lib/campus-logo';
import { logoProblem, removeCampusLogos, uploadCampusLogo } from '@/lib/campus-logo-storage';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { requireAdmin } from '@/lib/server-auth';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

/** Events, users, clusters and active population fields per campus. */
const CAMPUS_COUNTS = {
  _count: {
    select: {
      events: true,
      users: true,
      clusters: true,
      population_categories: { where: { is_active: true } },
    },
  },
} satisfies Prisma.campusInclude;

export async function getCampuses() {
  return prisma.campus.findMany({
    orderBy: { name: 'asc' },
  });
}

/** A few of a campus's newest events, enough to pick its latest one. */
const RECENT_EVENTS = {
  events: {
    orderBy: [{ started_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
    take: 5,
    select: {
      id: true,
      name: true,
      started_at: true,
      ended_at: true,
      status: { select: { name: true } },
      _count: { select: { reports: true } },
    },
  },
} satisfies Prisma.campusInclude;

type RecentEvent = Prisma.campusGetPayload<{ include: typeof RECENT_EVENTS }>['events'][number];

/** The event a campus card shows: an ongoing one, else the latest that started, else the newest. */
function latestEvent(events: RecentEvent[], now = Date.now()) {
  return (
    events.find((e) => e.status.name.toLowerCase() === 'ongoing') ??
    events.find((e) => e.started_at && e.started_at.getTime() <= now) ??
    events[0] ??
    null
  );
}

/**
 * The Campus page (and the dashboard's campus cards): every campus with what is linked to it
 * and its latest event, with that event's reports and people counted.
 */
export async function getCampusesOverview() {
  const campuses = await prisma.campus.findMany({
    include: { ...CAMPUS_COUNTS, ...RECENT_EVENTS },
    orderBy: { name: 'asc' },
  });
  const latest = campuses.map((c) => latestEvent(c.events));
  const people = await Promise.all(
    latest.map((e) =>
      e
        ? prisma.reportPopulationCount
            .aggregate({ _sum: { count: true }, where: { report: { event_id: e.id } } })
            .then((r) => r._sum.count ?? 0)
        : 0
    )
  );
  return campuses.map(({ events: _events, ...campus }, i) => ({
    ...campus,
    latestEvent: latest[i] && { ...latest[i], people: people[i] },
  }));
}

export type CampusOverview = Awaited<ReturnType<typeof getCampusesOverview>>[number];

/** The campus page: its counts, units included. */
export async function getCampusOverview(id: string) {
  const [campus, units] = await Promise.all([
    prisma.campus.findUnique({ where: { id }, include: CAMPUS_COUNTS }),
    prisma.unit.count({ where: { cluster: { campus_id: id } } }),
  ]);
  return campus && { ...campus, units };
}

/**
 * Every uploaded campus logo as a public URL, by campus id and by name. Reads the column on
 * its own, so before prisma/manual/DRRM-036-campus-logo.sql runs it returns none and the
 * bundled logos show.
 */
export async function getCampusLogos(): Promise<{
  byId: Record<string, string>;
  byName: Record<string, string>;
}> {
  try {
    const rows = await prisma.$queryRaw<{ id: string; name: string; logo_path: string }[]>`
      SELECT id::text AS id, name, logo_path FROM public.campus WHERE logo_path IS NOT NULL`;
    return {
      byId: Object.fromEntries(rows.map((r) => [r.id, campusLogoUrl(r.logo_path)])),
      byName: Object.fromEntries(rows.map((r) => [r.name, campusLogoUrl(r.logo_path)])),
    };
  } catch (err) {
    console.error('Campus logos could not be read', err);
    return { byId: {}, byName: {} };
  }
}

/**
 * Add / Edit campus: sets the uploaded logo (`logo` in the form, a PNG or WebP the browser
 * scaled to 512 × 512) or removes it (no file). The old file is deleted once the campus points
 * at the new one. Super admins only.
 */
export async function setCampusLogo(
  token: string | null,
  campusId: string,
  form: FormData | null
): Promise<{ ok: true; url: string | null } | { ok: false; error: string; retry: boolean }> {
  const caller = await requireAdmin(token);
  if (!caller.ok || caller.scope.role !== 'super_admin') {
    return { ok: false, error: 'Only super admins can change a campus logo.', retry: false };
  }
  const file = form?.get('logo');
  const logo = file instanceof File ? file : null;
  const problem = logo && logoProblem(logo);
  if (problem) return { ok: false, error: problem, retry: false };

  let before: string | null;
  try {
    const rows = await prisma.$queryRaw<{ logo_path: string | null }[]>`
      SELECT logo_path FROM public.campus WHERE id = ${campusId}::uuid`;
    if (!rows.length) return { ok: false, error: 'This campus no longer exists.', retry: false };
    before = rows[0].logo_path;
  } catch {
    return {
      ok: false,
      error: 'Logos need a database update first (DRRM-036). The campus was saved without it.',
      retry: false,
    };
  }

  let path: string | null = null;
  try {
    if (logo) path = await uploadCampusLogo(campusId, logo);
    await prisma.campus.update({ where: { id: campusId }, data: { logo_path: path } });
  } catch (err) {
    console.error('Campus logo save failed', err);
    await removeCampusLogos([path]);
    return { ok: false, error: 'The logo couldn’t be saved. Please try again.', retry: true };
  }
  await removeCampusLogos([before]);
  revalidatePath('/campus');
  revalidatePath('/campus/details');
  return { ok: true, url: path && campusLogoUrl(path) };
}

export async function createCampus(data: Prisma.campusCreateInput) {
  try {
    const campus = await prisma.campus.create({ data });
    revalidatePath('/campus');
    return campus;
  } catch (err) {
    throw toFriendlyError(err, 'campus');
  }
}

export async function updateCampus(id: string, data: Prisma.campusUpdateInput) {
  try {
    const campus = await prisma.campus.update({ where: { id }, data });
    revalidatePath('/campus');
    revalidatePath('/campus/details');
    return campus;
  } catch (err) {
    throw toFriendlyError(err, 'campus');
  }
}

export async function deleteCampus(id: string) {
  try {
    await prisma.campus.delete({ where: { id } });
    revalidatePath('/campus');
  } catch (err) {
    throw toFriendlyError(err, 'campus');
  }
}

export async function getCampusClusters(campusId: string) {
  return await prisma.cluster.findMany({
    where: { campus_id: campusId },
    select: { id: true, name: true, is_active: true },
    orderBy: { name: 'asc' },
  });
}
