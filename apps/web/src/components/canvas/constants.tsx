import { DatabaseIcon } from 'lucide-react';
import type { HandleDef, LibraryNodeType, NodeType, NodeTypeConfig } from './types';

export const NW = 200;
export const NH = 74;

export const NODE_HANDLES: Record<NodeType | 'database', HandleDef[]> = {
  trigger: [
    { id: 'data-out', type: 'source', handleType: 'data', position: 'right-top', label: 'Data' },
    { id: 'query-out', type: 'source', handleType: 'query', position: 'right-bottom', label: 'SQL', conditional: "inputType === 'sql'" },
  ],
  schema: [
    { id: 'trigger-in', type: 'target', handleType: 'trigger', position: 'left-top', label: 'Trigger' },
    { id: 'db-in', type: 'target', handleType: 'schema', position: 'left-bottom', label: 'DB' },
    { id: 'schema-out', type: 'source', handleType: 'schema', position: 'right', label: 'Schema' },
  ],
  agent: [
    { id: 'data-in', type: 'target', handleType: 'data', position: 'left-top', label: 'Data' },
    { id: 'schema-in', type: 'target', handleType: 'schema', position: 'left-bottom', label: 'Schema' },
    { id: 'data-out', type: 'source', handleType: 'data', position: 'right', label: 'Data' },
  ],
  database: [
    { id: 'trigger-in', type: 'target', handleType: 'trigger', position: 'left-top', label: 'Trigger' },
    { id: 'agent-in', type: 'target', handleType: 'query', position: 'left', label: 'Agent' },
    { id: 'schema-out', type: 'source', handleType: 'schema', position: 'right-top', label: 'Schema' },
    { id: 'data-out', type: 'source', handleType: 'data', position: 'right-bottom', label: 'Data' },
  ],
  output: [
    { id: 'data-in', type: 'target', handleType: 'data', position: 'left', label: 'Data' },
  ],
  integration: [
    { id: 'trigger-in', type: 'target', handleType: 'trigger', position: 'left-top', label: 'Trigger' },
    { id: 'agent-in', type: 'target', handleType: 'query', position: 'left', label: 'Agent' },
    { id: 'schema-out', type: 'source', handleType: 'schema', position: 'right-top', label: 'Schema' },
    { id: 'data-out', type: 'source', handleType: 'data', position: 'right-bottom', label: 'Data' },
  ],
};

export const NODE_TYPES: Record<LibraryNodeType, NodeTypeConfig> = {
  trigger: {
    label: 'Trigger',
    color: '#F59E0B',
    glowA: 'rgba(245,158,11,0.22)',
    glowB: 'rgba(245,158,11,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1v6l4 2M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    lib: { desc: 'Starts the workflow', options: ['Manual', 'Cron Schedule'] },
  },
  agent: {
    label: 'Agent',
    color: '#6C63FF',
    glowA: 'rgba(108,99,255,0.25)',
    glowB: 'rgba(108,99,255,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="6" width="10" height="7" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 6V4.5a2.5 2.5 0 0 1 5 0V6"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="6" cy="9.5" r="1" fill="currentColor" />
        <circle cx="10" cy="9.5" r="1" fill="currentColor" />
        <path d="M6 11.5s.8.8 2 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    lib: { desc: 'Runs the prompt', options: ['Prompt only'] },
  },
  output: {
    label: 'Output',
    color: '#3B82F6',
    glowA: 'rgba(59,130,246,0.22)',
    glowB: 'rgba(59,130,246,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M14 2 7 9M14 2l-4 12-3-5-5-3 12-4z"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    lib: { desc: 'Receives agent output', options: ['Return output'] },
  },
  integration: {
    label: 'Integration',
    color: '#10B981',
    glowA: 'rgba(16,185,129,0.22)',
    glowB: 'rgba(16,185,129,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <ellipse cx="8" cy="3.5" rx="5" ry="2"
          stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 3.5v4.8c0 1.1 2.2 2 5 2s5-.9 5-2V3.5"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M3 6c0 1.1 2.2 2 5 2s5-.9 5-2M3 8.5v3c0 1.1 2.2 2 5 2s5-.9 5-2v-3"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    lib: { desc: 'Connect to an external database or service', options: ['Database query'] },
  },
  database: {
    label: 'Database',
    color: '#10B981',
    bgColor: '#ECFDF5',
    glowA: 'rgba(16,185,129,0.22)',
    glowB: 'rgba(16,185,129,0.08)',
    icon: <DatabaseIcon size={16} strokeWidth={1.8} />,
    lib: {
      desc: 'Query or write to PostgreSQL or MongoDB',
      options: ['Database query'],
      category: 'integrations',
    },
  },
  schema: {
    label: 'Schema',
    color: '#8B5CF6',
    glowA: 'rgba(139,92,246,0.25)',
    glowB: 'rgba(139,92,246,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2.5 4.5h11v8h-11v-8zM5 2.5h6M5 6.5h6M5 9.5h4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    lib: {
      desc: 'Introspect a database and output its schema as agent context.',
      options: ['Introspect schema'],
      category: 'integrations',
    },
  },
};
