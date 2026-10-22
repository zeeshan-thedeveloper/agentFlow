import type { NodeHandler } from './base.handler';
import type { ConnectorStore } from '../connectors/connector.store';
import { isTriggerEvent, replyToTrigger } from '../connectors/trigger-event';

export const REPLY_IN_CHAT = 'Reply in chat';

export class OutputHandler implements NodeHandler {
  constructor(private readonly store?: ConnectorStore) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    // Replies only happen for runs a Slack or Telegram message started; a manual run just returns the output.
    if (params.outputMode === REPLY_IN_CHAT && isTriggerEvent(params.triggerEvent) && this.store) {
      const userId = params.userId;
      if (typeof userId !== 'string') throw new Error('Output node requires workflow owner userId.');
      const text = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
      await replyToTrigger(this.store, userId, params.triggerEvent, text?.trim() || '(no output)');
    }
    return input;
  }
}
