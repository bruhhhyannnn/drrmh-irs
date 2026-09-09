import type { BystanderReportFormData, ReportFormData } from '@/lib';

// Client-side queue for reports submitted while offline. Server actions are RPC calls over
// the network, so they simply can't run without connectivity — the only way to let someone
// "submit" a report offline is to persist it locally and replay it once the network is back.
// IndexedDB (not localStorage) is used because entries carry nested missing-person/casualty
// arrays and there's no hard size ceiling to worry about.
//
// Two independent stores share one database: bystander reports (public, anonymous) and field
// reports (logged-in ERT members via ReportForm). Kept separate because they replay through
// different server actions and invalidate different query keys.

const DB_NAME = 'irs-offline-queue';
const DB_VERSION = 2;

const BYSTANDER_STORE = 'bystander-reports';
const FIELD_REPORT_STORE = 'reports';

export interface QueuedEntry<TPayload> {
  id: string;
  createdAt: number;
  payload: TPayload;
  status: 'pending' | 'failed';
  errorMessage?: string;
}

export type QueuedBystanderReport = QueuedEntry<BystanderReportFormData>;
export type QueuedFieldReport = QueuedEntry<ReportFormData & { user_id?: string }>;

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
      for (const store of [BYSTANDER_STORE, FIELD_REPORT_STORE]) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
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

function makeQueue<TPayload>(storeName: string) {
  async function add(payload: TPayload): Promise<string> {
    const db = await openDb();
    const entry: QueuedEntry<TPayload> = {
      id: makeId(),
      createdAt: Date.now(),
      payload,
      status: 'pending',
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).add(entry);
      tx.oncomplete = () => resolve(entry.id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll(): Promise<QueuedEntry<TPayload>[]> {
    if (!isSupported()) return [];
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve((request.result as QueuedEntry<TPayload>[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  // Counts only `pending` entries — a `failed` one (a real server-side rejection, not a
  // connectivity issue) is never auto-retried, so it shouldn't inflate the "waiting" badge.
  async function count(): Promise<number> {
    const entries = await getAll();
    return entries.filter((e) => e.status === 'pending').length;
  }

  async function remove(id: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function markFailed(id: string, errorMessage: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as QueuedEntry<TPayload> | undefined;
        if (record) store.put({ ...record, status: 'failed', errorMessage });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return { add, getAll, count, remove, markFailed };
}

const bystanderQueue = makeQueue<BystanderReportFormData>(BYSTANDER_STORE);
const fieldReportQueue = makeQueue<ReportFormData & { user_id?: string }>(FIELD_REPORT_STORE);

export const queueBystanderReport = bystanderQueue.add;
export const getQueuedReports = bystanderQueue.getAll;
export const getQueuedReportCount = bystanderQueue.count;
export const removeQueuedReport = bystanderQueue.remove;
export const markQueuedReportFailed = bystanderQueue.markFailed;

export const queueFieldReport = fieldReportQueue.add;
export const getQueuedFieldReports = fieldReportQueue.getAll;
export const getQueuedFieldReportCount = fieldReportQueue.count;
export const removeQueuedFieldReport = fieldReportQueue.remove;
export const markQueuedFieldReportFailed = fieldReportQueue.markFailed;
