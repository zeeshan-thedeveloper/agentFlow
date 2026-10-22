import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { requireUserId, type AuthenticatedRequest } from '../integrations/integrations.controller';
import { CONNECTOR_PROVIDERS, ConnectorStore, type ConnectorProvider } from './connector.store';
import { githubIdentity } from './github/github.client';
import { GOOGLE_CHAT_SCOPES, exchangeGoogleCode, googleAuthUrl, revokeGoogleToken } from './google/google.client';
import { slackIdentity } from './slack/slack.client';
import { telegramApi } from './telegram/telegram.client';

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${label} is required.`);
  return value.trim();
}

async function orBadRequest<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : String(error));
  }
}

/** Connecting and disconnecting a user's apps. Called through the web app, which sets x-user-id. */
@Controller('connectors')
export class ConnectorsController {
  constructor(@Inject(ConnectorStore) private readonly store: ConnectorStore) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    const status: Record<string, unknown> = {};
    for (const provider of CONNECTOR_PROVIDERS) {
      const connector = await this.store.get(userId, provider).catch(() => null);
      status[provider] = connector
        ? {
            connected: true,
            name: connector.name,
            // Used to show the Slack events URL; Telegram's webhook is set up automatically.
            id: connector.id,
            ...(provider === 'google'
              ? { chat: GOOGLE_CHAT_SCOPES.every(scope => (connector.data as { scopes: string[] }).scopes.includes(scope)) }
              : {}),
          }
        : { connected: false };
    }
    return status;
  }

  @Get('google/auth-url')
  googleAuthUrl(
    @Query('redirectUri') redirectUri: string,
    @Query('state') state: string,
    @Query('chat') chat: string,
    @Req() req: AuthenticatedRequest,
  ) {
    requireUserId(req);
    return { url: googleAuthUrl(requireString(redirectUri, 'redirectUri'), requireString(state, 'state'), chat === '1') };
  }

  @Post('google')
  async connectGoogle(@Body() body: { code?: string; redirectUri?: string }, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    const data = await orBadRequest(
      exchangeGoogleCode(requireString(body.code, 'code'), requireString(body.redirectUri, 'redirectUri')),
    );
    await this.store.save(userId, 'google', data, data.email);
    return { ok: true, name: data.email };
  }

  @Post('slack')
  async connectSlack(@Body() body: { botToken?: string; signingSecret?: string }, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    const botToken = requireString(body.botToken, 'Bot token');
    const signingSecret = requireString(body.signingSecret, 'Signing secret');
    if (!botToken.startsWith('xoxb-')) throw new BadRequestException('The bot token starts with "xoxb-".');

    const { teamName, botUserId } = await orBadRequest(slackIdentity(botToken));
    const saved = await this.store.save(userId, 'slack', { botToken, signingSecret, teamName, botUserId }, teamName);
    return { ok: true, name: teamName, id: saved.id };
  }

  @Post('telegram')
  async connectTelegram(@Body() body: { botToken?: string; webhookBaseUrl?: string }, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    const botToken = requireString(body.botToken, 'Bot token');
    const base = requireString(body.webhookBaseUrl, 'webhookBaseUrl').replace(/\/+$/, '');
    if (!base.startsWith('https://')) {
      throw new BadRequestException('Telegram only delivers messages to a public https:// address, so this needs the deployed API.');
    }

    const bot = await orBadRequest(telegramApi<{ username: string }>(botToken, 'getMe'));
    const webhookSecret = randomBytes(24).toString('hex');
    const saved = await this.store.save(userId, 'telegram', { botToken, botUsername: bot.username, webhookSecret }, `@${bot.username}`);
    try {
      // The webhook URL holds the saved row's id, so the connection is saved first.
      await telegramApi(botToken, 'setWebhook', {
        url: `${base}/hooks/telegram/${saved.id}`,
        secret_token: webhookSecret,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      });
    } catch (error) {
      await this.store.delete(userId, 'telegram');
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
    return { ok: true, name: `@${bot.username}` };
  }

  @Post('github')
  async connectGitHub(@Body() body: { token?: string }, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    const token = requireString(body.token, 'Token');
    const { login } = await orBadRequest(githubIdentity(token));
    await this.store.save(userId, 'github', { token, login }, login);
    return { ok: true, name: login };
  }

  @Delete(':provider')
  @HttpCode(200)
  async disconnect(@Param('provider') provider: string, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    if (!CONNECTOR_PROVIDERS.includes(provider as ConnectorProvider)) throw new BadRequestException('Unknown connector.');

    // Stop the outside service from sending more events or holding a grant; failures here don't block removal.
    if (provider === 'telegram') {
      const telegram = await this.store.get(userId, 'telegram').catch(() => null);
      if (telegram) await telegramApi(telegram.data.botToken, 'deleteWebhook').catch(() => undefined);
    }
    if (provider === 'google') {
      const google = await this.store.get(userId, 'google').catch(() => null);
      if (google) await revokeGoogleToken(google.data);
    }

    await this.store.delete(userId, provider as ConnectorProvider);
    return { ok: true };
  }
}
