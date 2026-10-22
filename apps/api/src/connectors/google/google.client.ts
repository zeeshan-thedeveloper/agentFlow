import type { ConnectorStore, GoogleCredential, StoredConnector } from '../connector.store';

// Gmail and Drive share one Google OAuth connection. By default it asks only
// for what Google has reviewed for AgentFlow: sending email, which an agent
// gets only when its Gmail node allows it. Reading email and Drive uses
// restricted scopes Google hasn't verified for AgentFlow, so it is a separate
// opt-in that only works for the project's test users.
export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'];

export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const GOOGLE_READ_SCOPES = [GMAIL_READ_SCOPE, DRIVE_READ_SCOPE];

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REFRESH_MARGIN_MS = 60_000;

function clientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google is not configured on the server: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
  return { clientId, clientSecret };
}

export function googleAuthUrl(redirectUri: string, state: string, includeRead: boolean): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientConfig().clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [...GOOGLE_SCOPES, ...(includeRead ? GOOGLE_READ_SCOPES : [])].join(' '),
    // offline + consent makes Google return a refresh token every time.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString();
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = clientConfig();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? response.statusText}`);
  }
  return body;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleCredential> {
  const tokens = await requestToken({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Remove AgentFlow from your Google account access and connect again.');
  }

  const userInfo = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const { email } = (await userInfo.json().catch(() => ({}))) as { email?: string };

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    email: email ?? 'Google account',
    scopes: (tokens.scope ?? '').split(' ').filter(Boolean),
  };
}

export async function revokeGoogleToken(credential: GoogleCredential): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(credential.refreshToken)}`, {
    method: 'POST',
  }).catch(() => undefined);
}

/** Calls Google APIs as one user's connection, refreshing the access token when it runs out. */
export class GoogleSession {
  constructor(
    private readonly store: ConnectorStore,
    private connector: StoredConnector<'google'>,
  ) {}

  get email() {
    return this.connector.data.email;
  }

  hasScope(scope: string) {
    return this.connector.data.scopes.includes(scope);
  }

  private async refresh(): Promise<void> {
    const tokens = await requestToken({ refresh_token: this.connector.data.refreshToken, grant_type: 'refresh_token' });
    const data: GoogleCredential = {
      ...this.connector.data,
      accessToken: tokens.access_token!,
      expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    };
    await this.store.update<'google'>(this.connector.id, data);
    this.connector = { ...this.connector, data };
  }

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    if (this.connector.data.expiresAt - REFRESH_MARGIN_MS < Date.now()) await this.refresh();

    const send = () =>
      fetch(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${this.connector.data.accessToken}` },
      });

    let response = await send();
    if (response.status === 401) {
      await this.refresh();
      response = await send();
    }
    return response;
  }

  async json<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetch(url, init);
    if (!response.ok) throw new Error(await googleError(response));
    return (await response.json()) as T;
  }
}

export async function googleError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return `Google API error ${response.status}: ${body?.error?.message ?? response.statusText}`;
}
