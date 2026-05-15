# TASK-013 — Frontend: Named Connection Selector UI

**Phase:** 3  
**Status:** Done  
**Depends on:** TASK-012  
**Blocks:** —

---

## Context

With named connections supported by the backend (TASK-012), the frontend needs to let users:
1. See all saved database connections in a dropdown (instead of a single "connected/not connected" badge)
2. Add a new named connection with a custom label
3. Delete a specific named connection

This replaces the single credential badge from TASK-009's `IntegrationConfigSection` with a richer connection selector.

---

## What To Do

### 1. Update `integrations-api.ts`

Open `apps/web/src/lib/integrations-api.ts`. Add:

```typescript
export interface NamedConnection {
  integrationId: string;   // e.g. 'database:prod'
  name: string;            // e.g. 'Production DB'
  maskedHint: string | null;
  updatedAt: string;
}

export async function listDatabaseConnections(): Promise<NamedConnection[]> {
  const res = await fetch('/api/integrations/database/credentials');
  if (!res.ok) throw new Error('Failed to list database connections');
  return res.json();
}

export async function deleteNamedCredential(integrationId: string): Promise<void> {
  const res = await fetch(`/api/integrations/database/credentials/${encodeURIComponent(integrationId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete connection');
}
```

Also update `saveCredential` to optionally accept `name`:

```typescript
export async function saveCredential(
  integrationId: string,
  connectionString: string,
  name?: string,
) {
  const res = await fetch(`/api/integrations/${integrationId}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString, name }),
  });
  // ... rest unchanged
}
```

Add the new routes to the Next.js proxy at `apps/web/src/app/api/integrations/[...path]/route.ts` — the catch-all should already handle them if it forwards all methods.

### 2. Create `DatabaseConnectionSelector.tsx`

Create `apps/web/src/components/canvas/DatabaseConnectionSelector.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  listDatabaseConnections,
  deleteNamedCredential,
  type NamedConnection,
} from '@/lib/integrations-api';
import { CredentialDialog } from './CredentialDialog';

interface Props {
  selectedIntegrationId: string | undefined;  // e.g. 'database:prod'
  onSelect: (integrationId: string) => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function DatabaseConnectionSelector({ selectedIntegrationId, onSelect }: Props) {
  const [connections, setConnections] = useState<NamedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState('');

  const load = () => {
    setLoading(true);
    listDatabaseConnections()
      .then(setConnections)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function handleDelete(integrationId: string) {
    await deleteNamedCredential(integrationId);
    if (selectedIntegrationId === integrationId) onSelect('');
    load();
  }

  // The integrationId for a new named connection: 'database' if no name, 'database:<slug>' if named.
  const newIntegrationId = newName.trim()
    ? `database:${slugify(newName)}`
    : 'database';

  if (loading) return <div className="text-sm text-gray-400">Loading connections...</div>;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase text-gray-500">Database Connection</label>

      {connections.length === 0 ? (
        <p className="text-xs text-gray-400">No connections saved yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {connections.map((conn) => (
            <div
              key={conn.integrationId}
              className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer text-sm ${
                selectedIntegrationId === conn.integrationId
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelect(conn.integrationId)}
            >
              <span className="flex-1 font-medium">{conn.name}</span>
              <span className="text-xs text-gray-400 truncate max-w-[140px]">
                {conn.maskedHint ?? ''}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(conn.integrationId); }}
                className="text-xs text-red-400 hover:text-red-600 ml-1"
                title="Remove connection"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new connection */}
      <div className="flex flex-col gap-1 pt-1 border-t">
        <label className="text-xs text-gray-500">Add connection</label>
        <input
          type="text"
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Connection name (e.g. Production DB)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          onClick={() => setShowDialog(true)}
          className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
        >
          Connect…
        </button>
      </div>

      {showDialog && (
        <CredentialDialog
          integrationId={newIntegrationId}
          integrationName={newName.trim() ? `Database (${newName})` : 'Database'}
          onConnected={() => { load(); setShowDialog(false); setNewName(''); }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
```

### 3. Update `IntegrationConfigSection.tsx`

Open `apps/web/src/components/canvas/IntegrationConfigSection.tsx`. When `node.integrationId` starts with `'database'`, render `DatabaseConnectionSelector` instead of the simple credential badge:

```tsx
import { DatabaseConnectionSelector } from './DatabaseConnectionSelector';

// Inside the render, replace the credential status block:
{node.integrationId?.startsWith('database') ? (
  <DatabaseConnectionSelector
    selectedIntegrationId={node.integrationId}
    onSelect={(id) => onUpdate({ integrationId: id || undefined, actionId: undefined, actionParams: {} })}
  />
) : (
  // existing single-credential badge for non-database integrations
  <div className="flex items-center gap-2 text-sm">
    ...
  </div>
)}
```

### 4. Update Next.js proxy route

Ensure the catch-all proxy at `apps/web/src/app/api/integrations/[...path]/route.ts` supports the `DELETE` method with a path like `database/credentials/database%3Aprod`. The catch-all route should already handle this if it forwards all methods — verify it does.

---

## Acceptance Criteria

- [ ] When no connections are saved, the section shows "No connections saved yet" + an "Add connection" form
- [ ] Saving a connection with name "Production DB" creates `integrationId = 'database:production-db'` and shows in the list
- [ ] Clicking a connection in the list selects it (highlighted) and calls `onSelect` with the `integrationId`
- [ ] Clicking ✕ on a connection removes it; if it was selected, selection is cleared
- [ ] Multiple connections are listed simultaneously (prod, staging, dev)
- [ ] The CredentialDialog for a named connection passes `integrationId = 'database:<slug>'` and `name` to the API
- [ ] `node.integrationId` is saved correctly when the user picks a connection (workflow save persists it)
- [ ] TypeScript compiles with no errors
- [ ] No regressions in Phase 1 single-connection flow
