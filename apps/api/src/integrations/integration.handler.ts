import type { NodeHandler } from '../handlers/base.handler';
import { CredentialResolver } from './credential.resolver';
import { integrationRegistry } from './integration.registry';

export class IntegrationHandler implements NodeHandler {
  constructor(private readonly credentialResolver: CredentialResolver) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    const integrationId = String(params.integrationId ?? '');
    const actionId = String(params.actionId ?? '');
    const userId = String(params.userId ?? '');
    const actionParams = (params.actionParams ?? {}) as Record<string, unknown>;

    if (!integrationId) throw new Error('integrationId is required on integration nodes.');
    if (!actionId) throw new Error('actionId is required on integration nodes.');
    if (!userId) throw new Error('userId was not injected into integration node params.');

    const integration = integrationRegistry.get(integrationId);
    if (!integration) throw new Error(`Unknown integration: "${integrationId}".`);

    const credentials = await this.credentialResolver.resolve(userId, integrationId);

    return integration.execute(actionId, actionParams, input, credentials);
  }
}
