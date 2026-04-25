'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import AgentNode, { type AgentNodeData } from './nodes/AgentNode';

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
};

const initialNodes: Node<AgentNodeData>[] = [
  {
    id: '1',
    type: 'agentNode',
    position: { x: 80, y: 200 },
    data: { label: 'Trigger', icon: '⚡', color: '#6366f1' },
  },
  {
    id: '2',
    type: 'agentNode',
    position: { x: 320, y: 200 },
    data: { label: 'Agent', icon: '🤖', color: '#8b5cf6' },
  },
  {
    id: '3',
    type: 'agentNode',
    position: { x: 560, y: 200 },
    data: { label: 'Skill', icon: '🔧', color: '#06b6d4' },
  },
  {
    id: '4',
    type: 'agentNode',
    position: { x: 800, y: 200 },
    data: { label: 'Output', icon: '📤', color: '#10b981' },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
    style: { stroke: '#3f3f46', strokeWidth: 2 },
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    animated: true,
    style: { stroke: '#3f3f46', strokeWidth: 2 },
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    animated: true,
    style: { stroke: '#3f3f46', strokeWidth: 2 },
  },
];

export default function FlowCanvas() {
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={memoizedNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0D0D0F' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#27272a"
        />
      </ReactFlow>
    </div>
  );
}
