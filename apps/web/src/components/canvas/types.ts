import type { ReactElement } from 'react';

export type NodeType = 'trigger' | 'agent' | 'output';
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
  triggerInput?: string;
  prompt?: string;
  provider?: 'openai';
  model?: string;
  outputMode?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
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
  glowA: string;
  glowB: string;
  icon: ReactElement;
  lib: {
    desc: string;
    options: string[];
  };
}

export type RunPhasesMap = Partial<Record<string, RunPhase>>;
