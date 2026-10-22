import type { NodeHandler } from './base.handler';

export class TriggerHandler implements NodeHandler {
  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    // Manual triggers are the default; Slack and Telegram triggers are started by
    // their webhooks with the message as input. Cron validation is only a gate.
    const triggerType = params.triggerType ?? 'manual';
    const triggerInputMode = params.triggerInputMode ?? 'none';

    if (typeof triggerType !== 'string') {
      throw new Error('Trigger node triggerType must be a string.');
    }

    const normalizedTriggerType = triggerType.toLowerCase();

    if (!['manual', 'cron', 'cron schedule', 'slack message', 'telegram message'].includes(normalizedTriggerType)) {
      throw new Error(`Unsupported trigger type: ${triggerType}`);
    }

    if (
      typeof triggerInputMode !== 'string' ||
      !['none', 'input'].includes(triggerInputMode)
    ) {
      throw new Error('Trigger node triggerInputMode must be "none" or "input".');
    }

    if (triggerInputMode === 'input' && typeof params.triggerInput !== 'string') {
      throw new Error('Trigger node triggerInput must be a string when input mode is enabled.');
    }

    return input;
  }
}
