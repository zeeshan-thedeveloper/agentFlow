# TASK-008 — Frontend: CredentialDialog Component

**Phase:** 1  
**Status:** Done  
**Depends on:** TASK-006, TASK-007  
**Blocks:** TASK-009

---

## Context

When a user selects a database integration on the canvas and it's not yet connected, a "Connect" button opens a dialog where they enter their connection string. The dialog also has a "Test Connection" button that validates before saving.

This is a self-contained modal component consumed by the ConfigPanel (TASK-009).

Look at `apps/web/src/components/canvas/OpenAISettingsDialog.tsx` for the existing dialog pattern in this project (structure, styling, API call pattern).

---

## What To Do

### 1. Create the API client functions

Create or extend `apps/web/src/lib/integrations-api.ts`:

```typescript
// Fetch all integration metadata (called once on ConfigPanel mount)
export async function fetchIntegrations() {
  const res = await fetch('/api/integrations');
  if (!res.ok) throw new Error('Failed to load integrations');
  return res.json();
}

// Check if a credential is stored for a given integration
export async function fetchCredentialStatus(integrationId: string) {
  const res = await fetch(`/api/integrations/${integrationId}/credentials/status`);
  if (!res.ok) throw new Error('Failed to check credential status');
  return res.json() as Promise<{ connected: boolean; maskedHint: string | null }>;
}

// Save a credential
export async function saveCredential(integrationId: string, connectionString: string) {
  const res = await fetch(`/api/integrations/${integrationId}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Failed to save credential');
  }
  return res.json() as Promise<{ ok: boolean; maskedHint: string }>;
}

// Delete a credential
export async function deleteCredential(integrationId: string) {
  const res = await fetch(`/api/integrations/${integrationId}/credentials`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to disconnect');
  return res.json();
}

// Test a connection string (does not save)
export async function testDatabaseConnection(connectionString: string) {
  const res = await fetch('/api/integrations/database/credentials/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Connection failed');
  return data as { ok: boolean; serverVersion: string };
}
```

> **Note:** These call `/api/integrations/...` — Next.js API routes that proxy to the NestJS backend. Create a minimal proxy route at `apps/web/src/app/api/integrations/[...path]/route.ts` that forwards to `http://localhost:3001` (or the API base URL from env). Check how existing Next.js API routes proxy to NestJS in this project (e.g., `apps/web/src/app/api/workflows/current/route.ts`).

### 2. Create `CredentialDialog.tsx`

Create `apps/web/src/components/canvas/CredentialDialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { saveCredential, testDatabaseConnection } from '@/lib/integrations-api';

interface Props {
  integrationId: string;        // e.g. 'database'
  integrationName: string;      // e.g. 'Database'
  onConnected: (maskedHint: string) => void;
  onClose: () => void;
}

export function CredentialDialog({ integrationId, integrationName, onConnected, onClose }: Props) {
  const [connectionString, setConnectionString] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await testDatabaseConnection(connectionString);
      setTestResult({ ok: true, message: `Connected. Server: ${result.serverVersion.split(' ').slice(0, 2).join(' ')}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setTestResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await saveCredential(integrationId, connectionString);
      onConnected(result.maskedHint);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    // Use the same modal/dialog wrapper as OpenAISettingsDialog — check that file for the exact JSX structure.
    // Below is the inner content:
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Connect {integrationName}</h2>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Connection String</label>
        <input
          type="password"
          className="w-full rounded border px-3 py-2 text-sm font-mono"
          placeholder="postgresql://user:password@host:5432/dbname"
          value={connectionString}
          onChange={(e) => {
            setConnectionString(e.target.value);
            setTestResult(null);
          }}
        />
        <p className="text-xs text-gray-500">
          Add <code>?sslmode=require</code> for SSL. The connection string is encrypted before storage.
        </p>
      </div>

      {testResult && (
        <p className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
          {testResult.ok ? '✓' : '✗'} {testResult.message}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between gap-2">
        <button
          onClick={handleTest}
          disabled={!connectionString || testing}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>

        <div className="flex gap-2">
          <button onClick={onClose} className="rounded border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!connectionString || saving}
            className="rounded bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Wrap the inner content in whatever modal shell the project uses. Look at `OpenAISettingsDialog.tsx` — it likely uses a `Dialog` component from shadcn/ui or a custom modal. Use the same.

### 3. Create the Next.js proxy route for integrations

Check `apps/web/src/app/api/workflows/current/route.ts` to understand how it proxies to NestJS. Create a similar catch-all at:

`apps/web/src/app/api/integrations/[...path]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function proxy(req: NextRequest, path: string[]) {
  const url = `${API_BASE}/integrations/${path.join('/')}`;
  const body = req.method !== 'GET' && req.method !== 'DELETE'
    ? await req.text()
    : undefined;

  const upstream = await fetch(url, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      // Forward session cookie or auth header — check existing proxy routes for pattern
      cookie: req.headers.get('cookie') ?? '',
    },
    body,
  });

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
```

---

## Acceptance Criteria

- [ ] `CredentialDialog` renders as a modal with a password input and two buttons (Test, Save)
- [ ] "Test Connection" calls the test endpoint and shows success/failure message inline without closing the dialog
- [ ] "Save" calls the save endpoint and calls `onConnected(maskedHint)` on success, then closes
- [ ] Invalid or empty connection string disables both buttons
- [ ] API errors are displayed inline (not just console)
- [ ] Next.js proxy route at `/api/integrations/[...path]` forwards to NestJS correctly
- [ ] TypeScript compiles with no errors
