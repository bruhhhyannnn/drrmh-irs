'use server';

import { prisma } from '@/lib/prisma';

const statusKey = (name: string) => name.toLowerCase();

/**
 * Everything the dashboard shows, for one campus or all of them. The month window comes from
 * the browser so "this month" follows the admin's time zone, not the server's.
 */
export async function getDashboard(campusId: string | undefined, monthStart: Date, monthEnd: Date) {
  const campus = campusId ? { campus_id: campusId } : {};
  const reportScope = campusId ? { cluster: { campus_id: campusId } } : {};

  const [events, reportCount, userCount, pendingBystander, clusterGroups] = await Promise.all([
    prisma.event.findMany({
      where: campus,
      select: {
        id: true,
        name: true,
        campus_id: true,
        started_at: true,
        ended_at: true,
        campus: { select: { name: true } },
        status: { select: { name: true } },
      },
      orderBy: [{ started_at: { sort: 'asc', nulls: 'last' } }, { created_at: 'asc' }],
    }),
    prisma.report.count({ where: reportScope }),
    prisma.user.count({ where: campus }),
    prisma.bystander_reports.count({
      where: {
        ...(campusId && { clusters: { campus_id: campusId } }),
        OR: [{ status_id: null }, { bystander_report_statuses: { name: 'pending' } }],
      },
    }),
    prisma.report.groupBy({ by: ['cluster_id'], where: reportScope, _count: { _all: true } }),
  ]);

  const topClusters = clusterGroups.sort((a, b) => b._count._all - a._count._all).slice(0, 8);
  const clusterNames = await prisma.cluster.findMany({
    where: { id: { in: topClusters.map((c) => c.cluster_id) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(clusterNames.map((c) => [c.id, c.name]));

  const ongoing = events.filter((e) => statusKey(e.status.name) === 'ongoing');
  const [ongoingReports, activeClusters] = ongoing.length
    ? await Promise.all([
        prisma.report.findMany({
          where: { event_id: { in: ongoing.map((e) => e.id) } },
          select: {
            event_id: true,
            cluster_id: true,
            cluster: { select: { is_active: true, campus_id: true } },
            _count: { select: { casualties: true, missing_persons: true } },
          },
        }),
        prisma.cluster.groupBy({
          by: ['campus_id'],
          where: { is_active: true, campus_id: { in: ongoing.map((e) => e.campus_id) } },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const activeByCampus = new Map(activeClusters.map((c) => [c.campus_id, c._count._all]));

  const ongoingCards = ongoing
    .map((event) => {
      const reports = ongoingReports.filter((r) => r.event_id === event.id);
      const reportedClusters = new Set(
        reports
          .filter((r) => r.cluster.is_active && r.cluster.campus_id === event.campus_id)
          .map((r) => r.cluster_id)
      );
      return {
        id: event.id,
        name: event.name,
        campus: event.campus.name,
        startedAt: event.started_at,
        clustersReported: reportedClusters.size,
        clustersTotal: activeByCampus.get(event.campus_id) ?? 0,
        reports: reports.length,
        casualties: reports.reduce((sum, r) => sum + r._count.casualties, 0),
        missing: reports.reduce((sum, r) => sum + r._count.missing_persons, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.campus.localeCompare(b.campus));

  // The next upcoming event, grouped by name with every campus running it.
  const now = new Date();
  const upcoming = events.filter((e) => statusKey(e.status.name) === 'upcoming');
  const next =
    upcoming.find((e) => e.started_at && e.started_at >= now) ??
    upcoming.find((e) => e.started_at) ??
    upcoming[0];
  const nextEvent = next
    ? {
        id: next.id,
        name: next.name,
        startedAt: next.started_at,
        campuses: upcoming
          .filter(
            (e) =>
              e.name === next.name &&
              (e.started_at?.getTime() ?? 0) === (next.started_at?.getTime() ?? 0)
          )
          .map((e) => e.campus.name),
      }
    : null;

  const statusCounts = { ongoing: 0, upcoming: 0, completed: 0 };
  for (const e of events) {
    const key = statusKey(e.status.name) as keyof typeof statusCounts;
    if (key in statusCounts) statusCounts[key]++;
  }

  const month = events
    .filter((e) => e.started_at && e.started_at >= monthStart && e.started_at <= monthEnd)
    .map((e) => ({
      id: e.id,
      name: e.name,
      campus: e.campus.name,
      startedAt: e.started_at!,
      endedAt: e.ended_at,
      status: statusKey(e.status.name),
    }));

  return {
    counts: {
      events: events.length,
      reports: reportCount,
      users: userCount,
      pendingBystander,
      ...statusCounts,
    },
    ongoing: ongoingCards,
    nextEvent,
    clusters: topClusters.map((c) => ({
      id: c.cluster_id,
      name: nameById.get(c.cluster_id) ?? 'Unknown',
      reports: c._count._all,
    })),
    month,
  };
}
