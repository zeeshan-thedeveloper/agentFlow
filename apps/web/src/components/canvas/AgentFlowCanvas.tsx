'use client';

import { useEffect, useState } from 'react';
import type { FlowNode, FlowEdge, RunState, RunPhasesMap, NodeType, PersistedWorkflow } from './types';
import { NODE_TYPES } from './constants';
import TopBar from './TopBar';
import NodeLibrary from './NodeLibrary';
import CanvasBoard from './CanvasBoard';
import ConfigPanel from './ConfigPanel';
import { DEFAULT_EDGES, DEFAULT_NODES, DEFAULT_WORKFLOW_NAME } from './defaultWorkflow';

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
    summary?: string | null;
  };
  steps: RunStep[];
  message?: string | string[];
  error?: string;
};

function getErrorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object') return fallback;

  const payload = value as { message?: unknown; error?: unknown; summary?: unknown };
  if (Array.isArray(payload.message) && payload.message.length > 0) {
    return payload.message.join(', ');
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.summary === 'string' && payload.summary.trim()) {
    return payload.summary;
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

function sortNodesForRun(nodes: FlowNode[], edges: FlowEdge[]) {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const indegree = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]));

  for (const edge of edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) continue;
    outgoing.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = nodes
    .filter(node => indegree.get(node.id) === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  const sorted: FlowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;

    sorted.push(node);

    for (const nextNodeId of outgoing.get(node.id) ?? []) {
      const nextIndegree = (indegree.get(nextNodeId) ?? 0) - 1;
      indegree.set(nextNodeId, nextIndegree);

      if (nextIndegree === 0) {
        const nextNode = nodesById.get(nextNodeId);
        if (nextNode) {
          queue.push(nextNode);
          queue.sort((a, b) => a.id.localeCompare(b.id));
        }
      }
    }
  }

  return sorted.length === nodes.length ? sorted : nodes;
}

