import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunsService } from '../runs/runs.service';
import type { TriggerEvent } from './trigger-event';

const TRIGGER_TYPES: Record<TriggerEvent['source'], string> = {
  slack: 'slack message',
  telegram: 'telegram message',
};

type TriggerNode = { type?: unknown; triggerType?: unknown; triggerKeyword?: unknown };

/** Does this trigger node listen for `event`? An optional keyword must appear in the message. */
function listensFor(node: TriggerNode, event: TriggerEvent): boolean {
  if (node.type !== 'trigger' || typeof node.triggerType !== 'string') return false;
  if (node.triggerType.toLowerCase() !== TRIGGER_TYPES[event.source]) return false;
  const keyword = typeof node.triggerKeyword === 'string' ? node.triggerKeyword.trim().toLowerCase() : '';
  return !keyword || event.text.toLowerCase().includes(keyword);
}

/**
 * Starts every saved workflow of the user whose trigger listens for the
 * message. Runs go in the background so the webhook can answer right away;
 * Slack retries anything that takes over 3 seconds.
 */
@Injectable()
export class TriggerDispatcher {
  private readonly logger = new Logger(TriggerDispatcher.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RunsService) private readonly runs: RunsService,
  ) {}

  async dispatch(userId: string, event: TriggerEvent): Promise<number> {
    const workflows = await this.prisma.workflow.findMany({ where: { userId }, select: { id: true, canvasJson: true } });
    const matching = workflows.filter(workflow => {
      const nodes = (workflow.canvasJson as { nodes?: unknown } | null)?.nodes;
      return Array.isArray(nodes) && nodes.some(node => listensFor(node as TriggerNode, event));
    });

    this.logger.log(`${event.source} message for user ${userId} starts ${matching.length} workflow(s)`);
    for (const workflow of matching) {
      void this.runs.runWorkflow(workflow.id, { input: event.text, triggerEvent: event }).catch(error => {
        this.logger.error(`Triggered run of ${workflow.id} failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    return matching.length;
  }
}
