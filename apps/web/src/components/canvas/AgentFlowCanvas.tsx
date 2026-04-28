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
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type RunStep = {
  nodeId: string;
  status: 'COMPLETED' | 'FAILED';
  output: unknown;
};

type RunResponse = {
  run: {
    id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  };
  steps: RunStep[];
};

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
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, unknown>>({});
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

  async function saveWorkflow(): Promise<PersistedWorkflow> {
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

    return workflow;
  }

  async function handleRun() {
    setRunState('running');
    setRunPhases({});
    setSaveState('saving');

    try {
      const workflow = await saveWorkflow();
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);

      const triggerNode = workflow.canvasJson.nodes.find(node => node.type === 'trigger');
      const triggerInput =
        triggerNode?.triggerInputMode === 'input' ? triggerNode.triggerInput ?? '' : undefined;

      // Execute the saved workflow through the Nest backend instead of the old mock timer.
      const response = await fetch(`${API_BASE_URL}/workflows/${workflow.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: triggerInput }),
      });

      const runResult = (await response.json().catch(() => null)) as (RunResponse & { message?: string }) | null;
      if (!response.ok || !runResult) {
        throw new Error(runResult?.message ?? 'Workflow run failed');
      }

      const steps = runResult.steps.length > 0
        ? runResult.steps
        : RUN_SEQUENCE.map(nodeId => ({ nodeId, status: 'COMPLETED' as const, output: null }));

      steps.forEach((step, index) => {
        setTimeout(() => setRunPhases(previous => ({ ...previous, [step.nodeId]: 'running' })), index * 350);
        setTimeout(
          () => setRunPhases(previous => ({
            ...previous,
            [step.nodeId]: step.status === 'FAILED' ? 'failed' : 'done',
          })),
          index * 350 + 260,
        );
      });

      const hasFailure =
        runResult.run.status === 'FAILED' || steps.some(step => step.status === 'FAILED');
      const total = steps.length * 350 + 500;
      setNodeOutputs(Object.fromEntries(steps.map(step => [step.nodeId, step.output])));

      setTimeout(() => setRunState(hasFailure ? 'error' : 'success'), total);
      setTimeout(() => {
        setRunState('idle');
        setRunPhases({});
      }, total + 3000);
    } catch {
      setSaveState('error');
      setRunState('error');
      setTimeout(() => {
        setRunState('idle');
        setRunPhases({});
      }, 3500);
    }
  }

  async function handleSave() {
    setSaveState('saving');

    try {
      await saveWorkflow();
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
        ? { subtitle: 'OpenAI - GPT-4.1 Mini', provider: 'openai', model: 'gpt-4.1-mini', prompt: '' }
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
            runOutput={nodeOutputs[selNode.id]}
          />
        )}
      </div>
    </div>
  );
}
