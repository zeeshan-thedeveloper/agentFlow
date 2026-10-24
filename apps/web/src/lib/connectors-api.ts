import type { ConnectorProvider } from '@/components/canvas/types';

export interface ConnectorStatus {
  connected: boolean;
  /** Account, workspace or bot name. */
  name?: string | null;
  /** Connection id; the Slack events URL is built from it. */
  id?: string;
  /** Google only: whether reading email and Drive was granted. */
  read?: boolean;
  /** Google only: whether this account may turn on reading (test users only for now). */
  readAllowed?: boolean;
}

export type ConnectorStatuses = Record<ConnectorProvider, ConnectorStatus>;

/** Where Slack and Telegram post events; the deployed API must be reachable at this address. */
export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/connectors${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string | string[]; error?: string };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? body.error;
    throw new Error(message || 'Request failed');
  }
  return body;
}

export const fetchConnectors = () => request<ConnectorStatuses>('');

export const connectSlack = (botToken: string, signingSecret: string) =>
  request<{ ok: boolean; name: string; id: string }>('/slack', {
    method: 'POST',
    body: JSON.stringify({ botToken, signingSecret }),
  });

export const connectTelegram = (botToken: string) =>
  request<{ ok: boolean; name: string }>('/telegram', {
    method: 'POST',
    body: JSON.stringify({ botToken, webhookBaseUrl: PUBLIC_API_URL }),
  });

export const connectGitHub = (token: string) =>
  request<{ ok: boolean; name: string }>('/github', { method: 'POST', body: JSON.stringify({ token }) });

export const disconnectConnector = (provider: ConnectorProvider) =>
  request<{ ok: boolean }>(`/${provider}`, { method: 'DELETE' });

/** Full-page redirect to Google's consent screen; it returns to the canvas. */
export function startGoogleConnect(includeRead: boolean) {
  window.location.href = `/api/connectors/google/start${includeRead ? '?read=1' : ''}`;
}

export function slackEventsUrl(connectionId: string) {
  return `${PUBLIC_API_URL}/hooks/slack/${connectionId}`;
}

/** Manifest for creating the Slack app; with an events URL it also subscribes to mentions and DMs. */
export function slackManifest(eventsUrl?: string) {
  return {
    display_information: { name: 'AgentFlow' },
    features: {
      bot_user: { display_name: 'AgentFlow', always_online: true },
      app_home: { messages_tab_enabled: true, messages_tab_read_only_enabled: false },
    },
    oauth_config: {
      scopes: {
        bot: [
          'app_mentions:read',
          'chat:write',
          'channels:read',
          'channels:history',
          'groups:read',
          'groups:history',
          'im:read',
          'im:history',
        ],
      },
    },
    settings: {
      ...(eventsUrl ? { event_subscriptions: { request_url: eventsUrl, bot_events: ['app_mention', 'message.im'] } } : {}),
      org_deploy_enabled: false,
      socket_mode_enabled: false,
    },
  };
}
