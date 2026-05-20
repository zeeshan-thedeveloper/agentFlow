'use client';

import { Database } from 'lucide-react';
import type { FlowEdge, FlowNode } from './types';
import { getHandlesKey, HANDLE_COLORS, getHandleAnchor, getNodeHandles } from './handle-utils';

const HANDLE_TOOLTIPS: Record<string, string> = {
  'data-out': 'Data output — workflow payload',
  'data-in': 'Data input — prompt or prior node output',
  'query-out': 'SQL query output — connects to Database query input',
  'query-in': 'SQL query input — from Trigger or Agent',
  'agent-in': 'Agent SQL input — connect Agent data-out here',
  'schema-out': 'Schema link — connect to Schema node DB input',
  'schema-in': 'Schema context input — connect a Schema node to give this agent database context',
  'db-in': 'Database link — connect from Database Schema output',
  'trigger-in': 'Execution trigger input',
};

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
  const hasDbEdge = edges.some(e => e.to === node.id && e.targetHandle === 'db-in');
  const showHandleLabels = handlesKey === 'database' || node.type === 'schema';

  return (
    <>
      {handles.map(def => {
        const anchor = getHandleAnchor(node, def.id);
        const connected = edges.some(edge =>
          def.type === 'source'
            ? edge.from === node.id && (edge.sourceHandle ?? 'data-out') === def.id
            : edge.to === node.id && (edge.targetHandle ?? 'data-in') === def.id,
        );
        const color = HANDLE_COLORS[def.handleType];
        const isSchemaIn = def.id === 'schema-in';
        const isDbIn = def.id === 'db-in';
        const accentHandle = isSchemaIn || isDbIn;

        return (
          <div key={def.id}>
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
                left: anchor.x - node.x,
                top: anchor.y - node.y,
                transform: def.type === 'target' ? 'translate(-50%, -50%)' : 'translate(50%, -50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'var(--app-bg)',
                border: accentHandle && !connected ? `2px dashed ${color}` : `2px solid ${color}`,
                boxShadow: connected && accentHandle ? `0 0 8px ${color}` : `0 0 6px ${color}60`,
                opacity: accentHandle && !connected ? 0.55 : 1,
                cursor: 'crosshair',
                zIndex: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(isSchemaIn || isDbIn) && <Database size={8} color={color} strokeWidth={2} />}
            </div>
            {showHandleLabels && def.label && (
              <span
                style={{
                  position: 'absolute',
                  left: anchor.x - node.x + (def.type === 'target' ? -6 : 6),
                  top: anchor.y - node.y + 10,
                  transform: def.type === 'target' ? 'translateX(-50%)' : 'translateX(-50%)',
                  fontSize: 8,
                  fontWeight: 700,
                  color,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {def.label}
              </span>
            )}
          </div>
        );
      })}
      {node.type === 'schema' && hasDbEdge && (
        <span
          style={{
            position: 'absolute',
            left: 8,
            bottom: 6,
            fontSize: 8,
            fontWeight: 700,
            color: HANDLE_COLORS.schema,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          linked
        </span>
      )}
      {node.type === 'agent' && hasSchemaEdge && (
        <span
          style={{
            position: 'absolute',
            left: 8,
            bottom: 6,
            fontSize: 8,
            fontWeight: 700,
            color: HANDLE_COLORS.schema,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          schema
        </span>
      )}
    </>
  );
}
