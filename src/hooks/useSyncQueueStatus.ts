import { useEffect, useState } from 'react';
import { getSummary, subscribe, SyncQueueSummary } from '../services/syncQueue';

export function useSyncQueueStatus(userId: string | null): SyncQueueSummary {
  const [summary, setSummary] = useState<SyncQueueSummary>(() => getSummary(userId));

  useEffect(() => {
    setSummary(getSummary(userId));
    if (!userId) return;
    const unsubscribe = subscribe(userId, () => setSummary(getSummary(userId)));
    return unsubscribe;
  }, [userId]);

  return summary;
}
