import { isNetworkError, type QueuedEntry } from './offline-queue';

// Replays one offline queue. Used by OfflineQueueProvider for each of its queues; kept out of
// the component so the rules can be tested.

export interface FlushResult {
  synced: number;
  failed: number;
}

/** Replays every `pending` entry in one queue through `submit`, in order, stopping at the
 * first connectivity failure (leaves the rest queued for the next retry) but continuing past
 * a real server-side rejection (marked `failed` so it stops being retried forever). Entries
 * `shouldSend` turns down (another account's, on a shared phone) are left as they are.
 * `submit` also gets the entry, for when it was queued. */
export async function flushOne<TPayload>(
  getAll: () => Promise<QueuedEntry<TPayload>[]>,
  remove: (id: string) => Promise<void>,
  markFailed: (id: string, message: string) => Promise<void>,
  submit: (
    payload: TPayload,
    attachments: Blob[] | undefined,
    entry: QueuedEntry<TPayload>
  ) => Promise<unknown>,
  shouldSend: (entry: QueuedEntry<TPayload>) => boolean = () => true
): Promise<FlushResult> {
  const pending = (await getAll()).filter((e) => e.status === 'pending' && shouldSend(e));
  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await submit(entry.payload, entry.attachments, entry);
      await remove(entry.id);
      synced += 1;
    } catch (err) {
      if (isNetworkError(err)) break;
      await markFailed(entry.id, err instanceof Error ? err.message : 'Submission failed');
      failed += 1;
    }
  }

  return { synced, failed };
}
