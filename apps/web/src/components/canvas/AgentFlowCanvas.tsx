'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FlowNode, FlowEdge, RunPlan, RunState, RunPhasesMap, LibraryNodeType, PersistedWorkflow, ToolCallRecord } from './types';
import { NODE_TYPES } from './constants';
import TopBar from './TopBar';
import NodeLibrary from './NodeLibrary';
import CanvasBoard from './CanvasBoard';
import ConfigPanel from './ConfigPanel';
import RunOrderBar from './RunOrderBar';
import { resolveRunPlan, savedRunPlan } from './runOrder';
import { DEFAULT_CANVAS_JSON, DEFAULT_EDGES, DEFAULT_NODES, DEFAULT_WORKFLOW_NAME } from './defaultWorkflow';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type RunStep = {
  nodeId: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  output: unknown;
  /** Steps sharing a wave ran side by side. */
  wave?: number;
  toolCalls?: ToolCallRecord[];
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

function formatRunOutput(output: unknown): string | undefined {
  if (output == null) return undefined;
  if (typeof output === 'string') return output.trim() || undefined;
  if (typeof output === 'object' && 'data' in output) {
    const data = (output as { data?: unknown }).data;
    if (typeof data === 'string') return data.trim() || undefined;
    if (data != null) return JSON.stringify(data, null, 2);
  }
  return JSON.stringify(output, null, 2);
}

function buildProgressPhases(plan: RunPlan, runningStep: number): RunPhasesMap {
  return Object.fromEntries(
    plan.flatMap((step, index) => step.map(nodeId => [
      nodeId,
      index < runningStep ? 'done' : index === runningStep ? 'running' : 'queued',
    ])),
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
  const [nodeToolCalls, setNodeToolCalls] = useState<Record<string, ToolCallRecord[]>>({});
  const [nodes, setNodes] = useState<FlowNode[]>(DEFAULT_NODES);
  const [edges, setEdges] = useState<FlowEdge[]>(DEFAULT_EDGES);
  const [runOrder, setRunOrder] = useState<RunPlan>(() => savedRunPlan(DEFAULT_CANVAS_JSON));

  const selNode = nodes.find(n => n.id === selected) ?? null;
  const runPlan = useMemo(() => resolveRunPlan(nodes, edges, runOrder), [nodes, edges, runOrder]);

  const runOutputs = useMemo(() => {
    const outputs: Record<string, string> = {};
    for (const [nodeId, value] of Object.entries(nodeOutputs)) {
      const text = formatRunOutput(value);
      if (text) outputs[nodeId] = text;
    }
    return outputs;
  }, [nodeOutputs]);

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
        setRunOrder(savedRunPlan(workflow.canvasJson));
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
        canvasJson: { nodes, edges, runOrder: runPlan },
      }),
    });

    if (!response.ok) throw new Error('Unable to save workflow');

    const workflow = (await response.json()) as PersistedWorkflow;
    setWorkflowId(workflow.id);
    setName(workflow.name);
    const savedNodes = workflow.canvasJson.nodes;
    const nodeIds = new Set(savedNodes.map(node => node.id));
    const savedEdges = workflow.canvasJson.edges.filter(
      edge => nodeIds.has(edge.from) && nodeIds.has(edge.to),
    );
    setNodes(savedNodes);
    setEdges(savedEdges);

    return workflow;
  }

  async function handleRun() {
    const executionNodeIds = runPlan.flat();
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    let progressStep = 0;

    console.info('[AgentFlow] Run clicked', {
      workflowId,
      runPlan,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        tools: node.tools ?? [],
      })),
    });

    setRunState('running');
    setRunError(null);
    setRunPhases(buildProgressPhases(runPlan, 0));
    setNodeOutputs({});
    setNodeToolCalls({});
    setSaveState('saving');

    try {
      if (runPlan.length > 1) {
        progressTimer = setInterval(() => {
          progressStep = Math.min(progressStep + 1, runPlan.length - 1);
          setRunPhases(buildProgressPhases(runPlan, progressStep));
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

      const allSteps: RunStep[] = runResult.steps.length > 0
        ? runResult.steps
        : executionNodeIds.map(nodeId => ({ nodeId, status: 'COMPLETED' as const, output: null }));
      const steps = allSteps.filter(step => step.status !== 'SKIPPED');
      const skippedIds = allSteps.filter(step => step.status === 'SKIPPED').map(step => step.nodeId);

      if (progressTimer) clearInterval(progressTimer);

      setRunPhases(Object.fromEntries(executionNodeIds.map(nodeId => [nodeId, 'queued'])) as RunPhasesMap);

      // Replay one wave at a time, so nodes that ran side by side light up together.
      const waveOrder = [...new Set(steps.map((step, index) => step.wave ?? index))].sort((a, b) => a - b);
      const slotOf = (step: RunStep, index: number) => waveOrder.indexOf(step.wave ?? index);

      steps.forEach((step, index) => {
        const slot = slotOf(step, index);
        setTimeout(() => setRunPhases(previous => ({ ...previous, [step.nodeId]: 'running' })), slot * 320);
        setTimeout(
          () => setRunPhases(previous => ({
            ...previous,
            [step.nodeId]: step.status === 'FAILED' ? 'failed' : 'done',
          })),
          slot * 320 + 240,
        );
      });

      // Skipped nodes never ran: drop them back to idle instead of leaving them queued.
      setTimeout(() => setRunPhases(previous => {
        const next = { ...previous };
        for (const nodeId of skippedIds) delete next[nodeId];
        return next;
      }), waveOrder.length * 320);

      const hasFailure =
        runResult.run.status === 'FAILED' || steps.some(step => step.status === 'FAILED');
      const failedStep = steps.find(step => step.status === 'FAILED');
      const failureMessage =
        failedStep
          ? typeof failedStep.output === 'string'
            ? failedStep.output
            : JSON.stringify(failedStep.output, null, 2) ?? 'Node execution failed'
          : getErrorMessage(runResult, 'Workflow run failed');
      const total = waveOrder.length * 320 + 500;
      setNodeOutputs(Object.fromEntries(steps.map(step => [step.nodeId, step.output])));
      setNodeToolCalls(Object.fromEntries(
        runResult.steps.filter(step => step.toolCalls?.length).map(step => [step.nodeId, step.toolCalls!]),
      ));

      if (hasFailure) {
        const skippedNote = skippedIds.length > 0
          ? ` (${skippedIds.length} downstream node${skippedIds.length === 1 ? '' : 's'} skipped)`
          : '';
        setRunError(failedStep ? `${failedStep.nodeId}: ${failureMessage}${skippedNote}` : failureMessage);
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
        const fallbackStep = runPlan[progressStep] ?? runPlan[0];
        if (!fallbackStep) return previous;

        return {
          ...previous,
          ...Object.fromEntries(fallbackStep.map(nodeId => [nodeId, 'failed'])),
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

  function addNode(type: LibraryNodeType) {
    const nodeType = type === 'database' ? 'integration' : type === 'schema' ? 'schema' : type;
    const id = `${type}-${Date.now()}`;
    const cfg = NODE_TYPES[type];
    const typeDefaults: Partial<FlowNode> =
      nodeType === 'trigger'
        ? { triggerType: 'Manual', triggerInputMode: 'none', subtitle: 'Manual - No input' }
        : nodeType === 'agent'
        ? { subtitle: 'OpenAI - GPT-4.1 Mini', provider: 'openai', model: 'gpt-4.1-mini', prompt: '', maxIterations: 10 }
        : nodeType === 'output'
        ? { subtitle: 'Receives result', outputMode: 'Return output' }
        : type === 'database'
        ? { integrationId: 'database', dbType: 'postgresql', label: 'Database', subtitle: 'Select connection' }
        : nodeType === 'schema'
        ? { integrationId: '', connectionName: '', subtitle: 'Select connection' }
        : nodeType === 'query-runner'
        ? { integrationId: '', connectionName: '', subtitle: 'Select connection', actionParams: { sql: '' } }
        : {};

    setNodes(p => [...p, {
      id,
      type: nodeType,
      label: typeDefaults.label ?? `New ${cfg.label}`,
      subtitle: cfg.lib.options[0],
      x: 160 + Math.random() * 300,
      y: 140 + Math.random() * 220,
      ...typeDefaults,
    }]);
    setSelected(id);
  }

  function updateNode(id: string, patch: Partial<FlowNode>) {
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }

  const removeNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(node => node.id !== id));
    setEdges(prev => prev.filter(edge => edge.from !== id && edge.to !== id));
    setSelected(current => (current === id ? null : current));
  }, []);

  useEffect(() => {
    const nodeIds = new Set(nodes.map(node => node.id));
    setEdges(prev => {
      const next = prev.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to));
      return next.length === prev.length ? prev : next;
    });
  }, [nodes, setEdges]);

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

        <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <CanvasBoard
            nodes={nodes}
            setNodes={setNodes}
            edges={edges}
            setEdges={setEdges}
            selected={selected}
            setSelected={setSelected}
            runPhases={runPhases}
            runOutputs={runOutputs}
            runToolCalls={nodeToolCalls}
            onRemoveNode={removeNode}
          />

          <RunOrderBar
            plan={runPlan}
            nodes={nodes}
            edges={edges}
            runPhases={runPhases}
            selected={selected}
            onSelect={setSelected}
            onChange={setRunOrder}
            disabled={runState === 'running'}
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
            nodes={nodes}
            edges={edges}
            onClose={() => setSelected(null)}
            onUpdate={patch => updateNode(selNode.id, patch)}
            onDelete={() => removeNode(selNode.id)}
            onRun={handleRun}
            runOutput={nodeOutputs[selNode.id]}
          />
        )}
      </div>
    </div>
  );
}
