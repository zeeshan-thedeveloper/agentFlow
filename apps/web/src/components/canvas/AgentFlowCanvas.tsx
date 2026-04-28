'use client';

import { useEffect, useState } from 'react';
import type { FlowNode, FlowEdge, RunState, RunPhasesMap, NodeType, PersistedWorkflow } from './types';
import { NODE_TYPES } from './constants';
import TopBar from './TopBar';
import NodeLibrary from './NodeLibrary';
import CanvasBoard from './CanvasBoard';
import ConfigPanel from './ConfigPanel';
import { DEFAULT_EDGES, DEFAULT_NODES, DEFAULT_WORKFLOW_NAME } from './defaultWorkflow';

const RUN_SEQUENCE = ['trigger-1', 'agent-1', 'output-1'];
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AgentFlowCanvasProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function AgentFlowCanvas({ user }: AgentFlowCanvasProps) {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [name, setName] = useState(DEFAULT_WORKFLOW_NAME);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [runState, setRunState] = useState<RunState>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [runPhases, setRunPhases] = useState<RunPhasesMap>({});
  const [nodes, setNodes] = useState<FlowNode[]>(DEFAULT_NODES);
  const [edges, setEdges] = useState<FlowEdge[]>(DEFAULT_EDGES);

  const selNode = nodes.find(n => n.id === selected) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadWorkflow() {
      try {
        const response = await fetch('/api/workflows/current', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load workflow');

        const workflow = (await response.json()) as PersistedWorkflow;
        if (cancelled) return;

        setWorkflowId(workflow.id);
        setName(workflow.name);
        setNodes(workflow.canvasJson.nodes);
        setEdges(workflow.canvasJson.edges);
      } catch {
        if (!cancelled) setSaveState('error');
      }
    }

    loadWorkflow();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleSave() {
    setSaveState('saving');

    try {
      const response = await fetch('/api/workflows/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workflowId,
          name,
          canvasJson: { nodes, edges },
        }),
      });

      if (!response.ok) throw new Error('Unable to save workflow');

      const workflow = (await response.json()) as PersistedWorkflow;
      setWorkflowId(workflow.id);
      setName(workflow.name);
      setNodes(workflow.canvasJson.nodes);
      setEdges(workflow.canvasJson.edges);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
    }
  }

  function addNode(type: NodeType) {
    const id = `${type}-${Date.now()}`;
    const cfg = NODE_TYPES[type];
    const typeDefaults: Partial<FlowNode> =
      type === 'trigger'
        ? { triggerType: 'Manual', triggerInputMode: 'none', subtitle: 'Manual - No input' }
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
        saveState={saveState}
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
