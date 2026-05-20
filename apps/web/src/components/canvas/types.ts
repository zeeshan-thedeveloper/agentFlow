import type { ReactElement } from 'react';

export const SCHEMA_NODE = 'schema' as const;

export type NodeType = 'trigger' | 'agent' | 'output' | 'integration' | 'query-runner' | typeof SCHEMA_NODE;
export type LibraryNodeType = NodeType | 'database';

export interface SchemaNodeData {
  type: typeof SCHEMA_NODE;
  integrationId: string;
  connectionName: string;
}

export type HandleType = 'trigger' | 'data' | 'query' | 'schema' | 'connection' | 'text-trigger';

export interface HandleDef {
  id: string;
  type: 'source' | 'target';
  handleType: HandleType;
  position:
    | 'left'
    | 'right'
    | 'left-top'
    | 'left-middle'
    | 'left-bottom'
    | 'right-top'
    | 'right-middle'
    | 'right-bottom';
  conditional?: string;
  label?: string;
}

export type RunPhase = 'queued' | 'running' | 'done' | 'failed';
export type RunState = 'idle' | 'running' | 'success' | 'error';

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  // Type-specific config
  triggerType?: string;
  triggerInputMode?: 'none' | 'input';
  inputType?: 'text' | 'sql';
  triggerInput?: string;
  prompt?: string;
  provider?: 'openai';
  model?: string;
  tools?: string[];
  maxIterations?: number;
  outputMode?: string;
  integrationId?: string;
  connectionName?: string;
  dbType?: 'postgresql' | 'mongodb';
  actionId?: string;
  actionParams?: Record<string, unknown>;
}

export interface FlowEdge {
  from: string;
  to: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowCanvasJson {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface PersistedWorkflow {
  id: string;
  name: string;
  canvasJson: WorkflowCanvasJson;
  createdAt: string;
  updatedAt: string;
}

export interface NodeTypeConfig {
  label: string;
  color: string;
  bgColor?: string;
  glowA: string;
  glowB: string;
  icon: ReactElement;
  lib: {
    desc: string;
    options: string[];
    category?: string;
  };
}

export type RunPhasesMap = Partial<Record<string, RunPhase>>;
