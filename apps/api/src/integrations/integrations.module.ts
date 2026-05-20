import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialResolver } from './credential.resolver';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { initSchemaConfigLoader } from './schema.config.loader';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, CredentialResolver, PrismaService],
  exports: [CredentialResolver],
})
export class IntegrationsModule implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    initSchemaConfigLoader(this.prisma);
  }
}
