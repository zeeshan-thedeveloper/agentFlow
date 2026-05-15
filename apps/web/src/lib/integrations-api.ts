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

export async function saveCredential(integrationId: string, connectionString: string) {
  const res = await fetch(`/api/integrations/${integrationId}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString }),
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

export async function testDatabaseConnection(connectionString: string) {
  const res = await fetch('/api/integrations/database/credentials/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; serverVersion?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? 'Connection failed');
  return data as { ok: boolean; serverVersion: string };
}
