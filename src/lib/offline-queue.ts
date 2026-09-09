import type { BystanderReportFormData } from '@/lib';

// Client-side queue for bystander reports submitted while offline. Server actions are RPC
// calls over the network, so they simply can't run without connectivity — the only way to
// let someone "submit" a report offline is to persist it locally and replay it once the
// network is back. IndexedDB (not localStorage) is used because entries can carry nested
// missing-person/casualty arrays and there's no hard size ceiling to worry about.

const DB_NAME = 'irs-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'bystander-reports';

export interface QueuedBystanderReport {
  id: string;
  createdAt: number;
  payload: BystanderReportFormData;
  status: 'pending' | 'failed';
  errorMessage?: string;
}

function isSupported() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

/** True for connectivity-shaped failures (fetch couldn't reach the server at all) as
 * opposed to a real server-side error (validation, constraint violation, etc.) — only the
 * former should be queued for retry, since retrying the latter would just fail again. */
export function isNetworkError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'TypeError' ||
    /fetch|network|connection/i.test(err.message) ||
    err.message.includes('Failed to fetch')
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function queueBystanderReport(payload: BystanderReportFormData): Promise<string> {
  const db = await openDb();
  const entry: QueuedBystanderReport = {
    id: makeId(),
    createdAt: Date.now(),
    payload,
    status: 'pending',
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve(entry.id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedReports(): Promise<QueuedBystanderReport[]> {
  if (!isSupported()) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as QueuedBystanderReport[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

// Counts only `pending` entries — a `failed` one (a real server-side rejection, not a
// connectivity issue) is never auto-retried, so it shouldn't inflate the "waiting to sync" badge.
export async function getQueuedReportCount(): Promise<number> {
  const reports = await getQueuedReports();
  return reports.filter((r) => r.status === 'pending').length;
}

export async function removeQueuedReport(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markQueuedReportFailed(id: string, errorMessage: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as QueuedBystanderReport | undefined;
      if (record) store.put({ ...record, status: 'failed', errorMessage });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
