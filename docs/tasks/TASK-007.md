# TASK-007 — Frontend: Add `integration` Node Type to Canvas

**Phase:** 1  
**Status:** Done  
**Depends on:** —  
**Blocks:** TASK-008, TASK-009

---

## Context

The canvas currently supports `trigger`, `agent`, and `output` node types. Each type has:
- A definition in `apps/web/src/components/canvas/types.ts` (the `NodeType` union)
- A visual config in `apps/web/src/components/canvas/constants.tsx` (color, icon, label, library entry)
- A rendered card in `apps/web/src/components/canvas/CanvasNodeCard.tsx`

We need to add `'integration'` as a first-class node type. This ticket covers the type system and constants only — the ConfigPanel section for database config is TASK-009.

---

## What To Do

### 1. Extend `NodeType` in `types.ts`

Open `apps/web/src/components/canvas/types.ts`. Find the `NodeType` definition and add `'integration'`:

```typescript
// Before:
export type NodeType = 'trigger' | 'agent' | 'output';

// After:
export type NodeType = 'trigger' | 'agent' | 'output' | 'integration';
```

Also extend the `FlowNode` type with the new fields integration nodes use:

```typescript
export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  // ... existing fields ...

  // Integration node fields (only populated when type === 'integration')
  integrationId?: string;    // e.g. 'database', 'slack'
  actionId?: string;         // e.g. 'query', 'send_message'
  actionParams?: Record<string, unknown>;  // filled in by ConfigPanel form
}
```

### 2. Add the integration entry to `constants.tsx`

Open `apps/web/src/components/canvas/constants.tsx`. Find the `NODE_TYPES` map (or equivalent constant that defines label, color, icon, and node library description for each type).

Add an entry for `'integration'`:

```typescript
integration: {
  label: 'Integration',
  color: '#10B981',        // Emerald green — distinct from agent (blue) and output (purple)
  bgColor: '#ECFDF5',      // Light green background for the card
  icon: <PlugIcon />,      // Use an appropriate icon already in the project, e.g. from lucide-react
  lib: {
    desc: 'Connect to an external database or service',
    category: 'integrations',
  },
},
```

Check what icon library the project uses (likely `lucide-react` based on existing nodes). Pick an appropriate icon: `Database`, `Plug`, or `Link` from lucide-react all work. Use `Database` if the intent is to lead with the DB integration.

### 3. Update `CanvasNodeCard.tsx` if it hardcodes node types

Open `apps/web/src/components/canvas/CanvasNodeCard.tsx`. If it uses a `switch` or `if/else` on `node.type` to render different card content, add a case for `'integration'` that renders:

```tsx
case 'integration':
  return (
    <div className="text-sm text-gray-600">
      {node.integrationId
        ? `${node.integrationId} → ${node.actionId ?? 'no action'}`
        : 'Not configured'}
    </div>
  );
```

If the card is generic (just shows label + type color), no change needed.

### 4. Add to the node library / drag palette

Find where the draggable node library is built (likely `apps/web/src/components/canvas/NodeLibrary.tsx`). Add `'integration'` to the list of available node types users can drag onto the canvas.

### 5. Update `defaultWorkflow.ts` if needed

Open `apps/web/src/components/canvas/defaultWorkflow.ts`. This file likely defines example nodes. No change needed unless you want to add a sample integration node to the default canvas (not required for Phase 1).

---

## Acceptance Criteria

- [ ] `NodeType` union includes `'integration'`
- [ ] `FlowNode` has optional `integrationId`, `actionId`, `actionParams` fields
- [ ] `constants.tsx` has an entry for `'integration'` with label, color, and icon
- [ ] Dragging an "Integration" node from the library onto the canvas works — node appears with green color
- [ ] Selecting the integration node opens the ConfigPanel (even if the DB-specific form isn't there yet — TASK-009)
- [ ] TypeScript compiles with no errors (`cd apps/web && npx tsc --noEmit`)
- [ ] No existing node types (trigger, agent, output) are broken
