import { Module } from '@nestjs/common';
import { ConnectorStore } from '../connectors/connector.store';
import { CredentialResolver } from '../integrations/credential.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
  providers: [
    PrismaService,
    CredentialResolver,
    { provide: ConnectorStore, useFactory: (prisma: PrismaService) => new ConnectorStore(prisma), inject: [PrismaService] },
  ],
})
export class FilesModule {}
