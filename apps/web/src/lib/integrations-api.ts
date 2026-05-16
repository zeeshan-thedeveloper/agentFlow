export async function fetchIntegrations() {
  const res = await fetch('/api/integrations');
  if (!res.ok) throw new Error('Failed to load integrations');
  return res.json();
}

export async function fetchCredentialStatus(integrationId: string) {
  const res = await fetch(`/api/integrations/${integrationId}/credentials/status`);
  if (!res.ok) throw new Error('Failed to check credential status');
  return res.json() as Promise<{ connected: boolean; maskedHint: string | null }>;
}

export interface NamedConnection {
  integrationId: string;
  name: string;
  maskedHint: string | null;
  updatedAt: string;
}

export async function listDatabaseConnections(): Promise<NamedConnection[]> {
  const res = await fetch('/api/integrations/database/credentials');
  if (!res.ok) throw new Error('Failed to list database connections');
  return res.json();
}

export async function saveCredential(integrationId: string, connectionString: string, name?: string) {
  const res = await fetch(`/api/integrations/${integrationId}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString, name }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? 'Failed to save credential');
  }
  return res.json() as Promise<{ ok: boolean; maskedHint: string }>;
}

export async function deleteCredential(integrationId: string) {
  const res = await fetch(`/api/integrations/${integrationId}/credentials`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to disconnect');
  return res.json();
}

export async function deleteNamedCredential(integrationId: string): Promise<void> {
  const res = await fetch(`/api/integrations/database/credentials/${encodeURIComponent(integrationId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete connection');
}

export async function testDatabaseConnection(connectionString: string, engine?: 'postgresql' | 'mongodb') {
  const res = await fetch('/api/integrations/database/credentials/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString, engine }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; serverVersion?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? 'Connection failed');
  return data as { ok: boolean; serverVersion: string };
}
