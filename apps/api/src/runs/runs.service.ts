import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { executeWorkflow, StepResult, type RunProgress } from './executor';
import type { TriggerEvent } from '../connectors/trigger-event';
import { summarizeForLog } from '../common/log-summary';

type RunWorkflowInput = {
  input?: unknown;
  /** Set only by the Slack and Telegram webhooks. */
  triggerEvent?: TriggerEvent;
};

/** A node's state while its run is in progress. */
export type LivePhase = 'queued' | 'running' | 'done' | 'failed' | 'skipped';

/** What started a run, as shown in the run history. */
type RunTrigger =
  | { source: 'manual'; text?: string }
  | { source: 'slack'; from: string; channel: string; text: string }
  | { source: 'telegram'; from: string; chatId: number; text: string };

const MAX_SAVED_OUTPUT_CHARS = 4000;
const MAX_LISTED_RUNS = 50;

function describeTrigger(body: RunWorkflowInput): RunTrigger {
  const event = body.triggerEvent;
  if (event?.source === 'slack') return { source: 'slack', from: event.user, channel: event.channel, text: event.text };
  if (event?.source === 'telegram') return { source: 'telegram', from: event.from, chatId: event.chatId, text: event.text };
  return { source: 'manual', ...(typeof body.input === 'string' && body.input ? { text: body.input } : {}) };
}

/** A step result small enough to keep in the run history. */
function savedResult(result: StepResult) {
  const output = typeof result.output === 'string' ? result.output : JSON.stringify(result.output ?? null);
  return {
    nodeId: result.nodeId,
    status: result.status,
    wave: result.wave,
    output: output.length > MAX_SAVED_OUTPUT_CHARS ? `${output.slice(0, MAX_SAVED_OUTPUT_CHARS)}...` : output,
    ...(result.toolCalls ? { toolCalls: result.toolCalls } : {}),
  };
}

