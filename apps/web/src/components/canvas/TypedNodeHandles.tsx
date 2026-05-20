'use client';

import { Database } from 'lucide-react';
import type { FlowEdge, FlowNode, HandleDef } from './types';
import { getHandleAnchor, getHandleColor, getHandlesKey, getNodeHandles, HANDLE_COLORS } from './handle-utils';

const HANDLE_TOOLTIPS: Record<string, string> = {
  'data-out': 'Data output — workflow payload',
  'data-in': 'Data input — prompt or prior node output',
  'query-out': 'SQL query output — connects to Query Runner SQL input',
  'query-in': 'SQL query input — from Trigger or Agent',
  'agent-in': 'Agent SQL input — connect Agent data-out here',
  'read-out': 'Database read connection — wire to Schema or Query Runner DB input',
  'write-out': 'Database write connection — wire to Query Runner DB input',
  'schema-in': 'Schema context input — connect a Schema node to give this agent database context',
  'db-in': 'Database connection — connect from Database Read or Write output',
  'trigger-in': 'Execution trigger input',
  'trigger-out': 'Execution signal — connect to trigger-in on Schema or downstream nodes',
};

function isLeftSideHandle(def: HandleDef): boolean {
  return def.position === 'left' || def.position === 'left-top' || def.position === 'left-bottom';
}

function handleLabelPosition(def: HandleDef, relX: number, relY: number) {
  const gap = 12;
  if (def.type === 'target' || (def.type === 'source' && isLeftSideHandle(def))) {
    return { left: relX - gap, top: relY, transform: 'translate(-100%, -50%)' };
  }
  return { left: relX + gap, top: relY, transform: 'translate(0, -50%)' };
}

function handleTransform(def: HandleDef): string {
  if (def.type === 'target' || (def.type === 'source' && isLeftSideHandle(def))) {
    return 'translate(-50%, -50%)';
  }
  return 'translate(50%, -50%)';
}

interface TypedNodeHandlesProps {
  node: FlowNode;
  edges: FlowEdge[];
  onStartConnection: (e: React.MouseEvent, handleId: string) => void;
  onFinishConnection: (e: React.MouseEvent, handleId: string) => void;
  onTargetHandleHover?: (handleId: string | null) => void;
}

export default function TypedNodeHandles({
  node,
  edges,
  onStartConnection,
  onFinishConnection,
  onTargetHandleHover,
}: TypedNodeHandlesProps) {
  const handles = getNodeHandles(node);
  const handlesKey = getHandlesKey(node);
  const hasSchemaEdge = edges.some(e => e.to === node.id && e.targetHandle === 'schema-in');
  const showHandleLabels =
    handlesKey === 'database' ||
    handlesKey === 'query-runner' ||
    handlesKey === 'trigger' ||
    node.type === 'schema' ||
    node.type === 'agent';

  return (
    <>
      {handles.map(def => {
        const anchor = getHandleAnchor(node, def.id);
        const relX = anchor.x - node.x;
        const relY = anchor.y - node.y;
        const connected = edges.some(edge =>
          def.type === 'source'
            ? edge.from === node.id && (edge.sourceHandle ?? 'data-out') === def.id
            : edge.to === node.id && (edge.targetHandle ?? 'data-in') === def.id,
        );
        const color = getHandleColor(def.id, def.handleType);
        const isSchemaIn = def.id === 'schema-in';
        const isDbIn = def.id === 'db-in';
        const accentHandle = isSchemaIn || isDbIn;
        const labelPos = handleLabelPosition(def, relX, relY);

        return (
          <div key={def.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
              title={HANDLE_TOOLTIPS[def.id] ?? def.label ?? def.id}
              onMouseDown={e => {
                e.stopPropagation();
                if (def.type === 'source') onStartConnection(e, def.id);
              }}
              onMouseEnter={() => {
                if (def.type === 'target') onTargetHandleHover?.(def.id);
              }}
              onMouseLeave={() => {
                if (def.type === 'target') onTargetHandleHover?.(null);
              }}
              onMouseUp={e => {
                e.stopPropagation();
                if (def.type === 'target') onFinishConnection(e, def.id);
              }}
              style={{
                position: 'absolute',
                left: relX,
                top: relY,
                transform: handleTransform(def),
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'var(--panel-bg-strong)',
                border: accentHandle && !connected ? `2px dashed ${color}` : `2.5px solid ${color}`,
                boxShadow: connected && accentHandle
                  ? `0 0 10px ${color}90`
                  : `0 0 0 1px var(--app-bg), 0 0 8px ${color}50`,
                opacity: accentHandle && !connected ? 0.7 : 1,
                cursor: 'crosshair',
                zIndex: 5,
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(isSchemaIn || isDbIn) && <Database size={9} color={color} strokeWidth={2.2} />}
            </div>
            {def.label && (
              <span
                style={{
                  position: 'absolute',
                  ...labelPos,
                  pointerEvents: 'none',
                  zIndex: 5,
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  color,
                  padding: '3px 7px',
                  borderRadius: 5,
                  background: 'var(--panel-bg-strong)',
                  border: `1px solid ${color}66`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.14), 0 0 0 1px var(--app-bg)',
                }}
              >
                {def.label}
              </span>
            )}
          </div>
        );
      })}
      {node.type === 'agent' && hasSchemaEdge && (
        <span
          style={{
            position: 'absolute',
            left: 8,
            bottom: 6,
            fontSize: 9,
            fontWeight: 700,
            color: HANDLE_COLORS.schema,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--panel-bg-strong)',
            border: `1px solid ${HANDLE_COLORS.schema}55`,
          }}
        >
          schema
        </span>
      )}
    </>
  );
}
