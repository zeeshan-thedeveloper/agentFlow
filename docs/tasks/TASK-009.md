# TASK-009 — Frontend: ConfigPanel Database Section

**Phase:** 1  
**Status:** Done  
**Depends on:** TASK-007, TASK-008  
**Blocks:** — (Phase 1 complete after this)

---

## Context

When the user selects an integration node on the canvas, the ConfigPanel on the right side should show:
1. **Integration picker** — dropdown to select which integration (database, slack, etc.)
2. **Credential status badge** — green dot (connected) or red dot (not connected) + "Connect" / "Disconnect" button
3. **Action picker** — dropdown of actions for the selected integration (e.g. "Run Query")
4. **Dynamic param form** — inputs driven by the selected action's `paramSchema`

For Phase 1, the only integration available is `database` with the `query` action. The UI must still be built generically (driven by `paramSchema`) so that adding Slack/GitHub later requires zero frontend changes.

Look at `apps/web/src/components/canvas/ConfigPanel.tsx` for the existing panel structure. The integration section should be added as a new conditional block when `selectedNode.type === 'integration'`.

---

## What To Do

### 1. Create a `useIntegrations` hook

Create `apps/web/src/hooks/useIntegrations.ts`:

```typescript
import { useEffect, useState } from 'react';
import { fetchIntegrations, fetchCredentialStatus } from '@/lib/integrations-api';

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
    fetchIntegrations()
      .then(setIntegrations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { integrations, loading };
}

export function useCredentialStatus(integrationId: string | undefined) {
  const [status, setStatus] = useState<CredentialStatus | null>(null);

  useEffect(() => {
    if (!integrationId) { setStatus(null); return; }
    fetchCredentialStatus(integrationId).then(setStatus).catch(console.error);
  }, [integrationId]);

  const refresh = () => {
    if (integrationId) fetchCredentialStatus(integrationId).then(setStatus).catch(console.error);
  };

  return { status, refresh };
}
```

### 2. Create the `IntegrationConfigSection` component

