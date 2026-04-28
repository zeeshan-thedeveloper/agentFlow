import type { FlowEdge, FlowNode } from './types';

export const DEFAULT_WORKFLOW_NAME = 'GitHub Issue Monitor';

export const DEFAULT_NODES: FlowNode[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    label: 'Start',
    subtitle: 'Manual - No input',
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

export const DEFAULT_EDGES: FlowEdge[] = [
  { from: 'trigger-1', to: 'agent-1' },
  { from: 'agent-1', to: 'output-1' },
];

export const DEFAULT_CANVAS_JSON = {
  nodes: DEFAULT_NODES,
  edges: DEFAULT_EDGES,
};
