import type { BystanderReportFormData, ReportFormData } from './schemas';

const STORAGE_KEY = 'irs-offline-report-queue-v1';
const QUEUE_CHANGED_EVENT = 'irs-offline-report-queue-changed';

export type OfflineReportQueueItem =
  | {
      id: string;
      kind: 'staff-report';
      payload: ReportFormData;
      createdAt: string;
      attempts: number;
      lastError?: string;
    }
  | {
      id: string;
      kind: 'bystander-report';
      payload: BystanderReportFormData;
      createdAt: string;
      attempts: number;
      lastError?: string;
    };

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOfflineReportQueue(): OfflineReportQueueItem[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineReportQueue(queue: OfflineReportQueueItem[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  emitQueueChanged();
}

export function enqueueOfflineReport(
  item:
    | { kind: 'staff-report'; payload: ReportFormData }
    | { kind: 'bystander-report'; payload: BystanderReportFormData }
) {
  const queue = getOfflineReportQueue();
  const queuedItem: OfflineReportQueueItem = {
    ...item,
    id: createId(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  saveOfflineReportQueue([...queue, queuedItem]);
  return queuedItem;
}

export function removeOfflineReport(id: string) {
  saveOfflineReportQueue(getOfflineReportQueue().filter((item) => item.id !== id));
}

export function markOfflineReportAttempt(id: string, error: string) {
  saveOfflineReportQueue(
    getOfflineReportQueue().map((item) =>
      item.id === id
        ? {
            ...item,
            attempts: item.attempts + 1,
            lastError: error,
          }
        : item
    )
  );
}

export function subscribeToOfflineReportQueue(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(QUEUE_CHANGED_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(QUEUE_CHANGED_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export function isProbablyOfflineError(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /fetch|failed|network|offline|load failed/i.test(message);
}
