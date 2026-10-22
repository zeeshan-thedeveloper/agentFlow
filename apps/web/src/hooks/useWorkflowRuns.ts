'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ToolCallRecord } from '@/components/canvas/types';

export type RunTrigger =
  | { source: 'manual'; text?: string }
  | { source: 'slack'; from: string; channel: string; text: string }
  | { source: 'telegram'; from: string; chatId: number; text: string };

export interface RunResult {
  nodeId: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  wave: number;
  output: string;
  toolCalls?: ToolCallRecord[];
}

export interface WorkflowRun {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  summary: string | null;
  /** Missing on runs from before run history existed. */
  trigger: RunTrigger | null;
  results: RunResult[] | null;
  /** Present while the run is in progress. */
  livePhases?: Record<string, 'queued' | 'running' | 'done' | 'failed' | 'skipped'>;
}

const POLL_MS = 3000;

/** The workflow's recent runs, refreshed every few seconds while the tab is visible. */
export function useWorkflowRuns(workflowId: string | null) {
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);

  const refresh = useCallback(async () => {
    if (!workflowId) return;
    try {
      const response = await fetch(`/api/workflows/${workflowId}/runs?limit=20`, { cache: 'no-store' });
      if (response.ok) setRuns((await response.json()) as WorkflowRun[]);
    } catch {
      // A missed poll is retried on the next tick.
    }
  }, [workflowId]);

  useEffect(() => {
    if (!workflowId) return;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [workflowId, refresh]);

  return { runs, refresh };
}
