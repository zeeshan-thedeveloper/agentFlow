import type { NodeType, NodeTypeConfig, Model } from './types';

export const NW = 200;
export const NH = 74;

export const MODELS: Model[] = [
  { id: 'claude', label: 'Claude 3.7 Sonnet', sub: 'Anthropic', badge: 'Recommended' },
  { id: 'gpt4o',  label: 'GPT-4o',            sub: 'OpenAI' },
  { id: 'llama',  label: 'Llama 3.3 70B',     sub: 'Meta · Local' },
  { id: 'gemini', label: 'Gemini 1.5 Pro',    sub: 'Google' },
];

export const SKILLS_LIST = [
  'Code Review', 'Summarise', 'Debug', 'Security Audit', 'Test Generator', 'Doc Writer',
];

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
    lib: { desc: 'AI model reasoning step', options: ['Claude 3.7', 'GPT-4o', 'Llama 3.3', 'Gemini 1.5'] },
  },
  skill: {
    label: 'Skill',
    color: '#22C55E',
    glowA: 'rgba(34,197,94,0.22)',
    glowB: 'rgba(34,197,94,0.08)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5 10.2 6H15l-4 2.8 1.5 4.7L8 10.5 3.5 13.5 5 8.8 1 6h4.8L8 1.5z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
    lib: { desc: 'Built-in capability', options: ['Code Review', 'Summarise', 'Debug', 'Security Audit'] },
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
    lib: { desc: 'Delivers results', options: ['Slack', 'Email', 'Dashboard', 'Webhook'] },
  },
};
