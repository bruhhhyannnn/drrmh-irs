'use client';

import { getEvent } from '@/actions/events';
import type { getReportsByEvent } from '@/actions/reports';
import { getReportsByEvent as fetchReportsByEvent } from '@/actions/reports';
import { CLUSTERS } from '@/lib';
import {
  sumPopulationCountsByCategory,
  totalPopulationCount,
  uniquePopulationCategories,
} from '@/lib/utils';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';

type EventReport = Awaited<ReturnType<typeof getReportsByEvent>>[number];
type EventDetail = NonNullable<Awaited<ReturnType<typeof getEvent>>>;

function affectedOf(r: EventReport) {
  return totalPopulationCount(r.population_counts);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  });
}

// ─── Sheet 1: Summary ─────────────────────────────────────
function buildSummarySheet(wb: ExcelJS.Workbook, event: EventDetail, reports: EventReport[]) {
  const sheet = wb.addWorksheet('Summary');
  sheet.columns = [{ width: 28 }, { width: 40 }];

  const totalAffected = reports.reduce((s, r) => s + affectedOf(r), 0);
  const totalCasualties = reports.reduce((s, r) => s + r.casualties.length, 0);
  const totalMissing = reports.reduce((s, r) => s + r.missing_persons.length, 0);

  const rows: [string, string][] = [
    ['Event Name', event.name],
    ['Status', event.status.name],
    [
      'Started At',
      event.started_at ? format(new Date(event.started_at), 'MMM d, yyyy h:mm a') : '—',
    ],
    ['Ended At', event.ended_at ? format(new Date(event.ended_at), 'MMM d, yyyy h:mm a') : '—'],
    ['', ''],
    ['Reports Submitted', String(reports.length)],
    ['Total Affected', String(totalAffected)],
    ['Total Casualties', String(totalCasualties)],
    ['Total Missing Persons', String(totalMissing)],
  ];
  sheet.addRows(rows);
  sheet.getColumn(1).font = { bold: true };
}

// ─── Sheet 2: Cluster breakdown ───────────────────────────
function buildClusterBreakdownSheet(wb: ExcelJS.Workbook, reports: EventReport[]) {
  const sheet = wb.addWorksheet('By Cluster');

  const categories = uniquePopulationCategories(reports);
  const headers = ['Cluster', 'Reports', ...categories.map((c) => c.name), 'Total Affected'];
  sheet.addRow(headers);
  styleHeaderRow(sheet.getRow(1));

  CLUSTERS.forEach((cluster) => {
    const cr = reports.filter((r) => r.cluster.name === cluster);
    const totalsById = new Map(sumPopulationCountsByCategory(cr).map((t) => [t.id, t.total]));
    const totalAffected = categories.reduce((sum, c) => sum + (totalsById.get(c.id) ?? 0), 0);
    sheet.addRow([
      cluster,
      cr.length,
      ...categories.map((c) => totalsById.get(c.id) ?? 0),
      totalAffected,
    ]);
  });

  sheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 16 : 14;
  });
}

// ─── Sheet 3: Individual reports ──────────────────────────
function buildReportsSheet(wb: ExcelJS.Workbook, reports: EventReport[]) {
  const sheet = wb.addWorksheet('Reports');

  const categories = uniquePopulationCategories(reports);
  const headers = [
    'Submitted At',
    'Submitted By',
    'Position',
    'Cluster',
    'Unit',
    ...categories.map((c) => c.name),
    'Total Affected',
    'Casualties',
    'Missing',
    'Damage Condition',
  ];
  sheet.addRow(headers);
  styleHeaderRow(sheet.getRow(1));

  reports.forEach((r) => {
    const countsById = new Map(r.population_counts.map((pc) => [pc.category.id, pc.count]));
    sheet.addRow([
      r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy h:mm a') : '—',
      r.user ? `${r.user.first_name ?? ''} ${r.user.last_name ?? ''}`.trim() : '—',
      r.user?.position?.name ?? '—',
      r.cluster.name,
      r.unit?.name ?? '—',
      ...categories.map((c) => countsById.get(c.id) ?? 0),
      affectedOf(r),
      r.casualties.length,
      r.missing_persons.length,
      r.damage_conditions?.name ?? '—',
    ]);
  });

  sheet.columns.forEach((col, i) => {
    col.width = i === 0 || i === 1 ? 20 : 14;
  });
}

// ─── Sheet 4: Casualties ───────────────────────────────────
function buildCasualtiesSheet(wb: ExcelJS.Workbook, reports: EventReport[]) {
  const sheet = wb.addWorksheet('Casualties');
  sheet.addRow(['Name', 'Condition', 'Cluster', 'Unit', 'Submitted By']);
  styleHeaderRow(sheet.getRow(1));

  reports.forEach((r) => {
    const submittedBy = r.user
      ? `${r.user.first_name ?? ''} ${r.user.last_name ?? ''}`.trim()
      : '—';
    r.casualties.forEach((c) => {
      sheet.addRow([
        c.name || '—',
        c.condition.name,
        r.cluster.name,
        r.unit?.name ?? '—',
        submittedBy,
      ]);
    });
  });

  sheet.columns.forEach((col) => {
    col.width = 22;
  });
}

// ─── Sheet 5: Missing persons ──────────────────────────────
function buildMissingPersonsSheet(wb: ExcelJS.Workbook, reports: EventReport[]) {
  const sheet = wb.addWorksheet('Missing Persons');
  sheet.addRow(['Name', 'Cluster', 'Unit', 'Submitted By']);
  styleHeaderRow(sheet.getRow(1));

  reports.forEach((r) => {
    const submittedBy = r.user
      ? `${r.user.first_name ?? ''} ${r.user.last_name ?? ''}`.trim()
      : '—';
    r.missing_persons.forEach((p) => {
      sheet.addRow([p.name, r.cluster.name, r.unit?.name ?? '—', submittedBy]);
    });
  });

  sheet.columns.forEach((col) => {
    col.width = 22;
  });
}

// ─── Entry point ────────────────────────────────────────────
export async function exportEventToExcel(eventId: string): Promise<void> {
  const [event, reports] = await Promise.all([getEvent(eventId), fetchReportsByEvent(eventId)]);
  if (!event) throw new Error('Event not found');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'UPM DRRM IRS';
  wb.created = new Date();

  buildSummarySheet(wb, event, reports);
  buildClusterBreakdownSheet(wb, reports);
  buildReportsSheet(wb, reports);
  buildCasualtiesSheet(wb, reports);
  buildMissingPersonsSheet(wb, reports);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.name.replace(/[^a-z0-9]+/gi, '_')}_report.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
