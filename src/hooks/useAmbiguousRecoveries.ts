import { useEffect, useState } from 'react';
import {
  AmbiguousRecoveryEntry,
  getAmbiguousRecoveries,
  subscribeAmbiguousRecoveries,
} from '../services/legacyRecovery';

export function useAmbiguousRecoveries(userId: string | null): AmbiguousRecoveryEntry[] {
  const [items, setItems] = useState<AmbiguousRecoveryEntry[]>(() => (userId ? getAmbiguousRecoveries(userId) : []));

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    setItems(getAmbiguousRecoveries(userId));
    return subscribeAmbiguousRecoveries(userId, () => setItems(getAmbiguousRecoveries(userId)));
  }, [userId]);

  return items;
}
