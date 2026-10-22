import { Body, Controller, ForbiddenException, Headers, HttpCode, Inject, Logger, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ConnectorStore } from './connector.store';
import { verifySlackSignature } from './slack/slack.client';
import { TriggerDispatcher } from './trigger.dispatcher';

type SlackPayload = {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    subtype?: string;
    channel_type?: string;
    bot_id?: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
  };
};

type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: { username?: string; first_name?: string; is_bot?: boolean };
  };
};

function sameSecret(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Public endpoints Slack and Telegram post messages to. The id in the path is
 * the connection's row id, and every request is checked against that
 * connection's signing secret (Slack) or secret token (Telegram).
 */
@Controller('hooks')
export class HooksController {
  private readonly logger = new Logger(HooksController.name);

  constructor(
    @Inject(ConnectorStore) private readonly store: ConnectorStore,
    @Inject(TriggerDispatcher) private readonly dispatcher: TriggerDispatcher,
  ) {}

  @Post('slack/:id')
  @HttpCode(200)
  async slack(
    @Param('id') id: string,
    @Req() req: { rawBody?: Buffer },
    @Headers('x-slack-request-timestamp') timestamp: string | undefined,
    @Headers('x-slack-signature') signature: string | undefined,
    @Headers('x-slack-retry-num') retryNum: string | undefined,
    @Body() payload: SlackPayload,
  ) {
    const connector = await this.store.findById(id, 'slack');
    if (!connector) throw new NotFoundException();
    if (!req.rawBody || !verifySlackSignature(connector.data.signingSecret, timestamp, signature, req.rawBody)) {
      throw new ForbiddenException('Invalid Slack signature.');
    }

    if (payload.type === 'url_verification') return { challenge: payload.challenge };
    // Slack resends when it thinks a delivery timed out; the first delivery already started the run.
    if (retryNum) return { ok: true };

    const event = payload.event;
    const fromPerson = event && !event.bot_id && !event.subtype && event.user && event.user !== connector.data.botUserId;
    const relevant = event?.type === 'app_mention' || (event?.type === 'message' && event.channel_type === 'im');
    if (payload.type !== 'event_callback' || !fromPerson || !relevant || !event.channel || !event.ts) {
      return { ok: true };
    }

    const text = (event.text ?? '').replace(new RegExp(`<@${connector.data.botUserId}>`, 'g'), '').trim();
    await this.dispatcher.dispatch(connector.userId, {
      source: 'slack',
      channel: event.channel,
      ts: event.ts,
      threadTs: event.thread_ts,
      user: event.user!,
      text,
    });
    return { ok: true };
  }

  @Post('telegram/:id')
  @HttpCode(200)
  async telegram(
    @Param('id') id: string,
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    const connector = await this.store.findById(id, 'telegram');
    if (!connector) throw new NotFoundException();
    if (!sameSecret(connector.data.webhookSecret, secret)) throw new ForbiddenException('Invalid Telegram secret token.');

    const message = update.message;
    if (!message?.text || message.from?.is_bot) return { ok: true };

    try {
      await this.dispatcher.dispatch(connector.userId, {
        source: 'telegram',
        chatId: message.chat.id,
        messageId: message.message_id,
        from: message.from?.username ? `@${message.from.username}` : message.from?.first_name ?? 'someone',
        text: message.text,
      });
    } catch (error) {
      // Answer 200 anyway: Telegram would otherwise keep redelivering the same update.
      this.logger.error(`Telegram dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { ok: true };
  }
}
