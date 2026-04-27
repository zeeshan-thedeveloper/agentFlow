'use client';

import { useState } from 'react';
import type { FlowNode, FlowEdge, RunState, RunPhasesMap, NodeType } from './types';
import { NODE_TYPES } from './constants';
import TopBar      from './TopBar';
import NodeLibrary from './NodeLibrary';
import CanvasBoard from './CanvasBoard';
import ConfigPanel from './ConfigPanel';

// ─── Initial data (mirrors the design) ────────────────────────────────────────

const INITIAL_NODES: FlowNode[] = [
  { id: 'trigger-1', type: 'trigger', label: 'Every 6 Hours',   subtitle: 'Cron · Scheduled',  x: 80,  y: 240, triggerType: 'Cron Schedule' },
  { id: 'agent-1',   type: 'agent',   label: 'GitHub Agent',    subtitle: 'claude-3-7-sonnet',  x: 380, y: 240, model: 'claude', temp: 0.7 },
  { id: 'skill-1',   type: 'skill',   label: 'Code Review',     subtitle: 'Skill · Analysis',   x: 680, y: 240, skillType: 'Code Review' },
  { id: 'output-1',  type: 'output',  label: 'Slack Notify',    subtitle: '#dev-alerts',         x: 980, y: 240, destination: 'Slack' },
];

const INITIAL_EDGES: FlowEdge[] = [
  { from: 'trigger-1', to: 'agent-1' },
  { from: 'agent-1',   to: 'skill-1' },
  { from: 'skill-1',   to: 'output-1' },
];

// ─── Run sequence ─────────────────────────────────────────────────────────────

const RUN_SEQUENCE = ['trigger-1', 'agent-1', 'skill-1', 'output-1'];

interface AgentFlowCanvasProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentFlowCanvas({ user }: AgentFlowCanvasProps) {
  const [name, setName]         = useState('GitHub Issue Monitor');
  const [saved, setSaved]       = useState(false);
  const [runState, setRunState] = useState<RunState>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [runPhases, setRunPhases] = useState<RunPhasesMap>({});
  const [nodes, setNodes]       = useState<FlowNode[]>(INITIAL_NODES);
  const [edges, setEdges]       = useState<FlowEdge[]>(INITIAL_EDGES);

  const selNode = nodes.find(n => n.id === selected) ?? null;

  // ── Run animation ───────────────────────────────────────────────────────────
  function handleRun() {
    setRunState('running');
    setRunPhases({});

    RUN_SEQUENCE.forEach((id, i) => {
      setTimeout(() => setRunPhases(p => ({ ...p, [id]: 'running' })), i * 1400);
      setTimeout(() => setRunPhases(p => ({ ...p, [id]: 'done'    })), i * 1400 + 1200);
    });

    const total = RUN_SEQUENCE.length * 1400;
    setTimeout(() => setRunState('success'), total + 400);
    setTimeout(() => { setRunState('idle'); setRunPhases({}); }, total + 3000);
  }

  // ── Save feedback ───────────────────────────────────────────────────────────
  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ── Add node from library ───────────────────────────────────────────────────
  function addNode(type: NodeType) {
    const id  = `${type}-${Date.now()}`;
    const cfg = NODE_TYPES[type];
    setNodes(p => [...p, {
      id, type,
      label:    `New ${cfg.label}`,
      subtitle:  cfg.lib.options[0],
      x: 160 + Math.random() * 300,
      y: 140 + Math.random() * 220,
    }]);
    setSelected(id);
  }

  // ── Patch a node's config ───────────────────────────────────────────────────
  function updateNode(id: string, patch: Partial<FlowNode>) {
    setNodes(p => p.map(n => n.id === id ? { ...n, ...patch } : n));
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--app-bg)' }}>
      <TopBar
        name={name} setName={setName}
        runState={runState} onRun={handleRun}
        saved={saved} onSave={handleSave}
        user={user}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <NodeLibrary onAddNode={addNode} />

        <CanvasBoard
          nodes={nodes} setNodes={setNodes}
          edges={edges} setEdges={setEdges}
          selected={selected} setSelected={setSelected}
          runPhases={runPhases}
        />

        {selNode && (
          <ConfigPanel
            node={selNode}
            onClose={() => setSelected(null)}
            onUpdate={patch => updateNode(selNode.id, patch)}
            onRun={handleRun}
          />
        )}
      </div>
    </div>
  );
}