Create `apps/web/src/components/canvas/IntegrationConfigSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useIntegrations, useCredentialStatus } from '@/hooks/useIntegrations';
import { CredentialDialog } from './CredentialDialog';
import { deleteCredential } from '@/lib/integrations-api';
import type { FlowNode } from './types';

interface Props {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
}

export function IntegrationConfigSection({ node, onUpdate }: Props) {
  const { integrations, loading } = useIntegrations();
  const { status, refresh } = useCredentialStatus(node.integrationId);
  const [showDialog, setShowDialog] = useState(false);

  const selectedIntegration = integrations.find((i) => i.id === node.integrationId);
  const selectedAction = selectedIntegration?.actions.find((a) => a.id === node.actionId);

  async function handleDisconnect() {
    if (!node.integrationId) return;
    await deleteCredential(node.integrationId);
    refresh();
  }

  if (loading) return <div className="text-sm text-gray-400">Loading integrations...</div>;

  return (
    <div className="flex flex-col gap-4">
      {/* Section A — Integration picker */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase text-gray-500">Integration</label>
        <select
          className="w-full rounded border px-2 py-1.5 text-sm"
          value={node.integrationId ?? ''}
          onChange={(e) => onUpdate({ integrationId: e.target.value, actionId: undefined, actionParams: {} })}
        >
          <option value="">Select integration...</option>
          {integrations.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      {/* Credential status */}
      {node.integrationId && (
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${status?.connected ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-gray-600 flex-1">
            {status?.connected ? status.maskedHint ?? 'Connected' : 'Not connected'}
          </span>
          {status?.connected ? (
            <button onClick={handleDisconnect} className="text-xs text-red-500 hover:underline">
              Disconnect
            </button>
          ) : (
            <button onClick={() => setShowDialog(true)} className="text-xs text-blue-600 hover:underline">
              Connect
            </button>
          )}
        </div>
      )}

      {/* Section B — Action picker */}
      {selectedIntegration && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-gray-500">Action</label>
          <select
            className="w-full rounded border px-2 py-1.5 text-sm"
            value={node.actionId ?? ''}
            onChange={(e) => onUpdate({ actionId: e.target.value, actionParams: {} })}
          >
            <option value="">Select action...</option>
            {selectedIntegration.actions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Section C — Dynamic param form */}
      {selectedAction && (
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase text-gray-500">Parameters</label>
          {selectedAction.paramSchema.map((param) => (
            <div key={param.name} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                {param.label}
                {param.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {param.type === 'text' ? (
                <textarea
                  className="w-full rounded border px-2 py-1.5 text-xs font-mono"
                  rows={4}
                  placeholder={param.placeholder}
                  value={String(node.actionParams?.[param.name] ?? '')}
                  onChange={(e) =>
                    onUpdate({ actionParams: { ...node.actionParams, [param.name]: e.target.value } })
                  }
                />
              ) : param.type === 'number' ? (
                <input
                  type="number"
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  placeholder={param.placeholder}
                  value={String(node.actionParams?.[param.name] ?? '')}
                  onChange={(e) =>
                    onUpdate({ actionParams: { ...node.actionParams, [param.name]: e.target.value } })
                  }
                />
              ) : param.type === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={Boolean(node.actionParams?.[param.name])}
                  onChange={(e) =>
                    onUpdate({ actionParams: { ...node.actionParams, [param.name]: e.target.checked } })
                  }
                />
              ) : param.type === 'select' && param.options ? (
                <select
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  value={String(node.actionParams?.[param.name] ?? '')}
                  onChange={(e) =>
                    onUpdate({ actionParams: { ...node.actionParams, [param.name]: e.target.value } })
                  }
                >
                  <option value="">Select...</option>
                  {param.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={param.secret ? 'password' : 'text'}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  placeholder={param.placeholder}
                  value={String(node.actionParams?.[param.name] ?? '')}
                  onChange={(e) =>
                    onUpdate({ actionParams: { ...node.actionParams, [param.name]: e.target.value } })
                  }
                />
              )}

              {param.description && (
                <p className="text-xs text-gray-400">{param.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CredentialDialog modal */}
      {showDialog && node.integrationId && selectedIntegration && (
        <CredentialDialog
          integrationId={node.integrationId}
          integrationName={selectedIntegration.name}
          onConnected={() => { refresh(); setShowDialog(false); }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
```

### 3. Wire into `ConfigPanel.tsx`

Open `apps/web/src/components/canvas/ConfigPanel.tsx`. Find where it switches on `selectedNode.type` to render node-specific config. Add:

```tsx
import { IntegrationConfigSection } from './IntegrationConfigSection';

// Inside the panel, wherever agent/trigger/output sections are rendered:
{selectedNode.type === 'integration' && (
  <IntegrationConfigSection
    node={selectedNode}
    onUpdate={(patch) => updateNode(selectedNode.id, patch)}
  />
)}
```

Make sure `updateNode` (or equivalent) persists the patch back to the canvas state so `integrationId`, `actionId`, and `actionParams` are saved with the workflow.

---

## Acceptance Criteria

- [ ] Selecting an integration node on the canvas shows the integration picker dropdown
- [ ] Dropdown is populated from `GET /integrations` (live data, not hardcoded)
- [ ] Selecting "Database" shows the credential status badge
- [ ] If no credential stored: badge is red, "Connect" button is shown
- [ ] Clicking "Connect" opens `CredentialDialog`; after saving, badge turns green and shows masked hint
- [ ] "Disconnect" removes credential; badge turns red again
- [ ] After selecting an integration, the action picker appears
- [ ] Selecting "Run Query" shows the dynamic param form (SQL textarea, params input, limit input)
- [ ] Typing in the form fields updates `node.actionParams` (persisted when workflow is saved)
- [ ] TypeScript compiles with no errors
- [ ] No regressions in trigger/agent/output config panels
