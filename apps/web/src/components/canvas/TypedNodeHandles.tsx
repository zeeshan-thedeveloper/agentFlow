'use client';

import { Database } from 'lucide-react';
import type { FlowEdge, FlowNode } from './types';
import { HANDLE_COLORS, getHandleAnchor, getNodeHandles } from './handle-utils';

const HANDLE_TOOLTIPS: Record<string, string> = {
  'data-out': 'Data output — workflow payload',
  'data-in': 'Data input — prompt or prior node output',
  'query-out': 'SQL query output — connects to Database query input',
  'query-in': 'SQL query input — from Trigger or Agent',
  'schema-out': 'Schema context output — connects to Agent schema input',
  'schema-in': 'Schema context input — connect a Schema node to give this agent database context',
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
  const hasSchemaEdge = edges.some(e => e.to === node.id && e.targetHandle === 'schema-in');

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

        return (
          <div key={def.id}>
            <div
              title={HANDLE_TOOLTIPS[def.id] ?? def.id}
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
                border: isSchemaIn && !connected ? `2px dashed ${color}` : `2px solid ${color}`,
                boxShadow: connected && isSchemaIn ? `0 0 8px ${color}` : `0 0 6px ${color}60`,
                opacity: isSchemaIn && !connected ? 0.55 : 1,
                cursor: 'crosshair',
                zIndex: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSchemaIn && <Database size={8} color={color} strokeWidth={2} />}
            </div>
            {isSchemaIn && (
              <span
                style={{
                  position: 'absolute',
                  left: anchor.x - node.x - 6,
                  top: anchor.y - node.y + 10,
                  transform: 'translateX(-50%)',
                  fontSize: 8,
                  fontWeight: 700,
                  color,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                Schema
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
