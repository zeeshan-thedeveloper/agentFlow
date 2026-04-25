'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  icon: string;
  color: string;
}

export default function AgentNode({ data, selected }: NodeProps) {
  const { label, icon, color } = data as AgentNodeData;
  return (
    <div
      className="min-w-[120px] rounded-xl border-2 bg-[#18181b] px-4 py-3 text-center shadow-lg transition-shadow"
      style={{
        borderColor: selected ? '#fff' : color,
        boxShadow: selected ? `0 0 0 1px ${color}` : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-[#333] !bg-[#555]"
      />

      <div className="mb-1 text-2xl leading-none">{icon}</div>
      <div className="text-xs font-medium text-white/90">{label}</div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-[#333] !bg-[#555]"
      />
    </div>
  );
}
