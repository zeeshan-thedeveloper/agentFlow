// ─── Run status ───────────────────────────────────────────────────────────────

export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  canvasJson: CanvasJson;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Agent run ────────────────────────────────────────────────────────────────

export interface AgentRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  summary?: string;
}

export interface AgentStep {
  id: string;
  runId: string;
  stepType: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  createdAt: string;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export type CanvasNodeType = 'trigger' | 'agent' | 'skill' | 'output';

export interface CanvasNodeData {
  label: string;
  icon: string;
  color: string;
  [key: string]: unknown;
}

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: CanvasNodeData;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

export interface CanvasJson {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}
