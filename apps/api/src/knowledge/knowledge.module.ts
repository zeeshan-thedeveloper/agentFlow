import { Module } from '@nestjs/common';
import { CredentialResolver } from '../integrations/credential.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  controllers: [KnowledgeController],
  providers: [PrismaService, CredentialResolver],
})
export class KnowledgeModule {}
