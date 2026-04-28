import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { executeWorkflow, StepResult } from './executor';

type RunWorkflowInput = {
  input?: unknown;
};

@Injectable()
export class RunsService implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async runWorkflow(workflowId: string, body: RunWorkflowInput = {}) {
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

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found.`);
    }

    const run = await this.prisma.agentRun.create({
      data: {
        workflowId: workflow.id,
        status: 'PENDING',
      },
    });

    try {
      await this.prisma.agentRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: 'RUNNING',
        },
      });

      // The owner id is runtime context, not canvas data, so handlers receive it here.
      const stepResults = await executeWorkflow(workflow.canvasJson, {
        userId: workflow.userId,
        initialInput: body.input,
      });

      await this.createStepRecords(run.id, workflow.canvasJson, stepResults);

      const hasFailure = stepResults.some(step => step.status === 'FAILED');
      const completedRun = await this.prisma.agentRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: hasFailure ? 'FAILED' : 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return {
        run: completedRun,
        steps: stepResults,
      };
    } catch (error) {
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
    }
  }

  async findSteps(runId: string) {
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
    for (const step of steps) {
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
