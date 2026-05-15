import type { NodeType, NodeTypeConfig } from './types';

export const NW = 200;
export const NH = 74;

export const NODE_TYPES: Record<NodeType, NodeTypeConfig> = {
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
};
