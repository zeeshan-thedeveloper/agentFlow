import type { ReactElement } from 'react';

export type NodeType = 'trigger' | 'agent' | 'skill' | 'output';
export type RunPhase = 'running' | 'done';
export type RunState = 'idle' | 'running' | 'success';

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  // Type-specific config
  triggerType?: string;
  model?: string;
  temp?: number;
  prompt?: string;
  skillType?: string;
  attachedSkills?: string[];
  destination?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
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

export interface Model {
  id: string;
  label: string;
  sub: string;
  badge?: string;
}

export type RunPhasesMap = Partial<Record<string, RunPhase>>;
