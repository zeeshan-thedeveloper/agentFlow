'use client';

import { Fragment, useState, type DragEvent } from 'react';
import { NODE_TYPES } from './constants';
import { isDatabaseNode } from './connections';
import { moveInPlan, planViolation, type PlanDrop } from './runOrder';
import type { FlowEdge, FlowNode, RunPhasesMap, RunPlan } from './types';

interface RunOrderBarProps {
  /** Steps in the order they run; nodes in one step run together. */
  plan: RunPlan;
  nodes: FlowNode[];
  edges: FlowEdge[];
  runPhases: RunPhasesMap;
  selected: string | null;
  onSelect: (id: string) => void;
  onChange: (plan: RunPlan) => void;
  disabled: boolean;
}

function colorOf(node: FlowNode): string {
  return isDatabaseNode(node) ? NODE_TYPES.database.color : NODE_TYPES[node.type]?.color ?? NODE_TYPES.agent.color;
}

const sameDrop = (a: PlanDrop | null, b: PlanDrop) =>
  a?.kind === b.kind && (a.kind === 'join' ? a.step === (b as typeof a).step : a.at === (b as typeof a).at);

export default function RunOrderBar({
  plan, nodes, edges, runPhases, selected, onSelect, onChange, disabled,
}: RunOrderBarProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<PlanDrop | null>(null);

  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const candidate = dragId && drop ? moveInPlan(plan, dragId, drop) : null;
  const unchanged = candidate !== null && JSON.stringify(candidate) === JSON.stringify(plan);
  const violation = candidate && !unchanged ? planViolation(candidate, nodes, edges) : null;

  function endDrag() {
    setDragId(null);
    setDrop(null);
  }

  function dragOver(e: DragEvent, target: PlanDrop) {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    if (!sameDrop(drop, target)) setDrop(target);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    if (candidate && !unchanged && !violation) onChange(candidate);
    endDrag();
  }

  const activeColor = violation ? '#ef4444' : 'var(--brand-text)';
  const hint = violation
    ?? (dragId
      ? 'Drop on a step to run alongside it, or between steps to run on its own.'
      : 'Steps run left to right. Nodes stacked in one step run at the same time. Drag to rearrange.');

  const gap = (at: number) => {
    const active = Boolean(dragId) && sameDrop(drop, { kind: 'insert', at }) && !unchanged;
    const edge = at === 0 || at === plan.length;
    return (
      <div
        onDragOver={e => dragOver(e, { kind: 'insert', at })}
        onDrop={onDrop}
        style={{
          flexShrink: 0, alignSelf: 'stretch', display: 'grid', placeItems: 'center',
          width: active ? 30 : edge ? (dragId ? 16 : 0) : 22,
          transition: 'width 0.12s',
        }}
      >
        {active ? (
          <div style={{ width: 3, height: '100%', minHeight: 30, borderRadius: 2, background: activeColor }} />
        ) : !edge ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-faint)' }}>
            <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
    );
  };

  return (
    <div
      aria-label="Run order"
      onDragOver={e => { if (dragId) e.preventDefault(); }}
      onDrop={onDrop}
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14,
        padding: '8px 16px', minHeight: 58,
        background: 'var(--panel-wash), var(--panel-bg)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ flexShrink: 0, width: 170 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          RUN ORDER
        </div>
        <div style={{ fontSize: 10, lineHeight: 1.35, marginTop: 2, color: violation ? '#ef4444' : 'var(--text-faint)' }}>
          {hint}
        </div>
      </div>

      <div style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
        overflowX: 'auto', padding: '2px 0', maxHeight: 180, overflowY: 'auto',
      }}>
        {plan.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Add nodes to the canvas to see the order they run in.</span>
        )}

        {plan.map((step, stepIndex) => {
          const joining = Boolean(dragId) && sameDrop(drop, { kind: 'join', step: stepIndex }) && !unchanged;
          return (
            <Fragment key={step.join('|')}>
              {gap(stepIndex)}
              <div
                onDragOver={e => dragOver(e, { kind: 'join', step: stepIndex })}
                onDrop={onDrop}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4,
                  padding: 4, borderRadius: 10,
                  border: `1px dashed ${joining ? activeColor : step.length > 1 ? 'var(--border-strong)' : 'transparent'}`,
                  background: joining ? 'var(--hover-bg)' : 'transparent',
                  transition: 'border-color 0.12s, background 0.12s',
                }}
              >
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)',
                  padding: '0 4px',
                }}>
                  STEP {stepIndex + 1}{step.length > 1 ? ' · TOGETHER' : ''}
                </div>
                {step.map(nodeId => {
                  const node = nodesById.get(nodeId);
                  if (!node) return null;
                  const phase = runPhases[nodeId];
                  const color = colorOf(node);
                  const isSelected = selected === nodeId;
                  const borderColor =
                    phase === 'running' ? 'var(--brand-text)'
                    : phase === 'done' ? 'rgba(34,197,94,0.6)'
                    : phase === 'failed' ? 'rgba(239,68,68,0.7)'
                    : isSelected ? color
                    : 'var(--border-strong)';

                  return (
                    <div
                      key={nodeId}
                      draggable={!disabled}
                      onDragStart={e => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', nodeId);
                        setDragId(nodeId);
                      }}
                      onDragEnd={endDrag}
                      onClick={() => onSelect(nodeId)}
                      title={node.label}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '5px 10px 5px 6px', borderRadius: 8,
                        border: `1px solid ${borderColor}`,
                        background: isSelected ? 'var(--hover-bg)' : 'var(--button-bg)',
                        cursor: disabled ? 'pointer' : 'grab',
                        opacity: dragId === nodeId ? 0.4 : 1,
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
                        {phase === 'done' ? '✓' : phase === 'failed' ? '!' : stepIndex + 1}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                        maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {node.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Fragment>
          );
        })}
        {plan.length > 0 && gap(plan.length)}
      </div>
    </div>
  );
}
