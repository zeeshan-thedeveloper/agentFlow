'use client';

import { useState } from 'react';
import type { FlowNode, FlowEdge, RunState, RunPhasesMap, NodeType } from './types';
import { NODE_TYPES } from './constants';
import TopBar from './TopBar';
import NodeLibrary from './NodeLibrary';
import CanvasBoard from './CanvasBoard';
import ConfigPanel from './ConfigPanel';

const INITIAL_NODES: FlowNode[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    label: 'Start',
    subtitle: 'Manual · No input',
    x: 80,
    y: 240,
    triggerType: 'Manual',
    triggerInputMode: 'none',
  },
  {
    id: 'agent-1',
    type: 'agent',
    label: 'GitHub Agent',
    subtitle: 'Prompt only',
    x: 380,
    y: 240,
    prompt: '',
  },
  {
    id: 'output-1',
    type: 'output',
    label: 'Return Output',
    subtitle: 'Receives result',
    x: 680,
    y: 240,
    outputMode: 'Return output',
  },
];

const INITIAL_EDGES: FlowEdge[] = [
  { from: 'trigger-1', to: 'agent-1' },
  { from: 'agent-1', to: 'output-1' },
];

const RUN_SEQUENCE = ['trigger-1', 'agent-1', 'output-1'];

interface AgentFlowCanvasProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function AgentFlowCanvas({ user }: AgentFlowCanvasProps) {
  const [name, setName] = useState('GitHub Issue Monitor');
  const [saved, setSaved] = useState(false);
  const [runState, setRunState] = useState<RunState>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [runPhases, setRunPhases] = useState<RunPhasesMap>({});
  const [nodes, setNodes] = useState<FlowNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<FlowEdge[]>(INITIAL_EDGES);

  const selNode = nodes.find(n => n.id === selected) ?? null;

  function handleRun() {
    setRunState('running');
    setRunPhases({});

    RUN_SEQUENCE.forEach((id, i) => {
      setTimeout(() => setRunPhases(p => ({ ...p, [id]: 'running' })), i * 1400);
      setTimeout(() => setRunPhases(p => ({ ...p, [id]: 'done' })), i * 1400 + 1200);
    });

    const total = RUN_SEQUENCE.length * 1400;
    setTimeout(() => setRunState('success'), total + 400);
    setTimeout(() => {
      setRunState('idle');
      setRunPhases({});
    }, total + 3000);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function addNode(type: NodeType) {
    const id = `${type}-${Date.now()}`;
    const cfg = NODE_TYPES[type];
    const typeDefaults: Partial<FlowNode> =
      type === 'trigger'
        ? { triggerType: 'Manual', triggerInputMode: 'none', subtitle: 'Manual · No input' }
        : type === 'agent'
        ? { subtitle: 'Prompt only', prompt: '' }
        : type === 'output'
        ? { subtitle: 'Receives result', outputMode: 'Return output' }
        : {};

    setNodes(p => [...p, {
      id,
      type,
      label: `New ${cfg.label}`,
      subtitle: cfg.lib.options[0],
      x: 160 + Math.random() * 300,
      y: 140 + Math.random() * 220,
      ...typeDefaults,
    }]);
    setSelected(id);
  }

  function updateNode(id: string, patch: Partial<FlowNode>) {
    setNodes(p => p.map(n => n.id === id ? { ...n, ...patch } : n));
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--app-bg)' }}>
      <TopBar
        name={name}
        setName={setName}
        runState={runState}
        onRun={handleRun}
        saved={saved}
        onSave={handleSave}
        user={user}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <NodeLibrary onAddNode={addNode} />

        <CanvasBoard
          nodes={nodes}
          setNodes={setNodes}
          edges={edges}
          setEdges={setEdges}
          selected={selected}
          setSelected={setSelected}
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
