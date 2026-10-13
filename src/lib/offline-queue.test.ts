// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getQueuedFieldReportCount,
  getQueuedFieldReports,
  getQueuedReportCount,
  getQueuedReports,
  isNetworkError,
  markQueuedReportFailed,
  queueBystanderReport,
  queueFieldReport,
  removeQueuedReport,
} from './offline-queue';
import type { BystanderReportFormData, ReportFormData } from './schemas';

const bystanderReport = {
  incident_type_id: 'type-fire',
  cluster_id: 'cluster-taft',
  latitude: 14.5779,
  longitude: 120.9846,
  population_counts: [],
  report_missing_persons: [],
  report_casualties: [],
} as BystanderReportFormData;

const fieldReport = {
  event_id: 'event-drill',
  cluster_id: 'cluster-taft',
  population_counts: [],
  report_missing_persons: [],
  report_casualties: [],
} as ReportFormData;

beforeEach(() => {
  // A fresh, empty IndexedDB for every test.
  globalThis.indexedDB = new IDBFactory();
});

describe('offline queue', () => {
  it('keeps a queued report until it is removed', async () => {
    const id = await queueBystanderReport(bystanderReport, undefined, { title: 'Fire · Taft' });

    const [entry] = await getQueuedReports();
    expect(entry).toMatchObject({
      id,
      payload: bystanderReport,
      summary: { title: 'Fire · Taft' },
      status: 'pending',
    });
    expect(entry).not.toHaveProperty('attachments');
    expect(await getQueuedReportCount()).toBe(1);

    await removeQueuedReport(id);
    expect(await getQueuedReports()).toEqual([]);
  });

  it('stops counting a report the server rejected', async () => {
    const id = await queueBystanderReport(bystanderReport);
    await queueBystanderReport(bystanderReport);

    await markQueuedReportFailed(id, 'Incident type not found');

    const entries = await getQueuedReports();
    expect(entries.find((e) => e.id === id)).toMatchObject({
      status: 'failed',
      errorMessage: 'Incident type not found',
    });
    expect(await getQueuedReportCount()).toBe(1);
  });

  it('keeps field reports and bystander reports apart', async () => {
    await queueFieldReport({ ...fieldReport, user_id: 'user-1' });

    expect(await getQueuedFieldReportCount()).toBe(1);
    expect((await getQueuedFieldReports())[0].payload.user_id).toBe('user-1');
    expect(await getQueuedReportCount()).toBe(0);
  });
});

describe('isNetworkError', () => {
  it.each([
    new TypeError('Failed to fetch'),
    new TypeError('Load failed'),
    new Error('NetworkError when attempting to fetch resource.'),
    new Error('Connection closed.'),
  ])('queues on %s', (error) => {
    expect(isNetworkError(error)).toBe(true);
  });

  it.each([
    new Error('Unique constraint failed on the fields: (`event_id`,`user_id`)'),
    new Error('You already sent a report for this event.'),
    'Failed to fetch',
    null,
  ])('does not queue on %s', (error) => {
    expect(isNetworkError(error)).toBe(false);
  });
});
