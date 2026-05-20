import type { NodeHandler } from './base.handler';
import { AgentHandler } from './agent.handler';
import { OutputHandler } from './output.handler';
import { TriggerHandler } from './trigger.handler';
import { CredentialResolver } from '../integrations/credential.resolver';
import { IntegrationHandler } from '../integrations/integration.handler';
import { PrismaService } from '../prisma/prisma.service';

const prisma = new PrismaService();
const credentialResolver = new CredentialResolver(prisma);

// Keep runtime dispatch explicit: canvas node type -> trusted backend handler.
export const registry: Record<string, NodeHandler> = {
  trigger: new TriggerHandler(),
  agent: new AgentHandler(),
  output: new OutputHandler(),
  integration: new IntegrationHandler(credentialResolver, prisma),
};
