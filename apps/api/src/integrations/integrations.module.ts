import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialResolver } from './credential.resolver';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, CredentialResolver, PrismaService],
  exports: [CredentialResolver],
})
export class IntegrationsModule {}
