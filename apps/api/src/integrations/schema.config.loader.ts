import { PrismaService } from '../prisma/prisma.service';
import type { SchemaConfig } from './integration.interfaces';

let prisma: PrismaService;

export function initSchemaConfigLoader(p: PrismaService) {
  prisma = p;
}

export function getSchemaConfigLoader() {
  return async (userId: string, integrationId: string): Promise<SchemaConfig | null> => {
    const row = await prisma.databaseSchemaConfig.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });
    return row ? (row.config as unknown as SchemaConfig) : null;
  };
}
