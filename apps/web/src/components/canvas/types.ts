import type { ReactElement } from 'react';

export const SCHEMA_NODE = 'schema' as const;

export type NodeType = 'trigger' | 'agent' | 'output' | 'integration' | 'query-runner' | 'connector' | typeof SCHEMA_NODE;

/** The apps a connector node can stand for; wiring one into an Agent gives it that app's tools. */
export type ConnectorKind = 'gmail' | 'drive' | 'gchat' | 'slack' | 'telegram' | 'github';
/** Accounts a user connects; Google covers Gmail, Drive and Google Chat. */
export type ConnectorProvider = 'google' | 'slack' | 'telegram' | 'github';

export type LibraryNodeType = Exclude<NodeType, 'connector'> | 'database' | ConnectorKind;

export interface SchemaNodeData {
  type: typeof SCHEMA_NODE;
  integrationId: string;
  connectionName: string;
}

/** A tool call an agent made during a run, as returned by the API. */
export interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  result: string;
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
  /** Slack and Telegram triggers: only messages containing this text start the run. */
  triggerKeyword?: string;
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
  connector?: ConnectorKind;
  /** Gmail: may send email. GitHub: may open issues and comment. */
  allowWrite?: boolean;
}

/** 'data' (the default) runs the target after the source and passes its output; 'wait' only orders them. */
export type EdgeKind = 'data' | 'wait';

export interface FlowEdge {
  from: string;
  to: string;
  kind?: EdgeKind;
}

/** Steps that run left to right; the node ids in one step run at the same time. */
export type RunPlan = string[][];

export interface WorkflowCanvasJson {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** The run plan set in the run order bar. Older saves may hold a flat list of ids. */
  runOrder?: RunPlan | string[];
  /** Only on workflows saved before run plans existed; read to pick their starting plan. */
  runMode?: 'parallel' | 'sequential';
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
