import type { NodeHandler } from './base.handler';
import type { ConnectorStore } from '../connectors/connector.store';
import { isTriggerEvent, replyToTrigger } from '../connectors/trigger-event';

export const REPLY_IN_CHAT = 'Reply in chat';

export class OutputHandler implements NodeHandler {
  constructor(private readonly store?: ConnectorStore) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    const text = (typeof input === 'string' ? input : JSON.stringify(input, null, 2))?.trim() || '(no output)';

    // Replies only happen for runs a Slack or Telegram message started; a manual run just returns the output.
    if (params.outputMode === REPLY_IN_CHAT && isTriggerEvent(params.triggerEvent) && this.store) {
      await replyToTrigger(this.store, this.userIdOf(params), params.triggerEvent, text);
    }

    return input;
  }

  private userIdOf(params: Record<string, unknown>): string {
    if (typeof params.userId !== 'string') throw new Error('Output node requires workflow owner userId.');
    return params.userId;
  }
}
