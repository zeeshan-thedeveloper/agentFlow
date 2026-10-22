'use client';

import { Fragment, useState, type DragEvent } from 'react';
import { NODE_TYPES } from './constants';
import { isDatabaseNode } from './connections';
import { moveInOrder, orderViolation, stagesOf } from './runOrder';
import type { FlowEdge, FlowNode, RunMode, RunPhasesMap } from './types';

interface RunOrderBarProps {
  /** Nodes in the order they will run. */
  orderedNodes: FlowNode[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  runMode: RunMode;
  runPhases: RunPhasesMap;
  selected: string | null;
  onSelect: (id: string) => void;
  onReorder: (order: string[]) => void;
  disabled: boolean;
}

function colorOf(node: FlowNode): string {
  return isDatabaseNode(node) ? NODE_TYPES.database.color : NODE_TYPES[node.type]?.color ?? NODE_TYPES.agent.color;
}

export default function RunOrderBar({
  orderedNodes, nodes, edges, runMode, runPhases, selected, onSelect, onReorder, disabled,
}: RunOrderBarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // The gap the dragged node would land in: 0 is before the first node, length is after the last.
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  const order = orderedNodes.map(node => node.id);
  const sequential = runMode === 'sequential';
  const canDrag = sequential && !disabled && order.length > 1;
  const stages = stagesOf(orderedNodes, edges);

  const candidate =
    dragIndex !== null && dropSlot !== null
      ? moveInOrder(order, dragIndex, dropSlot > dragIndex ? dropSlot - 1 : dropSlot)
      : null;
  const violation = candidate ? orderViolation(candidate, nodes, edges) : null;
  const isNoop = dragIndex !== null && dropSlot !== null && (dropSlot === dragIndex || dropSlot === dragIndex + 1);

  function endDrag() {
    setDragIndex(null);
    setDropSlot(null);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>, index: number) {
    if (dragIndex === null) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropSlot(e.clientX < rect.left + rect.width / 2 ? index : index + 1);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    if (candidate && !violation && !isNoop) onReorder(candidate);
    endDrag();
  }

  const hint = violation
    ? violation
    : !sequential
    ? 'Nodes in the same stage run together. Switch to One at a time to set the order.'
    : canDrag
    ? 'Drag to change the order. Wires still decide what has to run first.'
    : null;

  const slotMarker = (slot: number) =>
    dragIndex !== null && dropSlot === slot && !isNoop ? (
      <div style={{
        width: 3, alignSelf: 'stretch', margin: '4px 0', borderRadius: 2, flexShrink: 0,
        background: violation ? '#ef4444' : 'var(--brand-text)',
      }} />
    ) : null;

  return (
    <div
      aria-label="Run order"
      onDragOver={e => { if (dragIndex !== null) e.preventDefault(); }}
      onDrop={onDrop}
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14,
        padding: '8px 16px', minHeight: 54,
        background: 'var(--panel-wash), var(--panel-bg)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ flexShrink: 0, width: 150 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          RUN ORDER
        </div>
        {hint && (
          <div style={{
            fontSize: 10, lineHeight: 1.35, marginTop: 2,
            color: violation ? '#ef4444' : 'var(--text-faint)',
          }}>
            {hint}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', padding: '2px 0' }}>
        {orderedNodes.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Add nodes to the canvas to see the order they run in.</span>
        )}

        {orderedNodes.map((node, index) => {
          const phase = runPhases[node.id];
          const color = colorOf(node);
          const stage = stages.get(node.id) ?? 0;
          const newStage = !sequential && (index === 0 || stages.get(orderedNodes[index - 1].id) !== stage);
          const isSelected = selected === node.id;
          const borderColor =
            phase === 'running' ? 'var(--brand-text)'
            : phase === 'done' ? 'rgba(34,197,94,0.6)'
            : phase === 'failed' ? 'rgba(239,68,68,0.7)'
            : isSelected ? color
            : 'var(--border-strong)';

          return (
            <Fragment key={node.id}>
              {index > 0 && !newStage && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: 'var(--text-faint)' }}>
                  <path d={sequential ? 'M2 6h8M7 3l3 3-3 3' : 'M6 2v8'} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {newStage && (
                <span style={{
                  flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                  color: 'var(--text-faint)', marginLeft: index > 0 ? 8 : 0,
                }}>
                  STAGE {stage + 1}
                </span>
              )}
              {slotMarker(index)}
              <div
                draggable={canDrag}
                onDragStart={e => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', node.id);
                  setDragIndex(index);
                }}
                onDragOver={e => onDragOver(e, index)}
                onDragEnd={endDrag}
                onClick={() => onSelect(node.id)}
                title={node.label}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 10px 5px 6px', borderRadius: 8,
                  border: `1px solid ${borderColor}`,
                  background: isSelected ? 'var(--hover-bg)' : 'var(--button-bg)',
                  cursor: canDrag ? 'grab' : 'pointer',
                  opacity: dragIndex === index ? 0.4 : 1,
                  userSelect: 'none', transition: 'border-color 0.15s, opacity 0.15s',
                  animation: phase === 'running' ? 'pulseGlow 1s infinite' : 'none',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  fontSize: 10, fontWeight: 700, color,
                  background: `color-mix(in srgb, ${color} 14%, transparent)`,
                }}>
                  {phase === 'done' ? '✓' : phase === 'failed' ? '!' : index + 1}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                  maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {node.label}
                </span>
              </div>
            </Fragment>
          );
        })}
        {slotMarker(orderedNodes.length)}
      </div>
    </div>
  );
}
