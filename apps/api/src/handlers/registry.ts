import type { NodeHandler } from './base.handler';
import { AgentHandler } from './agent.handler';
import { OutputHandler } from './output.handler';
import { TriggerHandler } from './trigger.handler';

// Keep runtime dispatch explicit: canvas node type -> trusted backend handler.
export const registry: Record<string, NodeHandler> = {
  trigger: new TriggerHandler(),
  agent: new AgentHandler(),
  output: new OutputHandler(),
};
