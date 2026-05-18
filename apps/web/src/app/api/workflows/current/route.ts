import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CANVAS_JSON, DEFAULT_WORKFLOW_NAME } from '@/components/canvas/defaultWorkflow';
import type { FlowEdge, FlowNode, WorkflowCanvasJson } from '@/components/canvas/types';

export const dynamic = 'force-dynamic';

function isFlowNode(value: unknown): value is FlowNode {
  if (!value || typeof value !== 'object') return false;

  const node = value as Partial<FlowNode>;
  return (
    typeof node.id === 'string' &&
    (node.type === 'trigger' || node.type === 'agent' || node.type === 'output' || node.type === 'integration') &&
    typeof node.label === 'string' &&
    typeof node.x === 'number' &&
    typeof node.y === 'number'
  );
}

function isFlowEdge(value: unknown): value is FlowEdge {
  if (!value || typeof value !== 'object') return false;

  const edge = value as Partial<FlowEdge>;
  return typeof edge.from === 'string' && typeof edge.to === 'string';
}

function isWorkflowCanvasJson(value: unknown): value is WorkflowCanvasJson {
  if (!value || typeof value !== 'object') return false;

  const canvas = value as Partial<WorkflowCanvasJson>;
  return (
    Array.isArray(canvas.nodes) &&
    canvas.nodes.every(isFlowNode) &&
    Array.isArray(canvas.edges) &&
    canvas.edges.every(isFlowEdge)
  );
}

function normalizeCanvasJson(value: unknown): WorkflowCanvasJson {
  return isWorkflowCanvasJson(value) ? value : DEFAULT_CANVAS_JSON;
}

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workflow =
    (await prisma.workflow.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })) ??
    (await prisma.workflow.create({
      data: {
        userId,
        name: DEFAULT_WORKFLOW_NAME,
        canvasJson: DEFAULT_CANVAS_JSON as never,
      },
    }));

  return NextResponse.json({
    ...workflow,
    canvasJson: normalizeCanvasJson(workflow.canvasJson),
  });
}

export async function PUT(request: Request) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    name?: unknown;
    canvasJson?: unknown;
  } | null;

  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : DEFAULT_WORKFLOW_NAME;

  if (!isWorkflowCanvasJson(body?.canvasJson)) {
    return NextResponse.json({ error: 'Invalid canvas JSON' }, { status: 400 });
  }

  const existing =
    typeof body?.id === 'string'
      ? await prisma.workflow.findFirst({ where: { id: body.id, userId } })
      : await prisma.workflow.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } });

  const workflow = existing
    ? await prisma.workflow.update({
        where: { id: existing.id },
        data: {
          name,
          canvasJson: body.canvasJson as never,
        },
      })
    : await prisma.workflow.create({
        data: {
          userId,
          name,
          canvasJson: body.canvasJson as never,
        },
      });

  return NextResponse.json({
    ...workflow,
    canvasJson: normalizeCanvasJson(workflow.canvasJson),
  });
}
