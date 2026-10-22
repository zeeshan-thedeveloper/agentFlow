import { DatabaseIcon, GitBranch, HardDrive, Hash, Mail, MessagesSquare, Send } from 'lucide-react';
import type { ConnectorKind, ConnectorProvider, FlowNode, LibraryNodeType, NodeTypeConfig } from './types';

export const NW = 200;
export const NH = 74;

function connectorType(label: string, color: string, icon: NodeTypeConfig['icon'], desc: string): NodeTypeConfig {
  return {
    label,
    color,
    glowA: `color-mix(in srgb, ${color} 22%, transparent)`,
    glowB: `color-mix(in srgb, ${color} 8%, transparent)`,
    icon,
    lib: { desc, options: ['Connect to an Agent'], category: 'apps' },
  };
}

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
    lib: { desc: 'Starts the workflow', options: ['Manual', 'Cron Schedule', 'Slack message', 'Telegram message'] },
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
      desc: 'Connect to an Agent to let it look up data',
      options: ['Configure connection'],
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
  'query-runner': {
    label: 'Query Runner',
    color: '#06B6D4',
    glowA: 'rgba(6,182,212,0.22)',
    glowB: 'rgba(6,182,212,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 7l2.5 2.5L5 12M9 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    lib: {
      desc: 'Execute a SQL query against a database connection.',
      options: ['Run query'],
      category: 'integrations',
    },
  },
  gmail: connectorType('Gmail', '#EA4335', <Mail size={16} strokeWidth={1.8} />, 'Let an Agent search, read and send email'),
  drive: connectorType('Google Drive', '#1A73E8', <HardDrive size={16} strokeWidth={1.8} />, 'Let an Agent search and read your files'),
  gchat: connectorType('Google Chat', '#00AC47', <MessagesSquare size={16} strokeWidth={1.8} />, 'Let an Agent read your Chat spaces'),
  slack: connectorType('Slack', '#E01E5A', <Hash size={16} strokeWidth={1.8} />, 'Let an Agent read and post in Slack'),
  telegram: connectorType('Telegram', '#229ED9', <Send size={16} strokeWidth={1.8} />, 'Let an Agent message people on Telegram'),
  github: connectorType('GitHub', '#8B5CF6', <GitBranch size={16} strokeWidth={1.8} />, 'Let an Agent work with your repos'),
};

export const CONNECTOR_KINDS: ConnectorKind[] = ['gmail', 'drive', 'gchat', 'slack', 'telegram', 'github'];

export function isConnectorKind(value: unknown): value is ConnectorKind {
  return CONNECTOR_KINDS.includes(value as ConnectorKind);
}

export const CONNECTOR_INFO: Record<ConnectorKind, {
  provider: ConnectorProvider;
  /** What the agent can do through this node. */
  abilities: string;
  /** Label for the opt-in that lets the agent change things, when the app has one. */
  writeLabel?: string;
}> = {
  gmail: { provider: 'google', abilities: 'Search and read email.', writeLabel: 'Allow sending email' },
  drive: { provider: 'google', abilities: 'Search and read Docs, Sheets, Slides and text files. Read-only.' },
  gchat: { provider: 'google', abilities: 'List Chat spaces and read messages. Read-only; Google Workspace accounts only.' },
  slack: { provider: 'slack', abilities: 'List channels, read channels the bot is in, and post messages.' },
  telegram: { provider: 'telegram', abilities: 'Send messages to chats that have talked to the bot.' },
  github: { provider: 'github', abilities: 'Read repos, issues, pull requests and files.', writeLabel: 'Allow opening issues and commenting' },
};

/** The line under an app node's name: what an agent wired to it may do. */
export function connectorSubtitle(node: Pick<FlowNode, 'connector' | 'allowWrite'>): string {
  switch (node.connector) {
    case 'gmail': return node.allowWrite ? 'Read & send email' : 'Read-only';
    case 'github': return node.allowWrite ? 'Read, open issues & comment' : 'Read-only';
    case 'slack': return 'Read & post messages';
    case 'telegram': return 'Send messages';
    default: return 'Read-only';
  }
}

/** The look of a canvas node: connectors and databases by what they connect to, others by node type. */
export function nodeTypeConfig(node: Pick<FlowNode, 'type' | 'connector' | 'integrationId'>): NodeTypeConfig {
  if (node.type === 'connector' && isConnectorKind(node.connector)) return NODE_TYPES[node.connector];
  if (node.type === 'integration' && node.integrationId?.startsWith('database')) return NODE_TYPES.database;
  return NODE_TYPES[node.type as keyof typeof NODE_TYPES] ?? NODE_TYPES.integration;
}
