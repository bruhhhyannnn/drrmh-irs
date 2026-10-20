import type { BystanderReportFormData, ReportFormData } from '@/lib';
import type { AssessmentDraft } from '@/lib/assessment-draft';
import type { AssessmentPayload } from '@/lib/schemas';

// Client-side queue for reports submitted while offline. Server actions are RPC calls over
// the network, so they simply can't run without connectivity — the only way to let someone
// "submit" a report offline is to persist it locally and replay it once the network is back.
// IndexedDB (not localStorage) is used because entries carry nested missing-person/casualty
// arrays and photo Blobs, and there's no hard size ceiling to worry about.
//
// Three independent queues share one database: bystander reports (public, anonymous), field
// reports (logged-in ERT members via ReportForm) and building assessments. Kept separate because
// they replay through different server actions and invalidate different query keys. Two more
// stores hold what the assessment form needs offline: drafts in progress, and a cache of the
// checklist and form setup (see use-assessments.ts).

const DB_NAME = 'irs-offline-queue';
const DB_VERSION = 3;

const BYSTANDER_STORE = 'bystander-reports';
const FIELD_REPORT_STORE = 'reports';
const ASSESSMENT_STORE = 'assessments';
const ASSESSMENT_DRAFT_STORE = 'assessment-drafts';
const ASSESSMENT_CACHE_STORE = 'assessment-cache';

/** Every store and its key. Missing ones are created on upgrade, so older databases keep their data. */
const STORES: [name: string, keyPath: string][] = [
  [BYSTANDER_STORE, 'id'],
  [FIELD_REPORT_STORE, 'id'],
  [ASSESSMENT_STORE, 'id'],
  [ASSESSMENT_DRAFT_STORE, 'client_ref'],
  [ASSESSMENT_CACHE_STORE, 'key'],
];

/** What a "waiting to send" list shows for an entry, e.g. the event name and cluster. */
export interface QueuedSummary {
  title: string;
  subtitle?: string;
}

export interface QueuedEntry<TPayload> {
  id: string;
  createdAt: number;
  payload: TPayload;
  /** Files sent alongside the payload (bystander damage photos). Absent on older entries. */
  attachments?: Blob[];
  /** Display text for the entry. Absent on older entries. */
  summary?: QueuedSummary;
  status: 'pending' | 'failed';
  errorMessage?: string;
}

export type QueuedFieldReport = QueuedEntry<ReportFormData & { user_id?: string }>;
export type QueuedAssessment = QueuedEntry<AssessmentPayload>;

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
      for (const [store, keyPath] of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath });
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Lets a newer version of the app (another tab) upgrade the database instead of waiting.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeQueue<TPayload>(storeName: string) {
  async function add(
    payload: TPayload,
    attachments?: Blob[],
    summary?: QueuedSummary
  ): Promise<string> {
    const db = await openDb();
    const entry: QueuedEntry<TPayload> = {
      id: makeId(),
      createdAt: Date.now(),
      payload,
      ...(attachments?.length && { attachments }),
      ...(summary && { summary }),
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

/** Plain records by key: assessment drafts and the assessment cache. */
function makeKeyValueStore<TRecord>(storeName: string) {
  async function put(record: TRecord): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function get(key: string): Promise<TRecord | undefined> {
    if (!isSupported()) return undefined;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result as TRecord | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAll(): Promise<TRecord[]> {
    if (!isSupported()) return [];
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve((request.result as TRecord[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  async function remove(key: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return { put, get, getAll, remove };
}

const bystanderQueue = makeQueue<BystanderReportFormData>(BYSTANDER_STORE);
const fieldReportQueue = makeQueue<ReportFormData & { user_id?: string }>(FIELD_REPORT_STORE);
const assessmentQueue = makeQueue<AssessmentPayload>(ASSESSMENT_STORE);
const draftStore = makeKeyValueStore<AssessmentDraft>(ASSESSMENT_DRAFT_STORE);
const cacheStore = makeKeyValueStore<{ key: string; value: unknown; savedAt: number }>(
  ASSESSMENT_CACHE_STORE
);

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

export const queueAssessment = assessmentQueue.add;
export const getQueuedAssessments = assessmentQueue.getAll;
export const getQueuedAssessmentCount = assessmentQueue.count;
export const removeQueuedAssessment = assessmentQueue.remove;
export const markQueuedAssessmentFailed = assessmentQueue.markFailed;

/** Everything waiting to send on this phone: bystander reports, field reports and assessments. */
export async function getAllQueuedCount(): Promise<number> {
  const counts = await Promise.all([
    bystanderQueue.count(),
    fieldReportQueue.count(),
    assessmentQueue.count(),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}

export const saveAssessmentDraft = (draft: AssessmentDraft) => draftStore.put(draft);
export const getAssessmentDraft = (clientRef: string) => draftStore.get(clientRef);
export const getAssessmentDrafts = () => draftStore.getAll();
export const deleteAssessmentDraft = (clientRef: string) => draftStore.remove(clientRef);

export async function putAssessmentCache<T>(key: string, value: T): Promise<void> {
  await cacheStore.put({ key, value, savedAt: Date.now() });
}

export async function getAssessmentCache<T>(key: string): Promise<T | undefined> {
  return (await cacheStore.get(key))?.value as T | undefined;
}
