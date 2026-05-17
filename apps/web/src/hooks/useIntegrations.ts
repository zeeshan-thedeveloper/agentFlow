'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchCredentialStatus, fetchIntegrations } from '@/lib/integrations-api';

export interface IntegrationMeta {
  id: string;
  name: string;
  description: string;
  authType: string;
  credentialLabel?: string;
  actions: {
    id: string;
    name: string;
    description: string;
    paramSchema: {
      name: string;
      label: string;
      type: string;
      required: boolean;
      placeholder?: string;
      description?: string;
      secret?: boolean;
      options?: { label: string; value: string }[];
    }[];
  }[];
}

export interface CredentialStatus {
  connected: boolean;
  maskedHint: string | null;
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchIntegrations()
      .then((data: IntegrationMeta[]) => {
        if (active) setIntegrations(data);
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { integrations, loading };
}

export function useCredentialStatus(integrationId: string | undefined) {
  const [status, setStatus] = useState<CredentialStatus | null>(null);

  const refresh = useCallback(() => {
    if (!integrationId) {
      setStatus(null);
      return;
    }

    fetchCredentialStatus(integrationId).then(setStatus).catch(console.error);
  }, [integrationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, refresh };
}
