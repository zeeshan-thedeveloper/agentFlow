import type { NodeHandler } from '../handlers/base.handler';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialResolver } from './credential.resolver';
import type { SchemaConfig } from './integration.interfaces';
import { integrationRegistry } from './integration.registry';
import { enforceSchemaPolicy } from './schema.enforcer';
import { interpolateParams } from './template.interpolator';

export class IntegrationHandler implements NodeHandler {
  constructor(
    private readonly credentialResolver: CredentialResolver,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    const integrationId = String(params.integrationId ?? '');
    const actionId = String(params.actionId ?? '');
    const userId = String(params.userId ?? '');
    const rawActionParams = (params.actionParams ?? {}) as Record<string, unknown>;

    if (!integrationId) throw new Error('integrationId is required on integration nodes.');
    if (!actionId) throw new Error('actionId is required on integration nodes.');
    if (!userId) throw new Error('userId was not injected into integration node params.');

    const integration = integrationRegistry.get(integrationId);
    if (!integration) throw new Error(`Unknown integration: "${integrationId}".`);

    const actionParams = interpolateParams(rawActionParams, input);

    const schemaConfigRow = await this.prisma.databaseSchemaConfig.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });
    const schemaConfig = schemaConfigRow
      ? (schemaConfigRow.config as unknown as SchemaConfig)
      : null;

    enforceSchemaPolicy(actionId, actionParams, schemaConfig);

    const credentials = await this.credentialResolver.resolve(userId, integrationId);

    return integration.execute(actionId, actionParams, input, credentials);
  }
}
