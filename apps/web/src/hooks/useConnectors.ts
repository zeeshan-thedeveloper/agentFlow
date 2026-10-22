'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchConnectors, type ConnectorStatuses } from '@/lib/connectors-api';

// One shared copy, so connecting an app in one panel updates every node that uses it.
let cached: ConnectorStatuses | null = null;
const listeners = new Set<(statuses: ConnectorStatuses | null) => void>();

async function reload() {
  cached = await fetchConnectors();
  listeners.forEach(listener => listener(cached));
  return cached;
}

export function useConnectors() {
  const [statuses, setStatuses] = useState<ConnectorStatuses | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setStatuses);
    if (!cached) reload().catch(err => setError(err instanceof Error ? err.message : 'Could not load connections'));
    return () => {
      listeners.delete(setStatuses);
    };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load connections');
    }
  }, []);

  return { statuses, error, refresh };
}