@Injectable()
export class RunsService implements OnModuleDestroy {
  private readonly logger = new Logger(RunsService.name);
  private readonly prisma = new PrismaClient();
  /** Node phases of runs in progress in this process, by run id; the canvas polls them to animate. */
  private readonly live = new Map<string, Record<string, LivePhase>>();

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /** `requesterId`, when given, must own the workflow; webhook-started runs omit it after matching the owner themselves. */
  async runWorkflow(workflowId: string, body: RunWorkflowInput = {}, requesterId?: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: {
        id: workflowId,
      },
      select: {
        id: true,
        userId: true,
        canvasJson: true,
      },
    });

    // Someone else's workflow answers the same as a missing one, so ids can't be probed.
    if (!workflow || (requesterId !== undefined && workflow.userId !== requesterId)) {
      throw new NotFoundException(`Workflow ${workflowId} not found.`);
    }

    this.logger.log(
      `Run requested: workflowId=${workflow.id} userId=${workflow.userId} input=${summarizeForLog(body.input)} nodes=${describeWorkflowNodes(workflow.canvasJson)}`,
    );

    const run = await this.prisma.agentRun.create({
      data: {
        workflowId: workflow.id,
        status: 'PENDING',
        trigger: describeTrigger(body) as Prisma.InputJsonValue,
      },
    });

    const nodeIds = [...this.getNodeTypeMap(workflow.canvasJson).keys()];
    const phases: Record<string, LivePhase> = Object.fromEntries(nodeIds.map(id => [id, 'queued' as const]));
    this.live.set(run.id, phases);
    const onProgress = (event: RunProgress) => {
      if (event.type === 'step') {
        for (const id of event.nodeIds) phases[id] = 'running';
      } else {
        const { nodeId, status } = event.result;
        phases[nodeId] = status === 'COMPLETED' ? 'done' : status === 'FAILED' ? 'failed' : 'skipped';
      }
    };

    try {
      await this.prisma.agentRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: 'RUNNING',
        },
      });

      this.logger.log(`Run ${run.id} started for workflow ${workflow.id}`);

      // The owner id is runtime context, not canvas data, so handlers receive it here.
      const stepResults = await executeWorkflow(workflow.canvasJson, {
        userId: workflow.userId,
        initialInput: body.input,
        triggerEvent: body.triggerEvent,
        onProgress,
      });

      await this.createStepRecords(run.id, workflow.canvasJson, stepResults);

      const hasFailure = stepResults.some(step => step.status === 'FAILED');
      this.logger.log(
        `Run ${run.id} finished: status=${hasFailure ? 'FAILED' : 'COMPLETED'} steps=${stepResults.map(step => `${step.nodeId}:${step.status}`).join(',')}`,
      );
      const completedRun = await this.prisma.agentRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: hasFailure ? 'FAILED' : 'COMPLETED',
          completedAt: new Date(),
          results: stepResults.map(savedResult) as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        run: completedRun,
        steps: stepResults,
      };
    } catch (error) {
      this.logger.error(
        `Run ${run.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.prisma.agentRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          summary: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    } finally {
      this.live.delete(run.id);
    }
  }

  /** The workflow's most recent runs, newest first, with live node phases for runs still going. */
  async listRuns(workflowId: string, requesterId: string, limit = 20) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId }, select: { userId: true } });
    if (!workflow || workflow.userId !== requesterId) {
      throw new NotFoundException(`Workflow ${workflowId} not found.`);
    }

    const runs = await this.prisma.agentRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(Math.floor(limit) || 20, 1), MAX_LISTED_RUNS),
      select: { id: true, status: true, startedAt: true, completedAt: true, summary: true, trigger: true, results: true },
    });

    return runs.map(run => {
      const live = this.live.get(run.id);
      // An unfinished run this process isn't running was cut off, e.g. by a restart.
      const interrupted = !live && (run.status === 'RUNNING' || run.status === 'PENDING');
      return {
        ...run,
        status: interrupted ? 'FAILED' : run.status,
        summary: interrupted ? 'Stopped before finishing (the server restarted).' : run.summary,
        ...(live ? { livePhases: { ...live } } : {}),
      };
    });
  }

  async findSteps(runId: string, requesterId: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
      select: { workflow: { select: { userId: true } } },
    });
    if (!run || run.workflow.userId !== requesterId) {
      throw new NotFoundException(`Run ${runId} not found.`);
    }

    return this.prisma.agentStep.findMany({
      where: {
        runId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private async createStepRecords(
    runId: string,
    canvasJson: Prisma.JsonValue,
    steps: StepResult[],
  ): Promise<void> {
    const nodeTypes = this.getNodeTypeMap(canvasJson);

    // AgentStep has no status column today, so status stays in executor output/API response.
    // Skipped nodes never ran, so they get no step record.
    for (const step of steps.filter(item => item.status !== 'SKIPPED')) {
      await this.prisma.agentStep.create({
        data: {
          runId,
          stepType: nodeTypes.get(step.nodeId) ?? step.nodeId,
          input: this.toJsonValue(step.input),
          output: this.toJsonValue(step.output),
        },
      });
    }
  }

  private getNodeTypeMap(canvasJson: Prisma.JsonValue): Map<string, string> {
    const nodeTypes = new Map<string, string>();

    if (!canvasJson || typeof canvasJson !== 'object' || Array.isArray(canvasJson)) {
      return nodeTypes;
    }

    const nodes = (canvasJson as { nodes?: unknown }).nodes;

    if (!Array.isArray(nodes)) {
      return nodeTypes;
    }

    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        continue;
      }

      const id = (node as { id?: unknown }).id;
      const type = (node as { type?: unknown }).type;

      if (typeof id === 'string' && typeof type === 'string') {
        nodeTypes.set(id, type);
      }
    }

    return nodeTypes;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === undefined) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }
}

function describeWorkflowNodes(canvasJson: Prisma.JsonValue): string {
  if (!canvasJson || typeof canvasJson !== 'object' || Array.isArray(canvasJson)) {
    return 'invalid-canvas';
  }

  const nodes = (canvasJson as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) {
    return 'no-nodes';
  }

  return nodes
    .filter((node): node is Record<string, unknown> => typeof node === 'object' && node !== null && !Array.isArray(node))
    .map(node => {
      const id = typeof node.id === 'string' ? node.id : 'unknown';
      const type = typeof node.type === 'string' ? node.type : 'unknown';
      const tools = Array.isArray(node.tools) ? node.tools.filter(tool => typeof tool === 'string').join('|') : '';
      return `${id}:${type}${tools ? `[tools=${tools}]` : ''}`;
    })
    .join(',');
}