function buildProgressPhases(nodeIds: string[], runningIndex: number): RunPhasesMap {
  return Object.fromEntries(
    nodeIds.map((nodeId, index) => [
      nodeId,
      index < runningIndex ? 'done' : index === runningIndex ? 'running' : 'queued',
    ]),
  ) as RunPhasesMap;
}

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
  const [runError, setRunError] = useState<string | null>(null);
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
    const executionNodeIds = sortNodesForRun(nodes, edges).map(node => node.id);
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    let progressIndex = 0;

    console.info('[AgentFlow] Run clicked', {
      workflowId,
      executionNodeIds,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        tools: node.tools ?? [],
      })),
    });

    setRunState('running');
    setRunError(null);
    setRunPhases(executionNodeIds.length > 0 ? buildProgressPhases(executionNodeIds, 0) : {});
    setSaveState('saving');

    try {
      if (executionNodeIds.length > 1) {
        progressTimer = setInterval(() => {
          progressIndex = Math.min(progressIndex + 1, executionNodeIds.length - 1);
          setRunPhases(buildProgressPhases(executionNodeIds, progressIndex));
        }, 900);
      }

      const workflow = await saveWorkflow();
      console.info('[AgentFlow] Workflow saved before run', {
        workflowId: workflow.id,
        nodes: workflow.canvasJson.nodes.map(node => ({
          id: node.id,
          type: node.type,
          label: node.label,
          tools: node.tools ?? [],
        })),
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);

      const triggerNode = workflow.canvasJson.nodes.find(node => node.type === 'trigger');
      const triggerInput =
        triggerNode?.triggerInputMode === 'input' ? triggerNode.triggerInput ?? '' : undefined;

      console.info('[AgentFlow] Sending run request', {
        workflowId: workflow.id,
        apiBaseUrl: API_BASE_URL,
        triggerInput,
      });

      // Execute the saved workflow through the Nest backend instead of the old mock timer.
      const response = await fetch(`${API_BASE_URL}/workflows/${workflow.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: triggerInput }),
      });

      const runResult = (await response.json().catch(() => null)) as RunResponse | null;
      console.info('[AgentFlow] Run response received', {
        ok: response.ok,
        status: response.status,
        runStatus: runResult?.run.status,
        steps: runResult?.steps.map(step => ({
          nodeId: step.nodeId,
          status: step.status,
          output: typeof step.output === 'string' ? step.output.slice(0, 500) : step.output,
        })),
      });
      if (!response.ok || !runResult) {
        throw new Error(getErrorMessage(runResult, 'Workflow run failed'));
      }

      const steps = runResult.steps.length > 0
        ? runResult.steps
        : executionNodeIds.map(nodeId => ({ nodeId, status: 'COMPLETED' as const, output: null }));

      if (progressTimer) clearInterval(progressTimer);

      setRunPhases(Object.fromEntries(executionNodeIds.map(nodeId => [nodeId, 'queued'])) as RunPhasesMap);

      steps.forEach((step, index) => {
        setTimeout(() => setRunPhases(previous => ({ ...previous, [step.nodeId]: 'running' })), index * 320);
        setTimeout(
          () => setRunPhases(previous => ({
            ...previous,
            [step.nodeId]: step.status === 'FAILED' ? 'failed' : 'done',
          })),
          index * 320 + 240,
        );
      });

      const hasFailure =
        runResult.run.status === 'FAILED' || steps.some(step => step.status === 'FAILED');
      const failedStep = steps.find(step => step.status === 'FAILED');
      const failureMessage =
        failedStep
          ? typeof failedStep.output === 'string'
            ? failedStep.output
            : JSON.stringify(failedStep.output, null, 2) ?? 'Node execution failed'
          : getErrorMessage(runResult, 'Workflow run failed');
      const total = steps.length * 320 + 500;
      setNodeOutputs(Object.fromEntries(steps.map(step => [step.nodeId, step.output])));

      if (hasFailure) {
        setRunError(failedStep ? `${failedStep.nodeId}: ${failureMessage}` : failureMessage);
        if (failedStep) setSelected(failedStep.nodeId);
      }

      setTimeout(() => setRunState(hasFailure ? 'error' : 'success'), total);
      setTimeout(() => {
        setRunState('idle');
        setRunPhases({});
        if (!hasFailure) setRunError(null);
      }, total + 3000);
    } catch (error) {
      console.error('[AgentFlow] Run failed', error);
      if (progressTimer) clearInterval(progressTimer);
      const message = error instanceof Error ? error.message : 'Workflow run failed';
      setSaveState('error');
      setRunState('error');
      setRunError(message);
      setRunPhases(previous => {
        const fallbackNodeId = executionNodeIds[progressIndex] ?? executionNodeIds[0];
        if (!fallbackNodeId) return previous;

        return {
          ...previous,
          [fallbackNodeId]: 'failed',
        };
      });
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

        <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
          <CanvasBoard
            nodes={nodes}
            setNodes={setNodes}
            edges={edges}
            setEdges={setEdges}
            selected={selected}
            setSelected={setSelected}
            runPhases={runPhases}
          />

          {runError && (
            <div style={{
              position: 'absolute',
              left: 18,
              right: 18,
              top: 14,
              zIndex: 50,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.42)',
              background: 'color-mix(in srgb, var(--panel-bg) 92%, #ef4444)',
              boxShadow: '0 14px 36px var(--shadow-soft)',
              color: 'var(--text-primary)',
              fontSize: 12,
              lineHeight: 1.45,
            }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(239,68,68,0.16)',
                color: '#ef4444',
                fontWeight: 800,
              }}>
                !
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', marginBottom: 2 }}>
                  Run failed
                </div>
                <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                  {runError}
                </div>
              </div>
              <button
                type="button"
                title="Dismiss"
                onClick={() => setRunError(null)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                x
              </button>
            </div>
          )}
        </div>

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
